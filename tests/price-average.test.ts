import { describe, expect, it } from "vitest";
import { computePriceVsAverage } from "../lib/price-average";
import type { DistributorListing } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-15T12:00:00Z");

function listing(
  distributorId: string,
  history: [number, number][], // [daysAgo, price]
  currentPrice?: number,
): DistributorListing {
  return {
    productId: "p",
    distributorId,
    price: currentPrice ?? history[history.length - 1]?.[1] ?? 0,
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

describe("computePriceVsAverage", () => {
  it("computes percent vs 30-day window average", () => {
    const result = computePriceVsAverage(
      [
        listing("a", [
          [60, 200], // outside window — excluded
          [10, 100],
          [2, 90],
        ]),
      ],
      "USD",
      30,
      NOW,
    );
    expect(result).not.toBeNull();
    expect(result!.average).toBe(95);
    expect(result!.current).toBe(90);
    // (90 - 95) / 95 * 100 = -5.263..., rounded to 1 decimal = -5.3 exactly.
    expect(result!.percentVsAvg).toBe(-5.3);
    expect(result!.verdict).toBe("below");
  });

  it("rounds the percent to one decimal (not floor)", () => {
    // avg 3, current 2 => -33.333...% which rounds to -33.3 (a floor gives
    // -33.4). Pins `Math.round`, not `Math.floor`.
    const result = computePriceVsAverage(
      [listing("a", [[10, 3], [5, 3]], 2)],
      "USD",
      30,
      NOW,
    );
    expect(result!.percentVsAvg).toBe(-33.3);
  });

  it("applies verdict thresholds at ±3%", () => {
    const mk = (current: number) =>
      computePriceVsAverage(
        [listing("a", [[10, 100], [5, 100], [0, current]])],
        "USD",
        30,
        NOW,
      )!.verdict;
    expect(mk(95)).toBe("below"); // avg 98.33 → -3.4%
    expect(mk(99)).toBe("at"); // -0.7%
    expect(mk(101)).toBe("at"); // +0.7%
    expect(mk(106)).toBe("above"); // avg 102 → +3.9%
  });

  it("returns null with fewer than two window points", () => {
    const result = computePriceVsAverage(
      [listing("a", [[10, 100]])],
      "USD",
      30,
      NOW,
    );
    expect(result).toBeNull();
  });

  it("returns null when nothing is in stock", () => {
    const l = listing("a", [[5, 100], [0, 90]]);
    l.stockStatus = "out_of_stock";
    expect(computePriceVsAverage([l], "USD", 30, NOW)).toBeNull();
  });

  it("skips non-convertible history points", () => {
    const l = listing("a", [[10, 100], [2, 90]]);
    l.priceHistory = l.priceHistory.map((p) => ({ ...p, currency: "XYZ" }));
    const result = computePriceVsAverage([l], "USD", 30, NOW);
    expect(result).toBeNull(); // no usable points
  });

  // `current` is an in-stock price, so the average must use in-stock history
  // only. An out-of-stock point (often a different price band) skewed the
  // verdict — the same class the all-time-low check fixed.
  it("excludes out-of-stock history points from the average", () => {
    const l = listing("a", [[10, 100], [5, 100], [0, 100]]);
    l.priceHistory = l.priceHistory.map((p, i) =>
      i === 0 ? { ...p, stockStatus: "out_of_stock" as const, price: 1000 } : p,
    );
    const result = computePriceVsAverage([l], "USD", 30, NOW);
    expect(result).not.toBeNull();
    // The 1000 out-of-stock point must not pull the average up.
    expect(result!.average).toBe(100);
    expect(result!.verdict).toBe("at");
  });
});
