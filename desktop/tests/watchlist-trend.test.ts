import { describe, expect, it } from "vitest";
import { getTrend } from "../src/pages/Watchlist";
import type { Product } from "../../lib/types";

function product(history: { date: string; price: number }[]): Product {
  return {
    id: "p1",
    name: "P",
    modelNumber: "M",
    brand: "B",
    category: "C",
    description: "",
    isWatched: true,
    addedAt: "2026-01-01T00:00:00.000Z",
    listings: [
      {
        distributorId: "d1",
        productId: "p1",
        price: history[history.length - 1]?.price ?? 0,
        currency: "USD",
        stockStatus: "in_stock",
        url: "",
        lastChecked: "2026-01-03T00:00:00.000Z",
        priceHistory: history.map((h) => ({
          ...h,
          currency: "USD",
          stockStatus: "in_stock" as const,
        })),
      },
    ],
  } as Product;
}

describe("getTrend", () => {
  it("reports a drop for an ascending history", () => {
    expect(
      getTrend(
        product([
          { date: "2026-01-01T00:00:00.000Z", price: 100 },
          { date: "2026-01-02T00:00:00.000Z", price: 75 },
          { date: "2026-01-03T00:00:00.000Z", price: 50 },
        ]),
      ),
    ).toBe("down");
  });

  it("reports the same drop for a descending history", () => {
    // A history restored from a backup/server pull can be newest-first; the
    // positional read previously reported "up" for this dropping price.
    expect(
      getTrend(
        product([
          { date: "2026-01-03T00:00:00.000Z", price: 50 },
          { date: "2026-01-02T00:00:00.000Z", price: 75 },
          { date: "2026-01-01T00:00:00.000Z", price: 100 },
        ]),
      ),
    ).toBe("down");
  });

  it("reports a rise regardless of stored order", () => {
    const asc = [
      { date: "2026-01-01T00:00:00.000Z", price: 50 },
      { date: "2026-01-02T00:00:00.000Z", price: 75 },
      { date: "2026-01-03T00:00:00.000Z", price: 100 },
    ];
    expect(getTrend(product(asc))).toBe("up");
    expect(getTrend(product([...asc].reverse()))).toBe("up");
  });
});
