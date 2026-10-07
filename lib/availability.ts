import type { DistributorListing } from "./types";

export type Scarcity = "rare" | "occasional" | "common";

export function scarcityLabel(scarcity: Scarcity): string {
  return scarcity === "rare"
    ? "Rare"
    : scarcity === "occasional"
      ? "Occasional"
      : "Usually available";
}

/** Theme color token key for a scarcity level (resolved by the caller's useColors()). */
export function scarcityColorToken(
  scarcity: Scarcity,
): "error" | "warning" | "success" {
  return scarcity === "rare" ? "error" : scarcity === "occasional" ? "warning" : "success";
}

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
      // A day with only "unknown" observations carries no availability signal;
      // counting it as out-of-stock would render a false "Rare".
      if (point.stockStatus === "unknown") continue;
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
  for (let i = 0; i < days.length; i++) {
    if (days[i]!.inStock) continue;
    // Start of a non-in-stock run.
    let j = i;
    while (j + 1 < days.length && !days[j + 1]!.inStock) j++;
    const before = i > 0 ? days[i - 1]!.t : days[i]!.t;
    const after = j + 1 < days.length ? days[j + 1]!.t : days[j]!.t;
    const span = Math.round((after - before) / DAY_MS);
    if (span > longestOutageDays) longestOutageDays = span;
    i = j;
  }

  // Gaps between successive in-stock days that had an outage between them
  // (a run of consecutive in-stock days is one availability window, not a
  // restock). Measured in calendar days, so sparse samples report the real
  // elapsed span; only gaps with an intervening non-in-stock day count.
  const inStockDayIndices = days
    .map((d, i) => (d.inStock ? i : -1))
    .filter((i) => i >= 0);
  const gaps: number[] = [];
  for (let i = 1; i < inStockDayIndices.length; i++) {
    const prev = inStockDayIndices[i - 1]!;
    const curr = inStockDayIndices[i]!;
    if (curr - prev > 1) {
      gaps.push(Math.round((days[curr]!.t - days[prev]!.t) / DAY_MS));
    }
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
