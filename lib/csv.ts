import type { PricePoint, Product } from "./types";
import { formatPrice, getBestPrice } from "./currency";

const SUMMARY_HEADER = "product,model,brand,category,bestPrice,stockStatus";
const LISTINGS_HEADER = "product,model,brand,category,distributor,price,currency,stockStatus,url";
const HISTORY_HEADER = "product,model,date,price,currency,stockStatus";

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
  const lines: string[] = [SUMMARY_HEADER];
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

export function watchlistToSummaryCsv(products: Product[], currency: string): string {
  return watchlistToCsv(products, currency);
}

export function watchlistToDetailedCsv(products: Product[]): string {
  const lines: string[] = [LISTINGS_HEADER];
  for (const p of products) {
    const listings = p.listings ?? [];
    if (listings.length === 0) {
      const row = [
        escapeCsv(p.name ?? ""),
        escapeCsv(p.modelNumber ?? ""),
        escapeCsv(p.brand ?? ""),
        escapeCsv(p.category ?? ""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv("unknown"),
        escapeCsv(""),
      ].join(",");
      lines.push(row);
      continue;
    }
    for (const l of listings) {
      const row = [
        escapeCsv(p.name ?? ""),
        escapeCsv(p.modelNumber ?? ""),
        escapeCsv(p.brand ?? ""),
        escapeCsv(p.category ?? ""),
        escapeCsv(l.distributorId ?? ""),
        escapeCsv(l.price ? String(l.price) : ""),
        escapeCsv(l.currency ?? ""),
        escapeCsv(l.stockStatus ?? "unknown"),
        escapeCsv(l.url ?? ""),
      ].join(",");
      lines.push(row);
    }
  }
  return lines.join("\n");
}

export function priceHistoryToCsv(history: PricePoint[], product: Pick<Product, "name" | "modelNumber">): string {
  const lines: string[] = [HISTORY_HEADER];
  for (const pt of history) {
    const row = [
      escapeCsv(product.name ?? ""),
      escapeCsv(product.modelNumber ?? ""),
      escapeCsv(pt.date ?? ""),
      escapeCsv(String(pt.price ?? "")),
      escapeCsv(pt.currency ?? ""),
      escapeCsv(pt.stockStatus ?? "unknown"),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}
