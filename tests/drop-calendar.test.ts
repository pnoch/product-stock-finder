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
});
