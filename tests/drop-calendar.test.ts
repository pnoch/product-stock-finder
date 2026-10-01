import { describe, expect, it } from "vitest";
import { computeDropCalendar } from "../lib/drop-calendar";
import type { DistributorListing, Product } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-15T12:00:00Z"); // Monday UTC

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

describe("computeDropCalendar", () => {
  it("ignores a drop that happened entirely out of stock", () => {
    const oos = {
      productId: "p",
      distributorId: "a",
      price: 60,
      currency: "USD",
      stockStatus: "out_of_stock",
      url: "",
      lastChecked: new Date(NOW - DAY).toISOString(),
      priceHistory: [
        {
          date: new Date(NOW - 5 * DAY).toISOString(),
          price: 100,
          currency: "USD",
          stockStatus: "out_of_stock" as const,
        },
        {
          date: new Date(NOW - 2 * DAY).toISOString(),
          price: 60,
          currency: "USD",
          stockStatus: "out_of_stock" as const,
        },
      ],
    } as DistributorListing;
    const result = computeDropCalendar([product("p1", [oos])], "USD", 30, NOW);
    expect(result.totalDrops).toBe(0);
  });

  it("attributes drops to the later point's day", () => {
    const result = computeDropCalendar(
      [product("p1", [listing("a", [[5, 100], [2, 80]])])],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(1);
    const keys = [...result.byDay.keys()];
    expect(keys).toHaveLength(1);
    const day = result.byDay.get(keys[0])!;
    expect(day.dropCount).toBe(1);
    expect(day.drops[0].from).toBe(100);
    expect(day.drops[0].to).toBe(80);
    expect(day.biggestPct).toBeCloseTo(-20, 1);
  });

  it("ignores increases and flat pairs", () => {
    const result = computeDropCalendar(
      [product("p1", [listing("a", [[6, 50], [3, 90], [0, 90]])])],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(0);
  });

  it("excludes pairs outside the window", () => {
    const result = computeDropCalendar(
      [product("p1", [listing("a", [[60, 200], [55, 10]])])],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(0);
  });

  it("groups multiple drops on the same day", () => {
    const result = computeDropCalendar(
      [
        product("p1", [listing("a", [[4, 100], [1, 80]])]),
        product("p2", [listing("b", [[4, 60], [1, 30]])]),
      ],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(2);
    const day = [...result.byDay.values()][0];
    expect(day.dropCount).toBe(2);
    expect(day.biggestPct).toBeCloseTo(-50, 1);
  });

  it("skips non-convertible currencies", () => {
    const l = listing("a", [[4, 100], [1, 80]]);
    l.priceHistory = l.priceHistory.map((p) => ({ ...p, currency: "XYZ" }));
    const result = computeDropCalendar([product("p1", [l])], "USD", 30, NOW);
    expect(result.totalDrops).toBe(0);
  });

  it("handles an empty watchlist", () => {
    const result = computeDropCalendar([], "USD", 30, NOW);
    expect(result.totalDrops).toBe(0);
    expect(result.byDay.size).toBe(0);
  });

  it("keeps the largest same-day drop for one product/distributor", () => {
    const l = {
      productId: "p",
      distributorId: "a",
      price: 76,
      currency: "USD",
      stockStatus: "in_stock",
      url: "",
      lastChecked: new Date(NOW).toISOString(),
      priceHistory: [
        { date: new Date(NOW - 5 * 3600_000).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" as const },
        { date: new Date(NOW - 3 * 3600_000).toISOString(), price: 95, currency: "USD", stockStatus: "in_stock" as const },
        { date: new Date(NOW - 1 * 3600_000).toISOString(), price: 76, currency: "USD", stockStatus: "in_stock" as const },
      ],
    } as DistributorListing;
    const result = computeDropCalendar([product("p1", [l])], "USD", 30, NOW);
    expect(result.totalDrops).toBe(1);
    const day = [...result.byDay.values()][0]!;
    expect(day.dropCount).toBe(1);
    expect(day.drops).toHaveLength(1);
    // The 100→95 (-5%) entry is replaced by the larger 95→76 (-20%) move.
    expect(day.drops[0]!.from).toBeCloseTo(95, 5);
    expect(day.drops[0]!.to).toBeCloseTo(76, 5);
    expect(day.drops[0]!.percent).toBeCloseTo(-20, 1);
    expect(day.biggestPct).toBeCloseTo(-20, 1);
  });

  it("keeps the first same-day drop when a later move is smaller", () => {
    const l = {
      productId: "p",
      distributorId: "a",
      price: 85,
      currency: "USD",
      stockStatus: "in_stock",
      url: "",
      lastChecked: new Date(NOW).toISOString(),
      priceHistory: [
        { date: new Date(NOW - 5 * 3600_000).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" as const },
        { date: new Date(NOW - 3 * 3600_000).toISOString(), price: 90, currency: "USD", stockStatus: "in_stock" as const },
        { date: new Date(NOW - 1 * 3600_000).toISOString(), price: 85, currency: "USD", stockStatus: "in_stock" as const },
      ],
    } as DistributorListing;
    const result = computeDropCalendar([product("p1", [l])], "USD", 30, NOW);
    const day = [...result.byDay.values()][0]!;
    expect(day.drops).toHaveLength(1);
    // 100→90 (-10%) beats the later 90→85 (-5.6%), so the first stays.
    expect(day.drops[0]!.from).toBeCloseTo(100, 5);
    expect(day.drops[0]!.to).toBeCloseTo(90, 5);
    expect(day.drops[0]!.percent).toBeCloseTo(-10, 1);
    expect(day.biggestPct).toBeCloseTo(-10, 1);
  });
});
