import type { DistributorListing } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export type DealBand = "hot" | "fair" | "wait";

export interface DealScore {
  score: number;
  band: "hot" | "fair" | "wait";
  factors: { range: number; trend: number; streak: number; volatility: number };
}

const RANGE_DAYS = 90;
const TREND_DAYS = 30;
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 14;
const HOT_CUTOFF = 75;
const FAIR_CUTOFF = 40;

interface Point {
  t: number;
  v: number;
}

// Mirrors lib/product-insights.ts convert (private there, not exported):
// guards non-positive prices and unknown currencies before converting.
function convert(price: number, currency: string, target: string): number | null {
  if (!(price > 0)) return null;
  if (!currency || !hasExchangeRate(currency) || !hasExchangeRate(target)) {
    return null;
  }
  return convertPrice(price, currency, target);
}

// Mirrors lib/product-insights.ts grouping (private there, not exported):
// groups converted history by timestamp and averages collisions so
// interleaved distributors don't create phantom volatility. Sorted by time.
function mergedPoints(listings: DistributorListing[], currency: string): Point[] {
  const pointsByTime = new Map<number, number[]>();
  for (const l of listings ?? []) {
    for (const p of l.priceHistory ?? []) {
      const t = Date.parse(p.date);
      const v = convert(p.price, p.currency, currency);
      if (!Number.isFinite(t) || v === null) continue;
      const arr = pointsByTime.get(t);
      if (arr) arr.push(v);
      else pointsByTime.set(t, [v]);
    }
  }
  return Array.from(pointsByTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, vs]) => ({
      t,
      v: vs.reduce((s, x) => s + x, 0) / vs.length,
    }));
}

// Mirrors lib/product-insights.ts trailing-decline loop (inline there).
function dropStreak(values: number[]): number {
  let streak = 0;
  for (let i = values.length - 1; i > 0; i--) {
    if (values[i] < values[i - 1]) streak += 1;
    else break;
  }
  return streak;
}

export function computeDealScore(
  listings: DistributorListing[],
  currency: string,
): DealScore | null {
  const points = mergedPoints(listings, currency);
  if (points.length < MIN_POINTS) return null;
  const spanDays = (points[points.length - 1].t - points[0].t) / 86400000;
  if (spanDays < MIN_SPAN_DAYS) return null;
  const window = points.filter(
    (p) => p.t >= points[points.length - 1].t - RANGE_DAYS * 86400000,
  );
  const values = window.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const current = values[values.length - 1];
  const range = hi > lo ? ((hi - current) / (hi - lo)) * 50 : 25;
  const cutoff = points[points.length - 1].t - TREND_DAYS * 86400000;
  const recent = points.filter((p) => p.t >= cutoff).map((p) => p.v);
  const first = recent[0] ?? current;
  const move = first > 0 ? ((current - first) / first) * 100 : 0;
  const trend = move <= -5 ? 30 : move >= 5 ? 0 : 30 * (1 - (move + 5) / 10);
  const streak = dropStreak(values);
  const streakScore = Math.min(streak, 3) / 3;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const volatility = Math.min(cv / 0.3, 1) * 10;
  const score = Math.round(
    Math.max(0, Math.min(100, range + trend + streakScore * 10 - volatility)),
  );
  return {
    score,
    band: score >= HOT_CUTOFF ? "hot" : score >= FAIR_CUTOFF ? "fair" : "wait",
    factors: {
      range: Math.round(range),
      trend: Math.round(trend),
      streak: Math.round(streakScore * 10),
      volatility: Math.round(volatility),
    },
  };
}
