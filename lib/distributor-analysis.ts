import type { Product } from "./types";
import { DISTRIBUTORS } from "./distributors";
import { convertPrice } from "./currency";

export interface DistributorAnalysis {
  distributorId: string;
  coverage: number;
  totalCost: number;
  averagePrice: number;
}

export function analyzeDistributors(
  watchlist: Product[],
  displayCurrency: string,
): DistributorAnalysis[] {
  const results: DistributorAnalysis[] = [];

  for (const distributor of DISTRIBUTORS) {
    let coverage = 0;
    let totalCost = 0;

    for (const product of watchlist) {
      const listings = (product.listings ?? []).filter(
        (l) =>
          l.distributorId === distributor.id &&
          l.stockStatus !== "out_of_stock" &&
          l.price > 0,
      );
      if (listings.length === 0) continue;
      // Use the cheapest in-stock listing for deterministic totals
      const cheapest = listings.reduce((best, l) =>
        convertPrice(l.price, l.currency, displayCurrency) <
        convertPrice(best.price, best.currency, displayCurrency)
          ? l
          : best,
      );
      coverage++;
      totalCost += convertPrice(cheapest.price, cheapest.currency, displayCurrency);
    }

    if (coverage > 0) {
      results.push({
        distributorId: distributor.id,
        coverage,
        totalCost,
        averagePrice: totalCost / coverage,
      });
    }
  }

  return results.sort((a, b) => a.totalCost - b.totalCost);
}
