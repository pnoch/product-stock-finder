import { PricePoint, DistributorListing } from "@/lib/types";
import { convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";

// ─── Chart colors for up to 5 distributors ───────────────────────────────────
export const CHART_COLORS = [
  "#0a7ea4",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
];

// ─── Time range options ───────────────────────────────────────────────────────
export type TimeRange = "1W" | "1M" | "3M" | "All";
export const TIME_RANGES: TimeRange[] = ["1W", "1M", "3M", "All"];
export type SortBy = "trend" | "price" | "name";
export const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  All: 9999,
};

export function filterByRange(data: PricePoint[], range: TimeRange): PricePoint[] {
  if (range === "All") return data;
  const cutoff = Date.now() - TIME_RANGE_DAYS[range] * 86400000;
  return data.filter((p) => new Date(p.date).getTime() >= cutoff);
}

export interface RegionBest {
  region: string;
  listing: DistributorListing;
  usd: number;
}

// Cheapest buyable listing per distributor region. Out-of-stock and
// non-positive prices are never selected; back-order wins only when a region
// has nothing in stock.
export function cheapestByRegion(
  listings: DistributorListing[],
): RegionBest[] {
  const map = new Map<string, { listing: DistributorListing; usd: number }>();
  for (const l of listings) {
    if (l.stockStatus === "out_of_stock" || l.price <= 0) continue;
    const dist = getDistributorById(l.distributorId);
    if (!dist) continue;
    const region = dist.region ?? "Other";
    const usd = convertPrice(l.price, l.currency, "USD");
    if (!Number.isFinite(usd)) continue;
    const existing = map.get(region);
    if (!existing || usd < existing.usd) {
      map.set(region, { listing: l, usd });
    }
  }
  return Array.from(map.entries())
    .map(([region, data]) => ({ region, ...data }))
    .sort((a, b) => a.usd - b.usd);
}
