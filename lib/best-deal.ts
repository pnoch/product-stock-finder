import type { DistributorListing } from "./types";
import { getDistributorById } from "./distributors";
import { convertPrice } from "./currency";

export interface BestDeal {
  distributorId: string;
  price: number;
  shipping: number;
  total: number;
  currency: string;
}

export function findBestDeal(
  listings: DistributorListing[],
  destinationRegion: string,
  displayCurrency: string,
): BestDeal | null {
  let best: BestDeal | null = null;

  for (const listing of listings) {
    if (listing.stockStatus !== "in_stock" || listing.price <= 0) continue;
    const distributor = getDistributorById(listing.distributorId);
    if (!distributor?.shippingCosts) continue;
    const shippingCost = distributor.shippingCosts[destinationRegion];
    if (shippingCost == null) continue;

    const price = convertPrice(listing.price, listing.currency, displayCurrency);
    // Shipping is denominated in the distributor's native currency
    const shipping = convertPrice(shippingCost, distributor.currency, displayCurrency);
    const total = price + shipping;

    if (!best || total < best.total) {
      best = {
        distributorId: listing.distributorId,
        price,
        shipping,
        total,
        currency: displayCurrency,
      };
    }
  }

  return best;
}
