import type { DistributorListing } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export type SuggestionKey = "near_low" | "below_avg" | "under_current";

export interface AlertSuggestion {
  key: SuggestionKey;
  label: string;
  price: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_MS = 30 * DAY_MS;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function convert(
  price: number,
  fromCurrency: string,
  targetCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (
    !fromCurrency ||
    !hasExchangeRate(fromCurrency) ||
    !hasExchangeRate(targetCurrency)
  ) {
    return null;
  }
  return convertPrice(price, fromCurrency, targetCurrency);
}

// Alerts are product-wide (best price across distributors triggers), so all
// strategies are computed over every listing's data merged together.
export function suggestAlertPrices(
  listings: DistributorListing[],
  currency: string,
  now: number = Date.now(),
): AlertSuggestion[] {
  const candidates: AlertSuggestion[] = [];

  const allPoints = listings.flatMap((l) => l.priceHistory ?? []);
  const convertedPoints = allPoints
    .map((p) => convert(p.price, p.currency, currency))
    .filter((v): v is number => v !== null);

  if (convertedPoints.length > 0) {
    candidates.push({
      key: "near_low",
      label: "Near low",
      price: round2(Math.min(...convertedPoints)),
    });

    const recent = allPoints
      .filter((p) => {
        const t = Date.parse(p.date);
        return Number.isFinite(t) && now - t <= RECENT_WINDOW_MS;
      })
      .map((p) => convert(p.price, p.currency, currency))
      .filter((v): v is number => v !== null);
    if (recent.length > 0) {
      const mean = recent.reduce((sum, v) => sum + v, 0) / recent.length;
      candidates.push({
        key: "below_avg",
        label: "Below avg",
        price: round2(mean * 0.9),
      });
    }
  }

  const inStockPrices = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => convert(l.price, l.currency, currency))
    .filter((v): v is number => v !== null);
  if (inStockPrices.length > 0) {
    candidates.push({
      key: "under_current",
      label: "Under current",
      price: round2(Math.min(...inStockPrices) * 0.95),
    });
  }

  const seen = new Set<number>();
  return candidates.filter((c) => {
    if (c.price <= 0 || seen.has(c.price)) return false;
    seen.add(c.price);
    return true;
  });
}
