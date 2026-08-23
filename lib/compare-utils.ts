import { PricePoint } from "@/lib/types";

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
