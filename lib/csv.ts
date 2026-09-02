import type { Product } from "./types";
import { formatPrice, getBestPrice } from "./currency";

const HEADER = "product,model,brand,category,bestPrice,stockStatus";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function resolveStockStatus(product: Product): string {
  const listings = product.listings ?? [];
  if (listings.length === 0) return "unknown";
  let hasInStock = false;
  let hasBackOrder = false;
  let hasOutOfStock = false;
  let hasUnknown = false;
  for (const l of listings) {
    if (l.stockStatus === "in_stock") hasInStock = true;
    else if (l.stockStatus === "back_order") hasBackOrder = true;
    else if (l.stockStatus === "out_of_stock") hasOutOfStock = true;
    else hasUnknown = true;
  }
  if (hasInStock) return "in_stock";
  if (hasBackOrder) return "back_order";
  if (hasOutOfStock) return "out_of_stock";
  if (hasUnknown) return "unknown";
  return "unknown";
}

export function watchlistToCsv(products: Product[], currency: string): string {
  const lines: string[] = [HEADER];
  for (const p of products) {
    const best = getBestPrice(p.listings ?? [], currency);
    const bestPrice = best ? formatPrice(best.price, currency) : "";
    const status = resolveStockStatus(p);
    const row = [
      escapeCsv(p.name ?? ""),
      escapeCsv(p.modelNumber ?? ""),
      escapeCsv(p.brand ?? ""),
      escapeCsv(p.category ?? ""),
      escapeCsv(bestPrice),
      escapeCsv(status),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}
