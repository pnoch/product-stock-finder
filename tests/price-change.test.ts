import { describe, expect, it } from "vitest";
import { computePriceChange } from "../lib/price-change";
import type { DistributorListing } from "../lib/types";

function listing(overrides: Partial<DistributorListing>): DistributorListing {
  return {
    distributorId: "getic-gr",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: "",
    priceHistory: [],
    ...overrides,
  };
}

describe("computePriceChange", () => {
  it("computes the change from the historical in-stock minimum", () => {
    const change = computePriceChange(
      [
        listing({
          price: 90,
          priceHistory: [
            { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
            { date: "2026-09-01", price: 90, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ],
      "USD",
    );
    expect(change?.pct).toBeCloseTo(-10, 1);
    expect(change?.isDown).toBe(true);
  });

  // An out-of-stock distributor's high historical price must not be used as the
  // baseline: it produced a fake drop (1000 out-of-stock vs 100 current = -90%).
  it("ignores out-of-stock history points", () => {
    const change = computePriceChange(
      [
        listing({
          price: 100,
          priceHistory: [
            { date: "2026-08-01", price: 1000, currency: "USD", stockStatus: "out_of_stock" },
            { date: "2026-09-01", price: 100, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ],
      "USD",
    );
    expect(change).toBeNull();
  });

  it("returns null when there is no orderable price", () => {
    expect(
      computePriceChange([listing({ stockStatus: "out_of_stock" })], "USD"),
    ).toBeNull();
  });
});
