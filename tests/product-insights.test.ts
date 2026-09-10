import { describe, expect, it } from "vitest";
import { computeProductInsights, convertPricePoint } from "../lib/product-insights";
import type { DistributorListing, Product } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-15T12:00:00Z");

function listing(
  distributorId: string,
  history: Array<[number, number]>, // [daysAgo, price]
): DistributorListing {
  return {
    productId: "p",
    distributorId,
    price: history[history.length - 1]?.[1] ?? 0,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW - DAY).toISOString(),
    priceHistory: history.map(([daysAgo, price]) => ({
      date: new Date(NOW - daysAgo * DAY).toISOString(),
      price,
      currency: "USD",
      stockStatus: "in_stock" as const,
    })),
  } as DistributorListing;
}

function product(id: string, listings: DistributorListing[]): Product {
  return {
    id,
    name: id.toUpperCase(),
    modelNumber: id,
    brand: "B",
    category: "C",
    description: "",
    addedAt: new Date(NOW).toISOString(),
    isWatched: true,
    listings,
  } as unknown as Product;
}

describe("computeProductInsights", () => {
  it("flags products at their all-time low", () => {
    const result = computeProductInsights(
      [
        product("low", [listing("a", [[10, 200], [0, 90]])]),
        product("not", [listing("a", [[10, 50], [0, 120]])]),
      ],
      "USD",
    );
    expect(result.allTimeLows).toBe(1);
    expect(result.products.find((p) => p.productId === "low")?.atAllTimeLow).toBe(true);
    expect(result.products.find((p) => p.productId === "not")?.atAllTimeLow).toBe(false);
  });

  it("counts trailing consecutive drops as streak", () => {
    const result = computeProductInsights(
      [
        // 100 → 90 → 95 → 80 → 70 : trailing streak = 2
        product("streak", [
          listing("a", [[10, 100], [8, 90], [6, 95], [4, 80], [0, 70]]),
        ]),
      ],
      "USD",
    );
    expect(result.products[0].dropStreak).toBe(2);
    expect(result.droppingCount).toBe(1);
  });

  it("buckets volatility by coefficient of variation", () => {
    const result = computeProductInsights(
      [
        product("stable", [listing("a", [[9, 100], [6, 101], [3, 100], [0, 99]])]),
        product("wild", [listing("a", [[9, 50], [6, 200], [3, 60], [0, 190]])]),
        product("short", [listing("a", [[3, 100], [0, 90]])]),
      ],
      "USD",
    );
    expect(result.volatility.low).toBe(1);
    expect(result.volatility.high).toBe(1);
    expect(result.products.find((p) => p.productId === "short")?.volatility).toBeNull();
  });

  it("skips non-convertible currencies entirely", () => {
    const weird = listing("a", [[5, 100], [0, 90]]);
    weird.priceHistory = weird.priceHistory.map((p) => ({ ...p, currency: "XYZ" }));
    const result = computeProductInsights([product("x", [weird])], "USD");
    expect(result.allTimeLows).toBe(0);
    expect(result.droppingCount).toBe(0);
    expect(result.products[0].volatility).toBeNull();
  });

  it("handles an empty watchlist", () => {
    const result = computeProductInsights([], "USD");
    expect(result.products).toEqual([]);
    expect(result.allTimeLows).toBe(0);
    expect(result.droppingCount).toBe(0);
  });
});

describe("convertPricePoint", () => {
  it("converts a price point to the display currency", () => {
    expect(convertPricePoint(100, "USD", "USD")).toBe(100);
    expect(convertPricePoint(100, "USD", "EUR")).toBeGreaterThan(0);
  });

  it("returns null for non-positive prices or unknown currencies", () => {
    expect(convertPricePoint(0, "USD", "USD")).toBeNull();
    expect(convertPricePoint(100, "XYZ", "USD")).toBeNull();
  });
});
