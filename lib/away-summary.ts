import type { Product } from "./types";
import { getBestPrice } from "./currency";
import { bestPricePoints } from "./product-insights";

export interface AwayItem {
  productId: string;
  name: string;
  pct?: number;
  price?: number;
  currency?: string;
  distributorId?: string;
}

export interface AwaySummary {
  priceDrops: AwayItem[];
  priceRises: AwayItem[];
  restocks: AwayItem[];
  stockOuts: AwayItem[];
  since: number;
}

export function computeAwaySummary(input: {
  watchlist: Product[];
  since: number;
  now: number;
  displayCurrency: string;
  minDropPct?: number;
}): AwaySummary | null {
  const { watchlist, since, displayCurrency } = input;
  const minDropPct = input.minDropPct ?? 3;
  const priceDrops: AwayItem[] = [];
  const priceRises: AwayItem[] = [];
  const restocks: AwayItem[] = [];
  const stockOuts: AwayItem[] = [];

  for (const product of watchlist) {
    const listings = product.listings ?? [];

    const points = bestPricePoints(listings, displayCurrency);
    const before = [...points].reverse().find((p) => p.t <= since);
    const current = getBestPrice(listings, displayCurrency);
    if (before && current && before.v > 0) {
      const pct = ((current.price - before.v) / before.v) * 100;
      if (pct <= -minDropPct) {
        priceDrops.push({
          productId: product.id,
          name: product.name,
          pct,
          price: current.price,
          currency: current.currency,
        });
      } else if (pct >= minDropPct) {
        priceRises.push({
          productId: product.id,
          name: product.name,
          pct,
          price: current.price,
          currency: current.currency,
        });
      }
    }

    const historyByDistributor = new Map<string, typeof listings>();
    for (const listing of listings) {
      const group = historyByDistributor.get(listing.distributorId);
      if (group) group.push(listing);
      else historyByDistributor.set(listing.distributorId, [listing]);
    }
    for (const [distributorId, group] of historyByDistributor) {
      const history = group.flatMap((l) => l.priceHistory ?? []);
      const hadBefore = history.some((p) => Date.parse(p.date) <= since);
      if (!hadBefore) continue;
      const hadInStockBefore = history.some(
        (p) => p.stockStatus === "in_stock" && Date.parse(p.date) <= since,
      );
      const hasInStockAfter = history.some(
        (p) => p.stockStatus === "in_stock" && Date.parse(p.date) > since,
      );
      if (!hadInStockBefore && hasInStockAfter) {
        restocks.push({
          productId: product.id,
          name: product.name,
          distributorId,
        });
      } else if (hadInStockBefore && !hasInStockAfter) {
        stockOuts.push({
          productId: product.id,
          name: product.name,
          distributorId,
        });
      }
    }
  }

  if (
    priceDrops.length === 0 &&
    priceRises.length === 0 &&
    restocks.length === 0 &&
    stockOuts.length === 0
  ) {
    return null;
  }
  return { priceDrops, priceRises, restocks, stockOuts, since };
}
