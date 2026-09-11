import { SAMPLE_LISTINGS } from "./sample-data";

export const PREVIEW_LIMIT = 10;

export function previewStockScore(productId: string): number {
  const listings = SAMPLE_LISTINGS[productId] ?? [];
  if (listings.length === 0) return 0;
  const inStock = listings.filter((l) => l.stockStatus === "in_stock").length;
  // Weight in-stock heavily, then total listings
  return inStock * 10 + listings.length;
}

export function sortPreviewByStock<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => previewStockScore(b.id) - previewStockScore(a.id));
}
