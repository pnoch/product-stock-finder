// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DistributorListing, Product } from "../lib/types";
import { useProductDerived } from "../desktop/src/hooks/use-product-derived";

function listing(
  distributorId: string,
  price: number,
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com",
    lastChecked: "2026-02-01T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  };
}

function product(listings: DistributorListing[]): Product {
  return {
    id: "p1",
    name: "Test",
    modelNumber: "T-1",
    brand: "Brand",
    category: "Router",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings,
  };
}

describe("useProductDerived", () => {
  const asia = listing("server2u-my", 120);
  const europe = listing("linitx-uk", 100);

  it("returns all listings when the region filter is all", () => {
    const { result } = renderHook(() =>
      useProductDerived({
        product: product([asia, europe]),
        regionFilter: "all",
        displayCurrency: "USD",
        shippingRegion: "Asia-Pacific",
      }),
    );
    expect(result.current.visibleListings).toHaveLength(2);
  });

  it("filters listings by region", () => {
    const { result } = renderHook(() =>
      useProductDerived({
        product: product([asia, europe]),
        regionFilter: "Europe",
        displayCurrency: "USD",
        shippingRegion: "Asia-Pacific",
      }),
    );
    expect(result.current.visibleListings).toHaveLength(1);
    expect(result.current.visibleListings[0]!.distributorId).toBe("linitx-uk");
  });

  it("picks the cheapest in-stock listing as best", () => {
    const { result } = renderHook(() =>
      useProductDerived({
        product: product([asia, europe]),
        regionFilter: "all",
        displayCurrency: "USD",
        shippingRegion: "Asia-Pacific",
      }),
    );
    expect(result.current.best?.price).toBe(100);
    expect(result.current.bestListing?.distributorId).toBe("linitx-uk");
  });

  it("ignores out-of-stock listings for the best price", () => {
    const outOfStock = listing("server2u-my", 50, {
      stockStatus: "out_of_stock",
    });
    const { result } = renderHook(() =>
      useProductDerived({
        product: product([outOfStock, europe]),
        regionFilter: "all",
        displayCurrency: "USD",
        shippingRegion: "Asia-Pacific",
      }),
    );
    expect(result.current.best?.price).toBe(100);
  });

  it("flags a new all-time low", () => {
    const low = listing("linitx-uk", 80, {
      priceHistory: [
        { price: 120, currency: "USD", date: "2026-01-01", stockStatus: "in_stock" },
        { price: 110, currency: "USD", date: "2026-01-15", stockStatus: "in_stock" },
        { price: 80, currency: "USD", date: "2026-02-01", stockStatus: "in_stock" },
      ],
    });
    const { result } = renderHook(() =>
      useProductDerived({
        product: product([low]),
        regionFilter: "all",
        displayCurrency: "USD",
        shippingRegion: "Asia-Pacific",
      }),
    );
    expect(result.current.isLowestEver).toBe(true);
    expect(result.current.trendSignal).toEqual({ down: true, pct: 33 });
  });

  it("does not flag a price above the prior low", () => {
    const higher = listing("linitx-uk", 100, {
      priceHistory: [
        { price: 80, currency: "USD", date: "2026-01-01", stockStatus: "in_stock" },
        { price: 100, currency: "USD", date: "2026-02-01", stockStatus: "in_stock" },
      ],
    });
    const { result } = renderHook(() =>
      useProductDerived({
        product: product([higher]),
        regionFilter: "all",
        displayCurrency: "USD",
        shippingRegion: "Asia-Pacific",
      }),
    );
    expect(result.current.isLowestEver).toBe(false);
  });
});
