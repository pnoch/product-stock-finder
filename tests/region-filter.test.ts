import { describe, it, expect } from "vitest";
import {
  getAllRegions,
  productHasRegion,
  filterListingsByRegion,
} from "@/lib/region-filter";
import { Product, DistributorListing } from "@/lib/types";

function makeListing(distributorId: string): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
  };
}

function makeProduct(listings: DistributorListing[]): Product {
  return {
    id: "p1",
    name: "Test",
    modelNumber: "M1",
    brand: "B",
    category: "C",
    description: "D",
    addedAt: "2026-01-01",
    isWatched: true,
    listings,
  } as Product;
}

describe("getAllRegions", () => {
  it("returns distinct regions from distributors", () => {
    const regions = getAllRegions();
    expect(regions).toContain("Europe");
    expect(regions).toContain("Asia-Pacific");
    expect(regions).toContain("North America");
    expect(regions).toContain("Africa");
    expect(regions).toContain("Middle East");
  });
});

describe("productHasRegion", () => {
  it("returns true when a listing's distributor is in the region", () => {
    const product = makeProduct([makeListing("server2u-my")]); // Asia-Pacific
    expect(productHasRegion(product, "Asia-Pacific")).toBe(true);
  });

  it("returns false when no listing's distributor is in the region", () => {
    const product = makeProduct([makeListing("server2u-my")]); // Asia-Pacific
    expect(productHasRegion(product, "Europe")).toBe(false);
  });

  it("returns false for unknown distributor", () => {
    const product = makeProduct([makeListing("unknown-dist")]);
    expect(productHasRegion(product, "Europe")).toBe(false);
  });
});

describe("filterListingsByRegion", () => {
  it("filters listings to the given region", () => {
    const listings = [
      makeListing("server2u-my"), // Asia-Pacific
      makeListing("linitx-uk"), // Europe
    ];
    const filtered = filterListingsByRegion(listings, "Europe");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].distributorId).toBe("linitx-uk");
  });

  it("excludes unknown distributors", () => {
    const listings = [makeListing("unknown-dist"), makeListing("linitx-uk")];
    const filtered = filterListingsByRegion(listings, "Europe");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].distributorId).toBe("linitx-uk");
  });
});
