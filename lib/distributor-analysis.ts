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
      const listing = (product.listings ?? []).find(
        (l) =>
          l.distributorId === distributor.id &&
          l.stockStatus !== "out_of_stock" &&
          l.price > 0,
      );
      if (listing) {
        coverage++;
        totalCost += convertPrice(listing.price, listing.currency, displayCurrency);
      }
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
