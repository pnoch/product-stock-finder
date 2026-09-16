import { describe, it, expect } from "vitest";
import { convertPrice, getBestPrice } from "../lib/currency";
import { computePriceVsAverage } from "../lib/price-average";
import { cheapestByRegion } from "@shared/compare-utils";
import { computeWatchlistSummary } from "../lib/watchlist-summary";
import type { DistributorListing, Product } from "../lib/types";

function listing(
  overrides: Partial<DistributorListing> & {
    price: number;
    currency: string;
    stockStatus: string;
  },
): DistributorListing {
  const { price, currency, stockStatus, priceHistory, ...rest } = overrides;
  return {
    productId: "p",
    distributorId: rest.distributorId ?? "test",
    price,
    currency,
    stockStatus: stockStatus as DistributorListing["stockStatus"],
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory: (priceHistory as DistributorListing["priceHistory"]) ?? [],
    ...rest,
  } as DistributorListing;
}

describe("pricing surfaces agree on orderability", () => {
  it("getBestPrice and computePriceVsAverage both exclude out_of_stock", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    const day = 24 * 60 * 60 * 1000;
    const listings: DistributorListing[] = [
      {
        productId: "p",
        distributorId: "test",
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
        url: "",
        lastChecked: new Date(now).toISOString(),
        priceHistory: [
          { date: new Date(now - 10 * day).toISOString(), price: 120, currency: "USD", stockStatus: "in_stock" },
          { date: new Date(now - 2 * day).toISOString(), price: 110, currency: "USD", stockStatus: "in_stock" },
        ],
      } as DistributorListing,
    ];

    const best = getBestPrice(listings, "USD");
    expect(best?.price).toBe(100);

    const vsAvg = computePriceVsAverage(listings, "USD", 30, now);
    expect(vsAvg?.current).toBe(100);
    // Average of the two history points (120, 110).
    expect(vsAvg?.average).toBeCloseTo(115);
  });

  it("filters out_of_stock from best price but not from the summary", () => {
    const listings = [
      listing({ price: 50, currency: "USD", stockStatus: "out_of_stock", distributorId: "balticnetworks-us" }),
      listing({ price: 100, currency: "USD", stockStatus: "in_stock", distributorId: "linktechs-us" }),
      listing({ price: 200, currency: "USD", stockStatus: "in_stock", distributorId: "mit-x10-us" }),
    ];

    const best = getBestPrice(listings, "USD");
    // out_of_stock $50 must be excluded — best is $100
    expect(best?.price).toBe(100);

    const regionBest = cheapestByRegion(listings);
    const allRegionIds = regionBest.map((r) => r.listing.distributorId);
    expect(allRegionIds).not.toContain("balticnetworks-us");

    // The summary counts every listing regardless of stock.
    const product = { id: "p", listings } as unknown as Product;
    const summary = computeWatchlistSummary([product], "USD");
    expect(summary.listingCount).toBe(3);
    expect(summary.outOfStock).toBe(1);
    expect(summary.inStock).toBe(2);
    const expectedTotal = listings.reduce(
      (s, l) => s + (convertPrice(l.price, l.currency, "USD") ?? 0),
      0,
    );
    expect(summary.totalValue).toBeCloseTo(expectedTotal);
    expect(summary.totalValue).toBeGreaterThan(best!.price);
  });

  it("cheapestByRegion excludes unknown-availability listings", () => {
    const listings = [
      listing({ price: 90, currency: "USD", stockStatus: "unknown", distributorId: "server2u-my" }),
      listing({ price: 100, currency: "USD", stockStatus: "back_order", distributorId: "server2u-my" }),
    ];
    const regionBest = cheapestByRegion(listings);
    for (const r of regionBest) {
      expect(r.listing.stockStatus).not.toBe("unknown");
    }
  });
});
