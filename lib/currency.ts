// Live-rate currency layer over @shared/currency: mutable FX overlay
// (setExchangeRates) + conversions. Pure formatting/constants live in
// @shared/currency — import those directly.
import { EXCHANGE_RATES } from "@shared/currency";

let liveRates: Record<string, number> | null = null;

export function setExchangeRates(rates: Record<string, number> | null): void {
  if (rates === null) {
    liveRates = null;
    return;
  }
  const filtered: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    if (Number.isFinite(v) && v > 0) filtered[k] = v;
  }
  liveRates = Object.keys(filtered).length > 0 ? filtered : null;
}

function effectiveRates(): Record<string, number> {
  return { ...EXCHANGE_RATES, ...(liveRates ?? {}) };
}

export function convertPrice(amount: number, fromCurrency: string, toCurrency: string): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const rates = effectiveRates();
  if (!(fromCurrency in rates) || !(toCurrency in rates)) return null;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate)) return null;
  if (fromRate <= 0 || toRate <= 0) return null;
  return (amount / fromRate) * toRate;
}

export function hasExchangeRate(currency: string): boolean {
  // Own-property check: `in` would accept prototype keys like "toString".
  return Object.prototype.hasOwnProperty.call(effectiveRates(), currency);
}

// Money is displayed and compared at 2 decimals. Rounding at the comparison
// boundary (not inside convertPrice, which feeds arithmetic chains) keeps
// best-price selection stable and the returned value display-ready.
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function getExchangeRate(currency: string): number | null {
  const rates = effectiveRates();
  if (!Object.prototype.hasOwnProperty.call(rates, currency)) return null;
  const rate = rates[currency];
  return typeof rate === "number" ? rate : null;
}

export type StockFilter = "orderable" | "in_stock" | "any";

/**
 * The one best-listing selector. `orderable` accepts in_stock + back_order
 * (the app's default for digest/basket/sort decisions); `in_stock` is for
 * Buy/alert paths that must not crown a back-order; `any` preserves callers
 * that pre-filter their own list.
 */
export function selectBestListing<
  T extends {
    price: number;
    currency: string;
    stockStatus: string;
    url?: string;
  },
>(
  listings: T[],
  opts: { currency: string; stock?: StockFilter; requireUrl?: boolean },
): { listing: T; price: number } | null {
  const stock = opts.stock ?? "orderable";
  let best: { listing: T; price: number } | null = null;
  for (const listing of listings) {
    if (!(listing.price > 0)) continue;
    if (
      stock === "orderable" &&
      listing.stockStatus !== "in_stock" &&
      listing.stockStatus !== "back_order"
    ) {
      continue;
    }
    if (stock === "in_stock" && listing.stockStatus !== "in_stock") continue;
    if (opts.requireUrl && !listing.url) continue;
    const converted = convertPrice(
      listing.price,
      listing.currency,
      opts.currency,
    );
    if (converted === null || !Number.isFinite(converted)) continue;
    const price = roundMoney(converted);
    if (!best || price < best.price) best = { listing, price };
  }
  return best;
}

// Cheapest purchasable listing: in_stock and back_order are orderable, while
// out_of_stock is unavailable and unknown-availability must not anchor digest,
// basket, or sort decisions. Alert detection (price-check.ts) independently
// restricts to in_stock.
export function getBestPrice(
  listings: { price: number; currency: string; stockStatus: string }[],
  displayCurrency: string,
): { price: number; currency: string } | null {
  const best = selectBestListing(listings, {
    currency: displayCurrency,
    stock: "orderable",
  });
  return best ? { price: best.price, currency: displayCurrency } : null;
}
