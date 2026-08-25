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
    expect(deal!.total).toBeCloseTo(deal!.price + deal!.shipping, 2);
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
    expect(deal!.shipping).toBeGreaterThan(0);
    expect(deal!.total).toBeCloseTo(deal!.price + deal!.shipping, 2);
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
      deal!.price + deal!.tax + deal!.shipping,
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
