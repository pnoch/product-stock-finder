import { DISTRIBUTORS, getDistributorById } from "@shared/distributors";
import { convertPrice } from "./currency";
import type { Product, DistributorListing } from "./types";

// Prices in different currencies are ranked through this base so a USD listing
// can be compared against a EUR one. Region membership is currency-agnostic in
// spirit, so the exact base only affects which region wins on a near-tie.
const REGION_PRICE_BASE = "USD";

export function getAllRegions(): string[] {
  const regions = new Set<string>();
  for (const d of DISTRIBUTORS) {
    if (d.region) regions.add(d.region);
  }
  return Array.from(regions).sort();
}

/**
 * The product's primary region: the region of its cheapest in-stock listing
 * (converted to a common base). Falls back to the first listing with a known
 * region, then "Unknown". Used by BOTH the region filter and region
 * grouping/sorting so the two always agree — previously the filter matched any
 * listing in the region while grouping keyed off the first listing, so a
 * multi-region product could be filtered into one region and grouped under
 * another.
 */
export function productRegion(product: Product): string {
  const listings = product.listings ?? [];
  let best: { distributorId: string; price: number } | null = null;
  for (const listing of listings) {
    if (listing.stockStatus !== "in_stock") continue;
    if (!Number.isFinite(listing.price) || listing.price <= 0) continue;
    const price = convertPrice(listing.price, listing.currency, REGION_PRICE_BASE);
    if (price === null) continue;
    if (!best || price < best.price) {
      best = { distributorId: listing.distributorId, price };
    }
  }
  const bestRegion = best
    ? getDistributorById(best.distributorId)?.region
    : undefined;
  if (bestRegion) return bestRegion;
  for (const listing of listings) {
    const region = getDistributorById(listing.distributorId)?.region;
    if (region) return region;
  }
  return "Unknown";
}

export function productHasRegion(product: Product, region: string): boolean {
  return productRegion(product) === region;
}

export function filterListingsByRegion(
  listings: DistributorListing[],
  region: string,
): DistributorListing[] {
  return listings.filter((listing) => {
    const distributor = getDistributorById(listing.distributorId);
    return distributor?.region === region;
  });
}
