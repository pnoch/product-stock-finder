import type { Product } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export interface ProductInsight {
  productId: string;
  name: string;
  atAllTimeLow: boolean;
  dropStreak: number;
  volatility: "low" | "medium" | "high" | null;
}

export interface ProductInsightsResult {
  products: ProductInsight[];
  allTimeLows: number;
  droppingCount: number;
  volatility: { low: number; medium: number; high: number };
}

function convert(
  price: number,
  currency: string,
  displayCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (
    !currency ||
    !hasExchangeRate(currency) ||
    !hasExchangeRate(displayCurrency)
  ) {
    return null;
  }
  return convertPrice(price, currency, displayCurrency);
}

export function computeProductInsights(
  watchlist: Product[],
  displayCurrency: string,
): ProductInsightsResult {
  const products: ProductInsight[] = [];
  let allTimeLows = 0;
  let droppingCount = 0;
  const volatility = { low: 0, medium: 0, high: 0 };

  for (const product of watchlist) {
    // Group by timestamp and average to avoid phantom volatility from
    // interleaving multiple distributors' prices at the same time or
    // mixing currencies without aggregation.
    const pointsByTime = new Map<number, number[]>();
    for (const l of product.listings ?? []) {
      for (const p of l.priceHistory ?? []) {
        const t = Date.parse(p.date);
        const v = convert(p.price, p.currency, displayCurrency);
        if (!Number.isFinite(t) || v === null) continue;
        const arr = pointsByTime.get(t);
        if (arr) arr.push(v);
        else pointsByTime.set(t, [v]);
      }
    }
    const points = Array.from(pointsByTime.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, vs]) => vs.reduce((s, v) => s + v, 0) / vs.length);

    const inStockPrices = product.listings
      .filter((l) => l.stockStatus === "in_stock")
      .map((l) => convert(l.price, l.currency, displayCurrency))
      .filter((v): v is number => v !== null);

    const currentBest =
      inStockPrices.length > 0 ? Math.min(...inStockPrices) : null;

    const atAllTimeLow =
      points.length > 0 &&
      currentBest !== null &&
      Math.abs(currentBest - Math.min(...points)) < 0.01;

    let dropStreak = 0;
    for (let i = points.length - 1; i > 0; i--) {
      if (points[i] < points[i - 1]) dropStreak += 1;
      else break;
    }

    let vol: ProductInsight["volatility"] = null;
    if (points.length >= 3) {
      const mean = points.reduce((s, v) => s + v, 0) / points.length;
      const variance =
        points.reduce((s, v) => s + (v - mean) ** 2, 0) / points.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      vol = cv < 0.05 ? "low" : cv < 0.15 ? "medium" : "high";
      volatility[vol] += 1;
    }

    if (atAllTimeLow) allTimeLows += 1;
    if (dropStreak >= 2) droppingCount += 1;

    products.push({
      productId: product.id,
      name: product.name,
      atAllTimeLow,
      dropStreak,
      volatility: vol,
    });
  }

  return { products, allTimeLows, droppingCount, volatility };
}
