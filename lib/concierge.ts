import type { Product } from "@/lib/types";
import { getBestPrice } from "@/lib/currency";

/** Default alert = 10% under current best in-stock price, rounded to 2dp. Null when no price. */
export function defaultAlertTarget(
  product: Product,
  displayCurrency: string,
): { targetPrice: number; currency: string } | null {
  const best = getBestPrice(product.listings ?? [], displayCurrency);
  if (!best) return null;
  const target = Math.round(best.price * 0.9 * 100) / 100;
  if (!(target > 0)) return null;
  return { targetPrice: target, currency: best.currency };
}

/** Clamp multi-select to max 5, preserving order, deduped by id. */
export function clampSelection(ids: string[], max = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
