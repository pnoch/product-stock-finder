import { and, eq, lt } from "drizzle-orm";
import { priceCache, type PriceCacheRow } from "../drizzle/schema";
import { getDb } from "./db";
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
  const db = await getDb();
  if (!db) {
    memoryCache.set(cacheKey(distributorId, modelNumber), snapshot);
    return;
  }
  const values = {
    distributorId,
    modelNumber,
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
    expectedDate: snapshot.expectedDate ?? null,
    url: snapshot.url,
    taxRate: snapshot.taxRate ?? null,
    fetchedAt: snapshot.fetchedAt,
  };
  await db.insert(priceCache).values(values).onDuplicateKeyUpdate({
    set: {
      price: snapshot.price,
      currency: snapshot.currency,
      stockStatus: snapshot.stockStatus,
      expectedDate: snapshot.expectedDate ?? null,
      url: snapshot.url,
      taxRate: snapshot.taxRate ?? null,
      fetchedAt: snapshot.fetchedAt,
    },
  });
}

export async function listNearExpiry(
  now: number,
  thresholdMs: number,
): Promise<Array<{ distributorId: string; modelNumber: string }>> {
  const cutoff = now - thresholdMs;
  const db = await getDb();
  if (!db) {
    const entries: Array<{ distributorId: string; modelNumber: string }> = [];
    for (const [key, snap] of memoryCache) {
      if (snap.fetchedAt < cutoff) {
        const [distributorId, modelNumber] = key.split(":");
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
    .where(lt(priceCache.fetchedAt, cutoff));
  return rows;
}

export async function getAllFetchedAt(): Promise<
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
      const [distributorId, modelNumber] = key.split(":");
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
    .from(priceCache);
  return rows;
}

export function clearPriceCacheForTests(): void {
  memoryCache.clear();
}

function rowToSnapshot(row: PriceCacheRow): PriceSnapshot {
  return {
    price: row.price,
    currency: row.currency,
    stockStatus: row.stockStatus as StockStatus,
    expectedDate: row.expectedDate ?? undefined,
    url: row.url,
    taxRate: row.taxRate ?? undefined,
    fetchedAt: row.fetchedAt,
  };
}