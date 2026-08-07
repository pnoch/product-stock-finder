import { describe, it, expect } from "vitest";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { Product } from "@/lib/types";

function makeListing(overrides: Partial<any> = {}) {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    expectedDate: undefined,
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
    ...overrides,
  };
}

function makeProduct(listings: any[]): Product {
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

describe("computeWatchlistSummary", () => {
  it("sums all listings converted to display currency", () => {
    const watchlist = [
      makeProduct([
        makeListing({ price: 100, currency: "USD" }),
        makeListing({ price: 92, currency: "EUR" }), // 92 EUR = 100 USD
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.totalValue).toBeCloseTo(200, 2);
  });

  it("counts in-stock, back-order, and out-of-stock listings", () => {
    const watchlist = [
      makeProduct([
        makeListing({ stockStatus: "in_stock" }),
        makeListing({ stockStatus: "in_stock" }),
        makeListing({ stockStatus: "back_order" }),
        makeListing({ stockStatus: "out_of_stock" }),
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.inStock).toBe(2);
    expect(summary.backOrder).toBe(1);
    expect(summary.outOfStock).toBe(1);
  });

  it("skips listings with missing price or currency", () => {
    const watchlist = [
      makeProduct([
        makeListing({ price: 0 }),
        makeListing({ currency: "" }),
        makeListing({ price: 50, currency: "USD" }),
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.totalValue).toBe(50);
  });

  it("returns zeros for empty watchlist", () => {
    const summary = computeWatchlistSummary([], "USD");
    expect(summary).toEqual({
      totalValue: 0,
      listingCount: 0,
      inStock: 0,
      backOrder: 0,
      outOfStock: 0,
    });
  });

  it("counts listingCount as all listings regardless of price", () => {
    const watchlist = [
      makeProduct([
        makeListing({ price: 0 }),
        makeListing({ price: 50, currency: "USD" }),
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.listingCount).toBe(2);
  });

  it("counts unknown-status listings in listingCount but no stock bucket", () => {
    const watchlist = [
      makeProduct([
        makeListing({ stockStatus: "unknown" }),
        makeListing({ stockStatus: "in_stock" }),
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.listingCount).toBe(2);
    expect(summary.inStock).toBe(1);
    expect(summary.backOrder).toBe(0);
    expect(summary.outOfStock).toBe(0);
  });
});
