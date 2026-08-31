import type { Product } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export interface WatchlistSummary {
  totalValue: number;
  listingCount: number;
  inStock: number;
  backOrder: number;
  outOfStock: number;
}

export function computeWatchlistSummary(
  watchlist: Product[],
  displayCurrency: string,
): WatchlistSummary {
  let totalValue = 0;
  let listingCount = 0;
  let inStock = 0;
  let backOrder = 0;
  let outOfStock = 0;

  for (const product of watchlist) {
    for (const listing of product.listings ?? []) {
      listingCount++;
      if (
        listing.price > 0 &&
        listing.currency &&
        hasExchangeRate(listing.currency) &&
        hasExchangeRate(displayCurrency)
      ) {
        const c = convertPrice(
          listing.price,
          listing.currency,
          displayCurrency,
        );
        if (c !== null) totalValue += c;
      }
      if (listing.stockStatus === "in_stock") inStock++;
      else if (listing.stockStatus === "back_order") backOrder++;
      else if (listing.stockStatus === "out_of_stock") outOfStock++;
    }
  }

  return { totalValue, listingCount, inStock, backOrder, outOfStock };
}
