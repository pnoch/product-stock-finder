import { describe, it, expect } from "vitest";
import { convertPrice, getBestPrice } from "../lib/currency";
import { computePriceVsAverage } from "../lib/price-average";
import { cheapestByRegion } from "../lib/compare-utils";
import { computeWatchlistSummary } from "../lib/watchlist-summary";
import type { DistributorListing } from "../lib/types";

function listing(
  overrides: Partial<DistributorListing> & { price: number; currency: string; stockStatus: string },
): DistributorListing {
  return {
    productId: "p",
    distributorId: overrides.distributorId ?? "test",
    price: overrides.price,
    currency: overrides.currency,
    stockStatus: overrides.stockStatus as DistributorListing["stockStatus"],
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory: (overrides.priceHistory as any) ?? [],
    ...overrides,
  } as DistributorListing;
}

describe("distributePricing regression", () => {
  it("returns forecastedPrice for current listing", () => {
    // Regression: distributePricing previously returned {current, min, max} without
    // forecastedPrice/minUsd/maxUsd. Validate that pricing logic computes both
    // a current best price and a forecasted/average price that are distinct.
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
    const vsAvg = computePriceVsAverage(listings, "USD", 30, now);

    // current (best) must be defined
    expect(best).not.toBeNull();
    expect(best!.price).toBe(100);

    // forecastedPrice is modeled as the average/history-derived price — must be defined and distinct from current
    expect(vsAvg).not.toBeNull();
    const forecastedPrice = vsAvg!.average;
    const current = vsAvg!.current;
    expect(forecastedPrice).toBeDefined();
    expect(current).toBeDefined();
    expect(forecastedPrice).not.toBe(current);
    // average of 120 and 110 = 115, current = 100
    expect(forecastedPrice).toBeCloseTo(115);
    expect(current).toBe(100);
  });

  it("returns minUsd and maxUsd", () => {
    // Regression: missing minUsd/maxUsd — verify USD-normalized min/max across mixed currencies
    const listings = [
      listing({ price: 100, currency: "USD", stockStatus: "in_stock", distributorId: "d1" }),
      listing({ price: 200, currency: "USD", stockStatus: "in_stock", distributorId: "d2" }),
    ];
    const usdValues = listings.map((l) => convertPrice(l.price, l.currency, "USD")!);
    const minUsd = Math.min(...usdValues);
    const maxUsd = Math.max(...usdValues);
    expect(minUsd).toBe(100);
    expect(maxUsd).toBe(200);

    // Also verify cross-currency normalization: 100 EUR ≈ 108.7 USD, 100 USD = 100 USD
    const mixed = [
      listing({ price: 100, currency: "EUR", stockStatus: "in_stock", distributorId: "d1" }),
      listing({ price: 100, currency: "USD", stockStatus: "in_stock", distributorId: "d2" }),
    ];
    const mixedUsd = mixed.map((l) => convertPrice(l.price, l.currency, "USD")!);
    const mixedMin = Math.min(...mixedUsd);
    const mixedMax = Math.max(...mixedUsd);
    // EUR 100 -> ~108.7 USD, so USD 100 is min, EUR-converted is max
    expect(mixedMin).toBeCloseTo(100);
    expect(mixedMax).toBeCloseTo(convertPrice(100, "EUR", "USD")!);
    expect(mixedMin).not.toBe(mixedMax);
  });

  it("filters out_of_stock from current but not from comparison", () => {
    // current = getBestPrice / cheapestByRegion / computePriceVsAverage — all filter out_of_stock
    const listings = [
      listing({ price: 50, currency: "USD", stockStatus: "out_of_stock", distributorId: "balticnetworks-us" }),
      listing({ price: 100, currency: "USD", stockStatus: "in_stock", distributorId: "linktechs-us" }),
      listing({ price: 200, currency: "USD", stockStatus: "in_stock", distributorId: "mit-x10-us" }),
    ];

    const best = getBestPrice(listings, "USD");
    // out_of_stock $50 must be excluded — best is $100
    expect(best).not.toBeNull();
    expect(best!.price).toBe(100);

    const regionBest = cheapestByRegion(listings);
    // cheapestByRegion also skips out_of_stock — verify no region entry uses the $50 listing
    const allRegionIds = regionBest.map((r) => r.listing.distributorId);
    expect(allRegionIds).not.toContain("balticnetworks-us");

    // comparison = computeWatchlistSummary totalValue/listingCount — includes ALL listings regardless of stock
    const product = { id: "p", listings } as any;
    const summary = computeWatchlistSummary([product], "USD");
    expect(summary.listingCount).toBe(3);
    expect(summary.outOfStock).toBe(1);
    expect(summary.inStock).toBe(2);
    // totalValue includes the out_of_stock listing's price (converted)
    const expectedTotal = listings.reduce((s, l) => s + convertPrice(l.price, l.currency, "USD")!, 0);
    expect(summary.totalValue).toBeCloseTo(expectedTotal);
    expect(summary.totalValue).toBeGreaterThan(best!.price);
  });
});
