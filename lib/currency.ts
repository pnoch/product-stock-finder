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

export function convertPrice(amount: number, fromCurrency: string, toCurrency: string): number {
  const fromRate = EXCHANGE_RATES[fromCurrency] ?? 1;
  const toRate = EXCHANGE_RATES[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}

export function formatPrice(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getBestPrice(listings: { price: number; currency: string; stockStatus: string }[], displayCurrency: string): { price: number; currency: string } | null {
  const available = listings.filter((l) => l.stockStatus !== "out_of_stock" && l.price > 0);
  if (!available.length) return null;
  const converted = available.map((l) => ({
    price: convertPrice(l.price, l.currency, displayCurrency),
    currency: displayCurrency,
  }));
  return converted.reduce((best, curr) => (curr.price < best.price ? curr : best));
}

