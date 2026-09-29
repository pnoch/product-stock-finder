import { and, asc, desc, eq, lt } from "drizzle-orm";
import { priceCache, type PriceCacheRow } from "../drizzle/schema";
import { getDb, affectedRowsOf } from "./db";
import { storagePrice, storeKey } from "./store-keys";
import { isPlausiblePrice } from "../shared/const";
import type { PriceSnapshot, StockStatus } from "../lib/types";

type MemoryEntry = {
  distributorId: string;
  modelNumber: string;
  snapshot: PriceSnapshot;
};

// Keyed by storeKey (case-folded), but the original spellings are kept on the
// entry: getAllFetchedAt/listNearExpiry feed the warmer, which matches them
// against the catalog's exact case, so the fold must not leak out.
const memoryCache = new Map<string, MemoryEntry>();

export async function getCachedPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const db = await getDb();
  if (!db) {
    return memoryCache.get(storeKey(distributorId, modelNumber))?.snapshot ?? null;
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
  // never overwrite the global 1h cache for all users. Shared with the client
  // device-scrape path so both agree on the bound.
  if (!isPlausiblePrice(snapshot.price)) {
    throw new Error(
      `implausible price for ${distributorId}/${modelNumber}: ${snapshot.price}`,
    );
  }
  const db = await getDb();
  if (!db) {
    memoryCache.set(storeKey(distributorId, modelNumber), {
      distributorId,
      modelNumber,
      snapshot: { ...snapshot, price: storagePrice(snapshot.price) },
    });
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
    for (const entry of memoryCache.values()) {
      if (entries.length >= limit) break;
      if (entry.snapshot.fetchedAt < cutoff) {
        entries.push({
          distributorId: entry.distributorId,
          modelNumber: entry.modelNumber,
        });
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
    for (const entry of memoryCache.values()) {
      if (entries.length >= limit) break;
      entries.push({
        distributorId: entry.distributorId,
        modelNumber: entry.modelNumber,
        fetchedAt: entry.snapshot.fetchedAt,
      });
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
    // Newest rows: pickPairsToWarm treats a missing entry as "never fetched"
    // (`?? 0`), so returning the oldest rows made the omitted newest pairs look
    // stale and re-warm them while genuinely stale pairs were skipped.
    .orderBy(desc(priceCache.fetchedAt))
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
    for (const [key, entry] of memoryCache) {
      if (entry.snapshot.fetchedAt < cutoff) memoryCache.delete(key);
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
