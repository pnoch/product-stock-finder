import type { AvailableProduct, Product } from "./types";
import { getBestPrice } from "./currency";

export interface Alternative {
  id: string;
  name: string;
  brand: string;
  modelNumber: string;
  bestPrice: number;
  bestCurrency: string;
  storeCount: number;
}

export function pickAlternatives(input: {
  product: { id: string; category: string };
  available: AvailableProduct[];
  limit?: number;
}): Alternative[] {
  const limit = input.limit ?? 5;
  return input.available
    .filter(
      (a) => a.category === input.product.category && a.id !== input.product.id,
    )
    .sort((a, b) => a.bestPrice - b.bestPrice)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      name: a.name,
      brand: a.brand,
      modelNumber: a.modelNumber,
      bestPrice: a.bestPrice,
      bestCurrency: a.bestCurrency,
      storeCount: a.storeCount,
    }));
}

export function localAlternatives(
  product: { id: string; category: string },
  watchlist: Product[],
  displayCurrency: string,
  limit = 5,
): Alternative[] {
  const out: Alternative[] = [];
  for (const p of watchlist) {
    if (p.id === product.id || p.category !== product.category) continue;
    const inStock = (p.listings ?? []).filter(
      (l) => l.stockStatus === "in_stock",
    );
    if (inStock.length === 0) continue;
    const best = getBestPrice(inStock, displayCurrency);
    if (!best) continue;
    out.push({
      id: p.id,
      name: p.name,
      brand: p.brand,
      modelNumber: p.modelNumber,
      bestPrice: best.price,
      bestCurrency: best.currency,
      storeCount: inStock.length,
    });
  }
  return out.sort((a, b) => a.bestPrice - b.bestPrice).slice(0, limit);
}
