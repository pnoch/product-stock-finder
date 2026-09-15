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

// Cheapest purchasable listing: in_stock and back_order are orderable, while
// out_of_stock is unavailable and unknown-availability must not anchor digest,
// basket, or sort decisions. Alert detection (price-check.ts) independently
// restricts to in_stock.
export function getBestPrice(
  listings: { price: number; currency: string; stockStatus: string }[],
  displayCurrency: string,
): { price: number; currency: string } | null {
  const available = listings.filter(
    (l) =>
      (l.stockStatus === "in_stock" || l.stockStatus === "back_order") &&
      l.price > 0,
  );
  if (!available.length) return null;
  const converted = available
    .map((l) => {
      const price = convertPrice(l.price, l.currency, displayCurrency);
      return price === null
        ? null
        : { price: roundMoney(price), currency: displayCurrency };
    })
    .filter((v): v is { price: number; currency: string } => v !== null);
  if (!converted.length) return null;
  return converted.reduce((best, curr) => (curr.price < best.price ? curr : best));
}
