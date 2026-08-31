// Exchange rates relative to USD (approximate, static for now)
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
  return { ...EXCHANGE_RATES, ...liveRates };
}

export function convertPrice(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number | null {
  const rates = effectiveRates();
  if (!(fromCurrency in rates) || !(toCurrency in rates)) return null;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate)) return null;
  if (fromRate === 0 || fromRate <= 0 || toRate <= 0) return null;
  return (amount / fromRate) * toRate;
}

export function hasExchangeRate(currency: string): boolean {
  return currency in effectiveRates();
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
