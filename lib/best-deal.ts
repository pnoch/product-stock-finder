import type { DistributorListing } from "./types";
import { getDistributorById } from "./distributors";
import { convertPrice } from "./currency";

export interface BestDeal {
  distributorId: string;
  price: number;
  tax: number;
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

    const price = convertPrice(
      listing.price,
      listing.currency,
      displayCurrency,
    );
    if (price === null) continue;
    // Shipping is denominated in the distributor's native currency
    const shipping = convertPrice(
      shippingCost,
      distributor.currency,
      displayCurrency,
    );
    if (shipping === null) continue;
    const tax = price * (listing.taxRate ?? 0);
    const total = price + tax + shipping;

    if (!best || total < best.total) {
      best = {
        distributorId: listing.distributorId,
        price,
        tax,
        shipping,
        total,
        currency: displayCurrency,
      };
    }
  }

  // Fallback: no shipping cost for the requested region — return cheapest
  // in-stock price + tax without shipping rather than "no deal".
  if (!best) {
    const fallback = findBestInStockListing(listings, displayCurrency);
    if (fallback) {
      const price = convertPrice(fallback.price, fallback.currency, displayCurrency);
      if (price === null) return best;
      const tax = price * (fallback.taxRate ?? 0);
      return {
        distributorId: fallback.distributorId,
        price,
        tax,
        shipping: 0,
        total: price + tax,
        currency: displayCurrency,
      };
    }
  }

  return best;
}

export function findBestInStockListing(
  listings: DistributorListing[],
  targetCurrency: string,
): DistributorListing | null {
  let best: DistributorListing | null = null;
  let bestPrice = Infinity;

  for (const listing of listings) {
    if (listing.stockStatus !== "in_stock" || listing.price <= 0) continue;
    const converted = convertPrice(
      listing.price,
      listing.currency,
      targetCurrency,
    );
    if (converted === null || !Number.isFinite(converted)) continue;
    if (converted < bestPrice) {
      bestPrice = converted;
      best = listing;
    }
  }

  return best;
}
