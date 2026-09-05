// Pure currency module — no side-effects, no AsyncStorage.
// Re-exported by lib/currency.ts which adds the live-rate overlay (setExchangeRates).

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  MYR: 4.47,
  AUD: 1.53,
  NZD: 1.65,
  CAD: 1.36,
  ZAR: 18.2,
  THB: 34.5,
  SGD: 1.34,
  HKD: 7.82,
  AED: 3.67,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  MYR: "RM",
  AUD: "A$",
  NZD: "NZ$",
  CAD: "C$",
  ZAR: "R",
  THB: "฿",
  SGD: "S$",
  HKD: "HK$",
  AED: "AED",
};

export const CURRENCIES: string[] = Object.keys(EXCHANGE_RATES);

// Single source: shared/src/fx.ts (server/fx.ts re-exports it too).
export { FX_TTL_MS } from "./fx";

export function convertPrice(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!(fromCurrency in EXCHANGE_RATES) || !(toCurrency in EXCHANGE_RATES)) return null;
  const fromRate = EXCHANGE_RATES[fromCurrency];
  const toRate = EXCHANGE_RATES[toCurrency];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate)) return null;
  if (fromRate <= 0 || toRate <= 0) return null;
  return (amount / fromRate) * toRate;
}

export function hasExchangeRate(currency: string): boolean {
  return currency in EXCHANGE_RATES;
}

export function getExchangeRate(currency: string): number | null {
  return EXCHANGE_RATES[currency] ?? null;
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function formatPrice(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "N/A";
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getBestPrice(
  listings: { price: number; currency: string; stockStatus: string }[],
  displayCurrency: string,
): { price: number; currency: string } | null {
  const available = listings.filter(
    (l) => l.stockStatus !== "out_of_stock" && l.price > 0,
  );
  if (!available.length) return null;
  const converted = available
    .map((l) => {
      const price = convertPrice(l.price, l.currency, displayCurrency);
      return price === null ? null : { price, currency: displayCurrency };
    })
    .filter((v): v is { price: number; currency: string } => v !== null);
  if (!converted.length) return null;
  return converted.reduce((best, curr) =>
    curr.price < best.price ? curr : best,
  );
}
