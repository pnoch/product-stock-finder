import { and, asc, eq, lt } from "drizzle-orm";
import { priceCache, type PriceCacheRow } from "../drizzle/schema";
import { getDb, affectedRowsOf } from "./db";
import type { PriceSnapshot, StockStatus } from "../lib/types";

const memoryCache = new Map<string, PriceSnapshot>();

function cacheKey(distributorId: string, modelNumber: string): string {
  return `${distributorId}:${modelNumber}`;
}

export async function getCachedPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const db = await getDb();
  if (!db) {
    return memoryCache.get(cacheKey(distributorId, modelNumber)) ?? null;
  }
  const rows = await db
    .select()
    .from(priceCache)
    .where(
      and(
        eq(priceCache.distributorId, distributorId),
        eq(priceCache.modelNumber, modelNumber),
      ),
    )
    .limit(1);
  return rows.length > 0 ? rowToSnapshot(rows[0]) : null;
}

export async function setCachedPrice(
  distributorId: string,
  modelNumber: string,
  snapshot: PriceSnapshot,
): Promise<void> {
  // Plausibility guard: a misparsed page (e.g. shipping text as price) must
  // never overwrite the global 1h cache for all users.
  if (
    !Number.isFinite(snapshot.price) ||
    snapshot.price <= 0 ||
    snapshot.price > 1e7
  ) {
    throw new Error(
      `implausible price for ${distributorId}/${modelNumber}: ${snapshot.price}`,
    );
  }
  const db = await getDb();
  if (!db) {
    memoryCache.set(cacheKey(distributorId, modelNumber), snapshot);
    return;
  }
  // Drizzle decimal columns expect string values to preserve precision
  const priceStr = String(snapshot.price);
  const values = {
    distributorId,
    modelNumber,
    price: priceStr,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
    expectedDate: snapshot.expectedDate ?? null,
    url: snapshot.url,
    taxRate: snapshot.taxRate ?? null,
    fetchedAt: snapshot.fetchedAt,
  };
  await db
    .insert(priceCache)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        price: priceStr,
        currency: snapshot.currency,
        stockStatus: snapshot.stockStatus,
        expectedDate: snapshot.expectedDate ?? null,
        url: snapshot.url,
        taxRate: snapshot.taxRate ?? null,
        fetchedAt: snapshot.fetchedAt,
      },
    });
}

// Bounded per tick: the warmer refreshes a few rows every 5 minutes, so an
// unbounded scan would re-fetch an ever-growing table in one tick.
const NEAR_EXPIRY_PER_TICK = 100;

export async function listNearExpiry(
  now: number,
  thresholdMs: number,
  limit: number = NEAR_EXPIRY_PER_TICK,
): Promise<Array<{ distributorId: string; modelNumber: string }>> {
  const cutoff = now - thresholdMs;
  const db = await getDb();
  if (!db) {
    const entries: Array<{ distributorId: string; modelNumber: string }> = [];
    for (const [key, snap] of memoryCache) {
      if (entries.length >= limit) break;
      if (snap.fetchedAt < cutoff) {
        const sep = key.indexOf(":");
        if (sep === -1) continue;
        const distributorId = key.slice(0, sep);
        const modelNumber = key.slice(sep + 1);
        entries.push({ distributorId, modelNumber });
      }
    }
    return entries;
  }
  const rows = await db
    .select({
      distributorId: priceCache.distributorId,
      modelNumber: priceCache.modelNumber,
    })
    .from(priceCache)
    .where(lt(priceCache.fetchedAt, cutoff))
    .orderBy(asc(priceCache.fetchedAt))
    .limit(limit);
  return rows;
}

// Safety valve: priceCache rows are keyed by distributor/model and the table
// grows with every distinct model ever requested, while the warmer only needs
// staleness info. Cap the scan well above catalog scale; rows beyond the cap
// read as never-fetched and are warmed first (safe direction).
const FETCHED_AT_SCAN_CAP = 5000;

export async function getAllFetchedAt(
  limit: number = FETCHED_AT_SCAN_CAP,
): Promise<
  Array<{ distributorId: string; modelNumber: string; fetchedAt: number }>
> {
  const db = await getDb();
  if (!db) {
    const entries: Array<{
      distributorId: string;
      modelNumber: string;
      fetchedAt: number;
    }> = [];
    for (const [key, snap] of memoryCache) {
      if (entries.length >= limit) break;
      const sep = key.indexOf(":");
      if (sep === -1) continue;
      const distributorId = key.slice(0, sep);
      const modelNumber = key.slice(sep + 1);
      entries.push({ distributorId, modelNumber, fetchedAt: snap.fetchedAt });
    }
    return entries;
  }
  const rows = await db
    .select({
      distributorId: priceCache.distributorId,
      modelNumber: priceCache.modelNumber,
      fetchedAt: priceCache.fetchedAt,
    })
    .from(priceCache)
    .orderBy(asc(priceCache.fetchedAt))
    .limit(limit);
  return rows;
}

export function clearPriceCacheForTests(): void {
  memoryCache.clear();
}

// price_cache rows are keyed by (distributor, model) and grow with every
// distinct model ever requested via the public prices.get, with no delete path.
// Drop rows not refreshed within the retention window (batched, called from the
// warmer tick); a purged row simply reads as a cache miss and is re-warmed.
const PRICE_CACHE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRICE_CACHE_PURGE_BATCH = 1000;
const PRICE_CACHE_PURGE_MAX_BATCHES = 10;

export async function purgeStalePriceCache(now: number): Promise<void> {
  const cutoff = now - PRICE_CACHE_RETENTION_MS;
  const db = await getDb();
  if (!db) {
    for (const [key, snap] of memoryCache) {
      if (snap.fetchedAt < cutoff) memoryCache.delete(key);
    }
    return;
  }
  for (let batch = 0; batch < PRICE_CACHE_PURGE_MAX_BATCHES; batch++) {
    const result = await db
      .delete(priceCache)
      .where(lt(priceCache.fetchedAt, cutoff))
      .limit(PRICE_CACHE_PURGE_BATCH);
    const affected = affectedRowsOf(result);
    if (!Number.isFinite(affected) || affected < PRICE_CACHE_PURGE_BATCH) break;
  }
}

function rowToSnapshot(row: PriceCacheRow): PriceSnapshot {
  return {
    price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
    currency: row.currency,
    stockStatus: row.stockStatus as StockStatus,
    expectedDate: row.expectedDate ?? undefined,
    url: row.url,
    taxRate: row.taxRate ?? undefined,
    fetchedAt: row.fetchedAt,
  };
}
