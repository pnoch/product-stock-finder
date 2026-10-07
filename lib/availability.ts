import type { DistributorListing } from "./types";

export type Scarcity = "rare" | "occasional" | "common";

export interface Availability {
  inStockRate: number;
  lastInStockAt: number | null;
  longestOutageDays: number;
  typicalRestockDays: number | null;
  sampleDays: number;
  scarcity: Scarcity;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLE_DAYS = 7;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function computeAvailability(
  listings: DistributorListing[],
  now = Date.now(),
  windowDays = 90,
): Availability | null {
  const cutoff = now - windowDays * DAY_MS;
  const byDay = new Map<string, boolean>();
  let lastInStockAt: number | null = null;
  for (const listing of listings) {
    for (const point of listing.priceHistory ?? []) {
      const t = Date.parse(point.date);
      if (!Number.isFinite(t) || t < cutoff) continue;
      const key = point.date.slice(0, 10);
      const inStock = point.stockStatus === "in_stock";
      byDay.set(key, (byDay.get(key) ?? false) || inStock);
      if (inStock && (lastInStockAt === null || t > lastInStockAt)) {
        lastInStockAt = t;
      }
    }
  }
  const sampleDays = byDay.size;
  if (sampleDays < MIN_SAMPLE_DAYS) return null;

  const days = [...byDay.entries()]
    .map(([key, inStock]) => ({ t: Date.parse(`${key}T00:00:00.000Z`), inStock }))
    .sort((a, b) => a.t - b.t);

  const inStockDays = days.filter((d) => d.inStock).length;
  const inStockRate = inStockDays / sampleDays;

  let longestOutageDays = 0;
  let run = 0;
  for (const d of days) {
    if (d.inStock) {
      run = 0;
    } else {
      run += 1;
      if (run > longestOutageDays) longestOutageDays = run;
    }
  }

  // Gaps between successive in-stock days that had an outage between them (a
  // run of consecutive in-stock days is one availability window, not a
  // restock). Median of those gaps is the observed restock cadence.
  const inStockDayIndices = days
    .map((d, i) => (d.inStock ? i : -1))
    .filter((i) => i >= 0);
  const gaps: number[] = [];
  for (let i = 1; i < inStockDayIndices.length; i++) {
    const gap = inStockDayIndices[i]! - inStockDayIndices[i - 1]!;
    if (gap > 1) gaps.push(gap);
  }
  const typicalRestockDays = gaps.length > 0 ? median(gaps) : null;

  const scarcity: Scarcity =
    inStockRate < 0.15 ? "rare" : inStockRate < 0.5 ? "occasional" : "common";

  return {
    inStockRate,
    lastInStockAt,
    longestOutageDays,
    typicalRestockDays,
    sampleDays,
    scarcity,
  };
}
