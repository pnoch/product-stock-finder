import type { DistributorListing } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export interface PriceVsAverage {
  current: number;
  average: number;
  percentVsAvg: number;
  verdict: "below" | "at" | "above";
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

export function computePriceVsAverage(
  listings: DistributorListing[],
  displayCurrency: string,
  windowDays = 30,
  now = Date.now(),
): PriceVsAverage | null {
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;

  const inStockPrices = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => convert(l.price, l.currency, displayCurrency))
    .filter((v): v is number => v !== null);
  if (inStockPrices.length === 0) return null;
  const current = Math.min(...inStockPrices);

  const points = listings
    .flatMap((l) => l.priceHistory ?? [])
    .map((p) => ({
      t: Date.parse(p.date),
      v: convert(p.price, p.currency, displayCurrency),
    }))
    .filter((p) => Number.isFinite(p.t) && p.t >= cutoff && p.v !== null)
    .map((p) => p.v!);
  if (points.length < 2) return null;

  const average = points.reduce((s, v) => s + v, 0) / points.length;
  const percentVsAvg =
    Math.round(((current - average) / average) * 1000) / 10;
  const verdict: PriceVsAverage["verdict"] =
    percentVsAvg <= -3 ? "below" : percentVsAvg >= 3 ? "above" : "at";

  return { current, average, percentVsAvg, verdict };
}
