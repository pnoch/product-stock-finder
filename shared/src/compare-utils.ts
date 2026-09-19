import type { PricePoint, DistributorListing } from "@/lib/types";
import { convertPrice } from "./currency";
import { getDistributorById } from "./distributors";
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
// `convert` is injectable so callers can pass the live-rate converter
// (`@/lib/currency` overlays server FX rates). Defaulting to the static shared
// converter made this card rank regions with stale rates while the prices
// rendered beside it used live ones, so the "cheapest region" could be wrong.
export function cheapestByRegion(
  listings: DistributorListing[],
  targetCurrency = "USD",
  convert: (amount: number, from: string, to: string) => number | null = convertPrice,
): RegionBest[] {
  const inStockMap = new Map<string, { listing: DistributorListing; converted: number; usd: number }>();
  const fallbackMap = new Map<string, { listing: DistributorListing; converted: number; usd: number }>();
  for (const l of listings) {
    // Only orderable statuses: unknown availability must not anchor a
    // "cheapest region" recommendation (matches getBestPrice).
    if (
      (l.stockStatus !== "in_stock" && l.stockStatus !== "back_order") ||
      l.price <= 0
    ) {
      continue;
    }
    const dist = getDistributorById(l.distributorId);
    if (!dist) continue;
    const region = dist.region ?? "Other";
    const converted = convert(l.price, l.currency, targetCurrency);
    const usd = convert(l.price, l.currency, "USD");
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
