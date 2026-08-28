import { describe, expect, it } from "vitest";
import { suggestAlertPrices } from "../lib/alert-suggestions";
import type { DistributorListing } from "../lib/types";

const now = Date.now();
const DAY = 86_400_000;

function listing(
  overrides: Partial<DistributorListing> & { price: number },
): DistributorListing {
  return {
    distributorId: "balticnetworks-us",
    productId: "p1",
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: "",
    priceHistory: [],
    ...overrides,
  };
}

function point(daysAgo: number, price: number, currency = "USD") {
  return {
    date: new Date(now - daysAgo * DAY).toISOString().slice(0, 10),
    price,
    currency,
    stockStatus: "in_stock" as const,
  };
}

describe("suggestAlertPrices", () => {
  it("returns near_low from historical prices", () => {
    const result = suggestAlertPrices(
      [listing({ price: 209, priceHistory: [point(10, 209), point(5, 220)] })],
      "USD",
      now,
    );
    expect(result.find((s) => s.key === "near_low")?.price).toBe(209);
  });

  it("returns below_avg from recent window", () => {
    const result = suggestAlertPrices(
      [listing({
        price: 209,
        priceHistory: [point(5, 100), point(10, 200), point(15, 300)],
      })],
      "USD",
      now,
    );
    const below = result.find((s) => s.key === "below_avg");
    expect(below?.price).toBeGreaterThan(0);
  });

  it("returns under_current when in stock", () => {
    const result = suggestAlertPrices(
      [listing({ price: 100, priceHistory: [] })],
      "USD",
      now,
    );
    const under = result.find((s) => s.key === "under_current");
    expect(under?.price).toBe(95); // 100 * 0.95
  });

  it("excludes suggestions with price <= 0", () => {
    const result = suggestAlertPrices(
      [listing({ price: 0, stockStatus: "out_of_stock", priceHistory: [] })],
      "USD",
      now,
    );
    expect(result.find((s) => s.key === "under_current")).toBeUndefined();
  });

  it("deduplicates equal prices", () => {
    const result = suggestAlertPrices(
      [listing({ price: 100, priceHistory: [point(5, 100)] })],
      "USD",
      now,
    );
    const prices = result.map((s) => s.price);
    expect(new Set(prices).size).toBe(prices.length);
  });

  it("returns empty for no listings", () => {
    expect(suggestAlertPrices([], "USD", now)).toEqual([]);
  });
});
