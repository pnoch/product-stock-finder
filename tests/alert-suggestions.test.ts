import { describe, expect, it } from "vitest";
import { suggestAlertPrices } from "../lib/alert-suggestions";
import type { DistributorListing } from "../lib/types";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function listing(
  overrides: Partial<DistributorListing> & { distributorId: string },
): DistributorListing {
  return {
    productId: "",
    price: 85,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW - DAY).toISOString(),
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

describe("suggestAlertPrices", () => {
  it("computes all three strategies from merged history", () => {
    const listings = [
      listing({
        distributorId: "a",
        priceHistory: [
          { date: new Date(NOW - 40 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
          { date: new Date(NOW - 10 * DAY).toISOString(), price: 80, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
      listing({
        distributorId: "b",
        priceHistory: [
          { date: new Date(NOW - 5 * DAY).toISOString(), price: 90, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ];
    const result = suggestAlertPrices(listings, "USD", NOW);
    expect(result.map((s) => s.key)).toEqual([
      "near_low",
      "below_avg",
      "under_current",
    ]);
    expect(result[0].price).toBe(80); // min of 100/80/90
    expect(result[1].price).toBe(76.5); // mean(80, 90) * 0.9 — both within 30d
    expect(result[2].price).toBe(80.75); // min(85, 92) * 0.95
  });

  it("dedupes suggestions that round to the same value", () => {
    const listings = [
      listing({
        distributorId: "a",
        price: 84.21,
        priceHistory: [
          { date: new Date(NOW - DAY).toISOString(), price: 80, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ];
    // near_low = 80; under_current = 84.21 * 0.95 = 79.9995 -> rounds to 80
    const result = suggestAlertPrices(listings, "USD", NOW);
    const values = result.map((s) => s.price);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain(80);
  });

  it("skips non-convertible currencies and non-positive prices", () => {
    const listings = [
      listing({
        distributorId: "a",
        priceHistory: [
          { date: new Date(NOW - DAY).toISOString(), price: 0, currency: "USD", stockStatus: "in_stock" },
          { date: new Date(NOW - DAY).toISOString(), price: 50, currency: "XYZ", stockStatus: "in_stock" },
          { date: new Date(NOW - DAY).toISOString(), price: 70, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ];
    const result = suggestAlertPrices(listings, "USD", NOW);
    expect(result.find((s) => s.key === "near_low")!.price).toBe(70);
  });

  it("uses cheapest in-stock listing for under_current, ignoring OOS", () => {
    const listings = [
      listing({ distributorId: "a", price: 60, stockStatus: "out_of_stock" }),
      listing({ distributorId: "b", price: 100, stockStatus: "in_stock" }),
    ];
    const result = suggestAlertPrices(listings, "USD", NOW);
    // No history at all -> no near_low/below_avg either.
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("under_current");
    expect(result[0].price).toBe(95);
  });

  it("returns empty array for empty listings", () => {
    expect(suggestAlertPrices([], "USD", NOW)).toEqual([]);
  });
});
