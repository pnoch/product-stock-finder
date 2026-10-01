import { describe, it, expect } from "vitest";
import { findBestDeal, findBestInStockListing } from "@/lib/best-deal";
import type { DistributorListing } from "@/lib/types";

function makeListing(
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
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

describe("findBestDeal", () => {
  it("returns the lowest total landed cost (price + shipping)", () => {
    const listings = [
      makeListing({
        distributorId: "server2u-my",
        price: 100,
        currency: "USD",
      }),
      makeListing({ distributorId: "linitx-uk", price: 90, currency: "USD" }),
      makeListing({
        distributorId: "interprojekt-pl",
        price: 80,
        currency: "USD",
      }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal).not.toBeNull();
    // The winner must be the minimum of the individually-computed totals
    const individualTotals = listings
      .map((l) => findBestDeal([l], "Asia-Pacific", "USD")?.total)
      .filter((t): t is number => t != null);
    expect(individualTotals.length).toBeGreaterThan(0);
    expect(deal!.total).toBeCloseTo(Math.min(...individualTotals), 2);
    expect(deal!.total).toBeCloseTo(deal!.price + (deal!.shipping ?? 0), 2);
  });

  it("keeps the first listing on an equal landed cost", () => {
    // The comparison is strict (`total < best.total`), so an exact tie keeps
    // the earlier listing. A `<=` would flip the winner to the later one.
    // balticnetworks-us and rocnoc-us share the same Asia-Pacific shipping, so
    // equal prices give an identical landed cost.
    const listings = [
      makeListing({ distributorId: "balticnetworks-us", price: 100, currency: "USD" }),
      makeListing({ distributorId: "rocnoc-us", price: 100, currency: "USD" }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal?.distributorId).toBe("balticnetworks-us");
  });

  it("skips out-of-stock listings", () => {
    const listings = [
      makeListing({
        distributorId: "server2u-my",
        price: 100,
        stockStatus: "out_of_stock",
      }),
      makeListing({
        distributorId: "linitx-uk",
        price: 90,
        stockStatus: "in_stock",
      }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.distributorId).toBe("linitx-uk");
  });

  it("skips listings with no shipping data for the region", () => {
    const listings = [
      makeListing({ distributorId: "server2u-my", price: 100 }),
      makeListing({ distributorId: "unknown-dist", price: 50 }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.distributorId).toBe("server2u-my");
  });

  it("converts price and shipping to display currency", () => {
    const listings = [
      makeListing({
        distributorId: "server2u-my",
        price: 100,
        currency: "USD",
      }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.currency).toBe("USD");
    expect(deal!.price).toBeCloseTo(100, 2);
    expect(deal!.shipping).not.toBeNull();
    expect(deal!.shipping!).toBeGreaterThan(0);
    expect(deal!.total).toBeCloseTo(deal!.price + (deal!.shipping ?? 0), 2);
  });

  it("returns null with no in-stock listings", () => {
    const listings = [
      makeListing({ stockStatus: "out_of_stock" }),
      makeListing({ stockStatus: "back_order" }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal).toBeNull();
  });

  it("includes tax in the total landed cost", () => {
    const listings = [
      makeListing({
        distributorId: "server2u-my",
        price: 100,
        currency: "USD",
        taxRate: 0.2,
      }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal).not.toBeNull();
    expect(deal!.tax).toBeCloseTo(20, 2); // 100 * 0.2
    expect(deal!.total).toBeCloseTo(
      deal!.price + deal!.tax + (deal!.shipping ?? 0),
      2,
    );
  });

  it("treats missing taxRate as tax-free", () => {
    const listings = [
      makeListing({
        distributorId: "server2u-my",
        price: 100,
        currency: "USD",
      }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.tax).toBe(0);
  });

  it("falls back to a shipping-less deal for a lone in-stock listing", () => {
    // A single in-stock option with no shipping data for the region: return
    // price + tax without fabricating free shipping.
    const listings = [
      makeListing({
        distributorId: "ghost-distributor",
        price: 100,
        currency: "USD",
        taxRate: 0.1,
      }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal).toEqual({
      distributorId: "ghost-distributor",
      price: 100,
      tax: 10,
      shipping: null,
      total: 110,
      currency: "USD",
    });
  });

  it("treats a non-finite taxRate as tax-free in the fallback", () => {
    const listings = [
      makeListing({
        distributorId: "ghost-distributor",
        price: 100,
        currency: "USD",
        taxRate: Number.NaN,
      }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal!.tax).toBe(0);
    expect(deal!.total).toBeCloseTo(100, 2);
    expect(deal!.shipping).toBeNull();
  });

  it("returns null when multiple in-stock listings lack shipping data", () => {
    // With several options and no shipping data they cannot be ranked fairly.
    const listings = [
      makeListing({ distributorId: "ghost-a", price: 100, currency: "USD" }),
      makeListing({ distributorId: "ghost-b", price: 90, currency: "USD" }),
    ];
    expect(findBestDeal(listings, "Asia-Pacific", "USD")).toBeNull();
  });

  it("returns null when the lone in-stock listing cannot be converted", () => {
    const listings = [
      makeListing({
        distributorId: "ghost-distributor",
        price: 100,
        currency: "XYZ",
      }),
    ];
    expect(findBestDeal(listings, "Asia-Pacific", "USD")).toBeNull();
  });
});

describe("findBestInStockListing", () => {
  it("compares prices across currencies, not raw numbers", () => {
    const listings = [
      // Raw minimum is GBP 449 (~$568 at static rates); true best is USD 499.
      makeListing({ distributorId: "balticnetworks-lv", price: 499, currency: "USD" }),
      makeListing({ distributorId: "linitx-uk", price: 449, currency: "GBP" }),
      makeListing({ distributorId: "server2u-my", price: 2600, currency: "MYR" }),
    ];
    const best = findBestInStockListing(listings, "USD");
    expect(best?.distributorId).toBe("balticnetworks-lv");
  });

  it("skips non-in-stock and non-positive-price listings", () => {
    const listings = [
      makeListing({ distributorId: "a", price: 1, stockStatus: "out_of_stock" }),
      makeListing({ distributorId: "b", price: 0, stockStatus: "in_stock" }),
      // A negative price is also invalid; the guard is `<= 0`, not `< 0`.
      makeListing({ distributorId: "d", price: -5, stockStatus: "in_stock" }),
      makeListing({ distributorId: "c", price: 50, currency: "USD" }),
    ];
    expect(findBestInStockListing(listings, "USD")?.distributorId).toBe("c");
  });

  it("returns null when nothing is in stock", () => {
    expect(
      findBestInStockListing([makeListing({ stockStatus: "back_order" })], "USD"),
    ).toBeNull();
    expect(findBestInStockListing([], "USD")).toBeNull();
  });
});
