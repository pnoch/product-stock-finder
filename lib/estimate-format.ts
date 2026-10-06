import { CURRENCY_SYMBOLS } from "@shared/currency";

/**
 * A clearly-approximate money string for estimated figures (shipping, landed
 * total). The `~` and `est.` markers exist so an estimate is never mistaken for
 * a firm quote — the exact rate is only known at the store's checkout.
 */
export function formatEstimate(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "N/A";
  const rounded = Math.round(amount);
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const gap = /^[A-Z]{3}$/.test(symbol) ? " " : "";
  return `~${symbol}${gap}${rounded} est.`;
}
