import type { PRODUCT_CATALOG } from "../shared/src/catalog.js";
import { convertPrice } from "../shared/src/currency.js";
import type { AvailableProduct } from "../lib/types";

export type { AvailableProduct };

interface CacheRow {
  distributorId: string;
  modelNumber: string;
  price: number;
  currency: string;
  stockStatus: string;
  fetchedAt: number;
}

export function groupAvailable(
  rows: CacheRow[],
  catalog: typeof PRODUCT_CATALOG,
  currency: string,
): AvailableProduct[] {
  const byModel = new Map<string, CacheRow[]>();
  for (const row of rows) {
    if (row.stockStatus !== "in_stock") continue;
    const list = byModel.get(row.modelNumber) ?? [];
    list.push(row);
    byModel.set(row.modelNumber, list);
  }
  const out: AvailableProduct[] = [];
  for (const [modelNumber, modelRows] of byModel) {
    const product = catalog.find((p) => p.modelNumber === modelNumber);
    if (!product) continue;
    let best: { price: number; distributorId: string; fetchedAt: number } | null = null;
    const stores = new Set<string>();
    for (const row of modelRows) {
      const converted = convertPrice(row.price, row.currency, currency);
      if (converted === null) continue;
      stores.add(row.distributorId);
      if (!best || converted < best.price) {
        best = { price: converted, distributorId: row.distributorId, fetchedAt: row.fetchedAt };
      }
    }
    if (!best) continue;
    out.push({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      modelNumber,
      bestPrice: best.price,
      bestCurrency: currency,
      bestDistributorId: best.distributorId,
      storeCount: stores.size,
      fetchedAt: best.fetchedAt,
    });
  }
  return out.sort((a, b) => a.bestPrice - b.bestPrice);
}
