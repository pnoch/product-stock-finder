import { describe, expect, it } from "vitest";
import { computeProductInsights } from "../lib/product-insights";
import { computeDropCalendar, dateKey } from "../lib/drop-calendar";
import type { Product } from "../lib/types";

function listing(
  distributorId: string,
  prices: Array<[string, number]>,
  stockStatus = "in_stock",
) {
  return {
    distributorId,
    productId: "p1",
    price: prices[prices.length - 1]![1],
    currency: "USD",
    stockStatus,
    url: "",
    lastChecked: "2026-01-01T00:00:00.000Z",
    priceHistory: prices.map(([date, price]) => ({
      date,
      price,
      currency: "USD",
      stockStatus,
    })),
  };
}

function product(listings: ReturnType<typeof listing>[]): Product {
  return {
    id: "p1",
    name: "P",
    modelNumber: "M1",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings,
  } as Product;
}

describe("atAllTimeLow compares like with like", () => {
  it("flags a genuine all-time low on a multi-distributor product", () => {
    // Distributor A has always been 100; B has always been 200. Current best
    // (100) equals the historical best (100) → all-time low. The old
    // average-based check compared 100 against the 150 average and missed it.
    const p = product([
      listing("a", [["2026-01-01T00:00:00.000Z", 100]]),
      listing("b", [["2026-01-01T00:00:00.000Z", 200]]),
    ]);
    const result = computeProductInsights([p], "USD");
    expect(result.products[0]!.atAllTimeLow).toBe(true);
  });

  it("does not flag when the current best is above the historical best", () => {
    const p = product([
      listing("a", [
        ["2026-01-01T00:00:00.000Z", 90],
        ["2026-02-01T00:00:00.000Z", 100],
      ]),
    ]);
    const result = computeProductInsights([p], "USD");
    expect(result.products[0]!.atAllTimeLow).toBe(false);
  });
});

describe("drop calendar keeps the largest intraday drop", () => {
  it("reports the biggest percent when a listing drops twice in one day", () => {
    const day = "2026-03-10T";
    const p = product([
      listing("a", [
        [`${day}08:00:00.000Z`, 100],
        [`${day}12:00:00.000Z`, 95], // -5%
        [`${day}18:00:00.000Z`, 76], // -20%
      ]),
    ]);
    const result = computeDropCalendar(
      [p],
      "USD",
      30,
      Date.parse("2026-03-11T00:00:00.000Z"),
    );
    const d = result.byDay.get(dateKey(Date.parse(`${day}18:00:00.000Z`)));
    expect(d).toBeDefined();
    expect(d!.biggestPct).toBe(-20);
    expect(d!.drops).toHaveLength(1);
    expect(d!.drops[0]!.percent).toBe(-20);
  });
});
