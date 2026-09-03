import { PricePoint, DistributorListing } from "@/lib/types";
import { convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
// ─── Chart colors for up to 5 distributors ───────────────────────────────────
export const CHART_COLORS = [
  "#0F52BA",
  "#00C896",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
];

// ─── Time range options ───────────────────────────────────────────────────────
export type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "All";
export const TIME_RANGES: TimeRange[] = ["1W", "1M", "3M", "6M", "1Y", "All"];
export type SortBy = "trend" | "price" | "name";
export const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  All: 9999,
};

export function filterByRange(data: PricePoint[], range: TimeRange): PricePoint[] {
  if (range === "All") return data;
  const validDates = data
    .map((p) => new Date(p.date).getTime())
    .filter((t) => !Number.isNaN(t));
  if (validDates.length === 0) return [];
  const anchor = Math.min(Date.now(), Math.max(...validDates));
  const cutoff = anchor - TIME_RANGE_DAYS[range] * 86400000;
  return data.filter((p) => {
    const t = new Date(p.date).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
}

export interface RegionBest {
  region: string;
  listing: DistributorListing;
  usd: number;
  converted: number;
}

// Cheapest buyable listing per distributor region. Out-of-stock and
// non-positive prices are never selected; back-order wins only when a region
// has nothing in stock.
export function cheapestByRegion(
  listings: DistributorListing[],
  targetCurrency = "USD",
): RegionBest[] {
  const inStockMap = new Map<string, { listing: DistributorListing; converted: number; usd: number }>();
  const fallbackMap = new Map<string, { listing: DistributorListing; converted: number; usd: number }>();
  for (const l of listings) {
    if (l.stockStatus === "out_of_stock" || l.price <= 0) continue;
    const dist = getDistributorById(l.distributorId);
    if (!dist) continue;
    const region = dist.region ?? "Other";
    const converted = convertPrice(l.price, l.currency, targetCurrency);
    const usd = convertPrice(l.price, l.currency, "USD");
    if (converted === null || !Number.isFinite(converted)) continue;
    if (usd === null || !Number.isFinite(usd)) continue;
    if (l.stockStatus === "in_stock") {
      const existing = inStockMap.get(region);
      if (!existing || converted < existing.converted) {
        inStockMap.set(region, { listing: l, converted, usd });
      }
    } else {
      const existing = fallbackMap.get(region);
      if (!existing || converted < existing.converted) {
        fallbackMap.set(region, { listing: l, converted, usd });
      }
    }
  }
  const merged = new Map(inStockMap);
  for (const [region, data] of fallbackMap) {
    if (!merged.has(region)) merged.set(region, data);
  }
  return Array.from(merged.entries())
    .map(([region, data]) => ({ region, listing: data.listing, usd: data.usd, converted: data.converted }))
    .sort((a, b) => a.converted - b.converted);
}
