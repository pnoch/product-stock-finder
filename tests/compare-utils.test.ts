import { describe, expect, it } from "vitest";
import { cheapestByRegion } from "../lib/compare-utils";
import type { DistributorListing } from "../lib/types";

function listing(
  distributorId: string,
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: "2026-08-25T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  };
}

describe("cheapestByRegion", () => {
  it("picks the cheapest in-stock listing per region", () => {
    const result = cheapestByRegion([
      listing("linitx-uk", { price: 400, currency: "GBP" }),
      listing("balticnetworks-us", { price: 450, currency: "USD" }),
    ]);
    expect(result).toHaveLength(2);
    // USD 450 (~$450) beats GBP 400 (~$506) after conversion
    expect(result[0]!.region).toBe("North America");
  });

  it("never selects an out-of-stock listing when one is buyable", () => {
    // interprojekt-pl (Europe) is cheaper but out of stock; getic-gr is in stock
    const result = cheapestByRegion([
      listing("interprojekt-pl", { price: 100, currency: "EUR", stockStatus: "out_of_stock" }),
      listing("getic-gr", { price: 200, currency: "EUR" }),
    ]);
    const europe = result.find((r) => r.region === "Europe");
    expect(europe?.listing.distributorId).toBe("getic-gr");
  });

  it("falls back to back-order listings when nothing is in stock in a region", () => {
    const result = cheapestByRegion([
      listing("interprojekt-pl", { price: 100, currency: "EUR", stockStatus: "back_order" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.listing.stockStatus).toBe("back_order");
  });

  it("ignores non-positive prices", () => {
    const result = cheapestByRegion([
      listing("balticnetworks-us", { price: 0 }),
      listing("linitx-uk", { price: 50, currency: "GBP" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.listing.distributorId).toBe("linitx-uk");
  });

  it("sorts regions by converted USD price ascending", () => {
    const result = cheapestByRegion([
      listing("linitx-uk", { price: 500, currency: "GBP" }),
      listing("server2u-my", { price: 300, currency: "MYR" }),
      listing("balticnetworks-us", { price: 200, currency: "USD" }),
    ]);
    // MYR 300 (~$67) < USD 200 < GBP 500 (~$633)
    expect(result.map((r) => r.region)).toEqual([
      "Asia-Pacific",
      "North America",
      "Europe",
    ]);
  });
});
