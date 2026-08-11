import { describe, it, expect } from "vitest";
import { analyzeDistributors } from "@/lib/distributor-analysis";
import type { Product, DistributorListing } from "@/lib/types";

function makeListing(overrides: Partial<DistributorListing> = {}): DistributorListing {
  return {
    distributorId: "server2u-my",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
    ...overrides,
  };
}

function makeProduct(id: string, listings: DistributorListing[]): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "B",
    category: "C",
    description: "D",
    addedAt: "2026-01-01",
    isWatched: true,
    listings,
  } as Product;
}

describe("analyzeDistributors", () => {
  it("computes coverage, total, and average correctly", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
        makeListing({ distributorId: "linitx-uk", price: 90, currency: "USD" }),
      ]),
      makeProduct("p2", [
        makeListing({ distributorId: "server2u-my", price: 50, currency: "USD" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "USD");
    const server2u = result.find((r) => r.distributorId === "server2u-my");
    const linitx = result.find((r) => r.distributorId === "linitx-uk");
    // server2u: coverage 2, total 100+50=150, avg 75
    expect(server2u!.coverage).toBe(2);
    expect(server2u!.totalCost).toBeCloseTo(150, 2);
    expect(server2u!.averagePrice).toBeCloseTo(75, 2);
    // linitx: coverage 1, total 90, avg 90
    expect(linitx!.coverage).toBe(1);
    expect(linitx!.totalCost).toBeCloseTo(90, 2);
    expect(linitx!.averagePrice).toBeCloseTo(90, 2);
  });

  it("converts to display currency", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "EUR");
    const server2u = result.find((r) => r.distributorId === "server2u-my");
    expect(server2u!.totalCost).toBeGreaterThan(0);
    expect(server2u!.totalCost).not.toBeCloseTo(100, 2); // converted, not 1:1
  });

  it("sorts by total cost ascending", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", price: 200, currency: "USD" }),
        makeListing({ distributorId: "linitx-uk", price: 50, currency: "USD" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "USD");
    expect(result[0].distributorId).toBe("linitx-uk");
    expect(result[1].distributorId).toBe("server2u-my");
  });

  it("excludes distributors with no in-stock listings", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", stockStatus: "out_of_stock" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "USD");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty watchlist", () => {
    expect(analyzeDistributors([], "USD")).toEqual([]);
  });

  it("includes tax in totalCost", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", price: 100, currency: "USD", taxRate: 0.2 }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "USD");
    const server2u = result.find((r) => r.distributorId === "server2u-my");
    expect(server2u!.totalCost).toBeCloseTo(120, 2); // 100 + 20 tax
  });
});
