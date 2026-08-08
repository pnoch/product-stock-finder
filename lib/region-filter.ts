import { DISTRIBUTORS, getDistributorById } from "./distributors";
import type { Product, DistributorListing } from "./types";

export function getAllRegions(): string[] {
  const regions = new Set<string>();
  for (const d of DISTRIBUTORS) {
    if (d.region) regions.add(d.region);
  }
  return Array.from(regions).sort();
}

export function productHasRegion(product: Product, region: string): boolean {
  return (product.listings ?? []).some((listing) => {
    const distributor = getDistributorById(listing.distributorId);
    return distributor?.region === region;
  });
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
