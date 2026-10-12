import type { Product } from "@/lib/types";
import { convertPrice } from "@/lib/currency";
import { formatPrice } from "@shared/currency";
import { isAutomaticProduct } from "./marketplace";

export interface PriceDrop {
  productId: string;
  productName: string;
  modelNumber: string;
  distributorId: string;
  distributorName: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
  dropPct: number;
  dropAbs: number;
  droppedAt: string;
}

export type DropWindow = "24h" | "7d" | "30d";
export type DropSortBy = "pct" | "abs";

function windowMs(window: DropWindow): number {
  switch (window) {
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d":  return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
  }
}

export function computeLocalDrops(
  products: Product[],
  window: DropWindow,
  displayCurrency: string,
  sortBy: DropSortBy = "pct",
  limit = 20,
): PriceDrop[] {
  const cutoff = Date.now() - windowMs(window);
  const drops: PriceDrop[] = [];

  for (const product of products) {
    if (!isAutomaticProduct(product)) continue;
    for (const listing of product.listings ?? []) {
      if (listing.priceSource === "manual") continue;
      const history = (listing.priceHistory ?? [])
        .filter((p) => !Number.isNaN(Date.parse(p.date)))
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

      if (history.length < 2) continue;

      const windowPoints = history.filter((p) => Date.parse(p.date) >= cutoff);
      if (windowPoints.length === 0) continue;

      const oldest = windowPoints[0];
      const newest = windowPoints[windowPoints.length - 1];

      const prevPrice = convertPrice(oldest.price, oldest.currency, displayCurrency);
      const currPrice = convertPrice(newest.price, newest.currency, displayCurrency);
      if (prevPrice == null || currPrice == null) continue;

      if (currPrice >= prevPrice) continue;

      const dropAbs = prevPrice - currPrice;
      const dropPct = prevPrice > 0 ? (dropAbs / prevPrice) * 100 : 0;

      drops.push({
        productId: product.id,
        productName: product.name ?? product.modelNumber,
        modelNumber: product.modelNumber,
        distributorId: listing.distributorId,
        distributorName: listing.distributorId,
        previousPrice: prevPrice,
        currentPrice: currPrice,
        currency: displayCurrency,
        dropPct,
        dropAbs,
        droppedAt: oldest.date,
      });
    }
  }

  const best = new Map<string, PriceDrop>();
  for (const drop of drops) {
    const key = `${drop.productId}:${drop.distributorId}`;
    const existing = best.get(key);
    if (!existing || drop.dropPct > existing.dropPct) {
      best.set(key, drop);
    }
  }

  const sorted = [...best.values()].sort((a, b) =>
    sortBy === "pct" ? b.dropPct - a.dropPct : b.dropAbs - a.dropAbs,
  );

  return sorted.slice(0, limit);
}

export function buildDropShareText(
  drops: PriceDrop[],
  window: DropWindow,
  sortBy: DropSortBy,
): string {
  const windowLabel = { "24h": "24h", "7d": "7d", "30d": "30d" }[window];
  const sortLabel = sortBy === "pct" ? "%" : "$";
  const lines = drops.slice(0, 10).map((d, i) => {
    const pct = `\u2212${d.dropPct.toFixed(0)}%`;
    const abs = `\u2212${formatPrice(d.dropAbs, d.currency)}`;
    return `${i + 1}. ${d.productName} (${d.distributorName}) \u2014 ${formatPrice(d.previousPrice, d.currency)} \u2192 ${formatPrice(d.currentPrice, d.currency)} (${pct}, ${abs})`;
  });
  return `\ud83d\udcc9 Price Drops (${windowLabel}, by ${sortLabel})\n${lines.join("\n")}\n\nvia Product Stock Finder`;
}
