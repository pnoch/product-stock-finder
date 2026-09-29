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

  it("suppresses sub-0.5% changes but reports larger ones", () => {
    // The 0.5% floor hides noise; a mutation to a smaller threshold would show
    // a change that should be suppressed.
    const change = (from: number, to: number) =>
      computePriceChange(
        [
          listing({
            price: to,
            priceHistory: [
              { date: "2026-08-01", price: from, currency: "USD", stockStatus: "in_stock" },
              { date: "2026-09-01", price: to, currency: "USD", stockStatus: "in_stock" },
            ],
          }),
        ],
        "USD",
      );
    // 100 -> 100.4 is +0.4%: below the floor.
    expect(change(100, 100.4)).toBeNull();
    // 100 -> 100.6 is +0.6%: above the floor.
    expect(change(100, 100.6)?.pct).toBeCloseTo(0.6, 1);
  });
});
