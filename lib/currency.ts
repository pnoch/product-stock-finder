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
  return currency in effectiveRates();
}

export function getExchangeRate(currency: string): number | null {
  const rates = effectiveRates();
  return rates[currency] ?? null;
}

export function getBestPrice(
  listings: { price: number; currency: string; stockStatus: string }[],
  displayCurrency: string,
): { price: number; currency: string } | null {
  const available = listings.filter((l) => l.stockStatus !== "out_of_stock" && l.price > 0);
  if (!available.length) return null;
  const converted = available
    .map((l) => {
      const price = convertPrice(l.price, l.currency, displayCurrency);
      return price === null ? null : { price, currency: displayCurrency };
    })
    .filter((v): v is { price: number; currency: string } => v !== null);
  if (!converted.length) return null;
  return converted.reduce((best, curr) => (curr.price < best.price ? curr : best));
}
