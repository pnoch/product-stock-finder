import { describe, it, expect } from "vitest";
import { findBestDeal } from "@/lib/best-deal";
import type { DistributorListing } from "@/lib/types";

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

describe("findBestDeal", () => {
  it("returns the lowest total landed cost (price + shipping)", () => {
    const listings = [
      makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
      makeListing({ distributorId: "linitx-uk", price: 90, currency: "USD" }),
      makeListing({ distributorId: "interprojekt-pl", price: 80, currency: "USD" }),
    ];
    const deal = findBestDeal(listings, "Asia-Pacific", "USD");
    expect(deal).not.toBeNull();
    expect(deal!.total).toBeGreaterThan(0);
    expect(deal!.total).toBeCloseTo(deal!.price + deal!.shipping, 2);
  });

  it("skips out-of-stock listings", () => {
    const listings = [
      makeListing({ distributorId: "server2u-my", price: 100, stockStatus: "out_of_stock" }),
      makeListing({ distributorId: "linitx-uk", price: 90, stockStatus: "in_stock" }),
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
      makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
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
});
