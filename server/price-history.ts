import { and, eq, lt, sql } from "drizzle-orm";
import { priceHistory, type PriceHistoryRow } from "../drizzle/schema";
import { getDb } from "./db";
import type { PricePoint, PriceSnapshot, StockStatus } from "../lib/types";

const HISTORY_DAYS = 90;

const memoryHistory = new Map<string, PricePoint[]>();

function cacheKey(distributorId: string, modelNumber: string): string {
  return `${distributorId}:${modelNumber}`;
}

function dayOf(date: string): string {
  return date.slice(0, 10);
}

export async function recordHistoryPoint(
  distributorId: string,
  modelNumber: string,
  snapshot: PriceSnapshot,
): Promise<void> {
  const point: PricePoint = {
    date: new Date(snapshot.fetchedAt).toISOString(),
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
  };
  await mergeHistory(distributorId, modelNumber, [point]);
}

export async function getHistory(
  distributorId: string,
  modelNumber: string,
): Promise<PricePoint[]> {
  const db = await getDb();
  if (!db) {
    const points =
      memoryHistory.get(cacheKey(distributorId, modelNumber)) ?? [];
    return [...points].sort((a, b) => a.date.localeCompare(b.date));
  }
  const rows = await db
    .select()
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.distributorId, distributorId),
        eq(priceHistory.modelNumber, modelNumber),
      ),
    )
    .orderBy(priceHistory.date);
  return rows.map(rowToPoint);
}

export async function mergeHistory(
  distributorId: string,
  modelNumber: string,
  points: PricePoint[],
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const key = cacheKey(distributorId, modelNumber);
    const existing = memoryHistory.get(key) ?? [];
    const byDay = new Map<string, PricePoint>();
    for (const p of existing) byDay.set(dayOf(p.date), p);
    for (const p of points) {
      const current = byDay.get(dayOf(p.date));
      if (!current || p.date > current.date) byDay.set(dayOf(p.date), p);
    }
    memoryHistory.set(key, [...byDay.values()]);
    return;
  }
  const values = points.map((p) => ({
    distributorId,
    modelNumber,
    date: dayOf(p.date),
    price: String(p.price),
    currency: p.currency,
    stockStatus: p.stockStatus,
    fetchedAt: Date.parse(p.date),
  }));
  if (values.length === 0) return;
  await db.insert(priceHistory).values(values).onDuplicateKeyUpdate({
    set: {
      price: sql`IF(VALUES(fetchedAt) > fetchedAt, VALUES(price), price)`,
      currency: sql`IF(VALUES(fetchedAt) > fetchedAt, VALUES(currency), currency)`,
      stockStatus: sql`IF(VALUES(fetchedAt) > fetchedAt, VALUES(stockStatus), stockStatus)`,
      fetchedAt: sql`IF(VALUES(fetchedAt) > fetchedAt, VALUES(fetchedAt), fetchedAt)`,
    },
  });
}

// Batched: a single unbounded DELETE would hold a long lock once history
// grows. The remainder drains on subsequent ticks (self-draining).
const PURGE_BATCH_SIZE = 1000;
const PURGE_MAX_BATCHES_PER_TICK = 10;

export async function purgeOldHistory(now: number): Promise<void> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_DAYS);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  const db = await getDb();
  if (!db) {
    for (const [key, points] of memoryHistory) {
      const kept = points.filter((p) => dayOf(p.date) >= cutoffDay);
      if (kept.length === 0) memoryHistory.delete(key);
      else memoryHistory.set(key, kept);
    }
    return;
  }
  for (let batch = 0; batch < PURGE_MAX_BATCHES_PER_TICK; batch++) {
    const result = await db
      .delete(priceHistory)
      .where(lt(priceHistory.date, cutoffDay))
      .limit(PURGE_BATCH_SIZE);
    const affected = Number(
      (result as { affectedRows?: unknown }).affectedRows ?? 0,
    );
    if (!Number.isFinite(affected) || affected < PURGE_BATCH_SIZE) break;
  }
}

export function clearHistoryForTests(): void {
  memoryHistory.clear();
}

function rowToPoint(row: PriceHistoryRow): PricePoint {
  return {
    date: new Date(row.fetchedAt).toISOString(),
    price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
    currency: row.currency,
    stockStatus: row.stockStatus as StockStatus,
  };
}
