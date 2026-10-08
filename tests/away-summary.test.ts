import { describe, expect, it } from "vitest";
import { computeAwaySummary } from "../lib/away-summary";
import type { Product } from "../lib/types";

const DAY = 86_400_000;
const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const SINCE = NOW - 3 * DAY;

function product(
  id: string,
  listings: {
    distributorId: string;
    price: number;
    stockStatus: string;
    date: string;
  }[],
): Product {
  return {
    id,
    name: id,
    modelNumber: id,
    brand: "X",
    category: "Router",
    isWatched: true,
    addedAt: new Date(SINCE - DAY).toISOString(),
    listings: listings.map((l) => ({
      distributorId: l.distributorId,
      productId: id,
      price: l.price,
      currency: "USD",
      stockStatus: l.stockStatus,
      url: "",
      lastChecked: l.date,
      priceHistory: [
        {
          date: l.date,
          price: l.price,
          currency: "USD",
          stockStatus: l.stockStatus,
        },
      ],
    })),
  } as unknown as Product;
}

describe("computeAwaySummary", () => {
  it("detects a price drop beyond the threshold", () => {
    const p = product("p1", [
      {
        distributorId: "d1",
        price: 100,
        stockStatus: "in_stock",
        date: new Date(SINCE - DAY).toISOString(),
      },
      {
        distributorId: "d1",
        price: 90,
        stockStatus: "in_stock",
        date: new Date(NOW).toISOString(),
      },
    ]);
    const s = computeAwaySummary({
      watchlist: [p],
      since: SINCE,
      now: NOW,
      displayCurrency: "USD",
    })!;
    expect(s.priceDrops).toHaveLength(1);
    expect(s.priceDrops[0]!.pct).toBeLessThan(0);
  });

  it("detects a restock", () => {
    const p = product("p2", [
      {
        distributorId: "d1",
        price: 100,
        stockStatus: "out_of_stock",
        date: new Date(SINCE - DAY).toISOString(),
      },
      {
        distributorId: "d1",
        price: 100,
        stockStatus: "in_stock",
        date: new Date(NOW).toISOString(),
      },
    ]);
    const s = computeAwaySummary({
      watchlist: [p],
      since: SINCE,
      now: NOW,
      displayCurrency: "USD",
    })!;
    expect(s.restocks).toHaveLength(1);
  });

  it("detects a stock-out", () => {
    const p = product("p3", [
      {
        distributorId: "d1",
        price: 100,
        stockStatus: "in_stock",
        date: new Date(SINCE - DAY).toISOString(),
      },
      {
        distributorId: "d1",
        price: 100,
        stockStatus: "out_of_stock",
        date: new Date(NOW).toISOString(),
      },
    ]);
    const s = computeAwaySummary({
      watchlist: [p],
      since: SINCE,
      now: NOW,
      displayCurrency: "USD",
    })!;
    expect(s.stockOuts).toHaveLength(1);
  });

  it("returns null when nothing changed", () => {
    const p = product("p4", [
      {
        distributorId: "d1",
        price: 100,
        stockStatus: "in_stock",
        date: new Date(SINCE - DAY).toISOString(),
      },
      {
        distributorId: "d1",
        price: 100,
        stockStatus: "in_stock",
        date: new Date(NOW).toISOString(),
      },
    ]);
    expect(
      computeAwaySummary({
        watchlist: [p],
        since: SINCE,
        now: NOW,
        displayCurrency: "USD",
      }),
    ).toBeNull();
  });

  it("skips a product with no history at or before since", () => {
    const p = product("p5", [
      {
        distributorId: "d1",
        price: 50,
        stockStatus: "in_stock",
        date: new Date(NOW).toISOString(),
      },
    ]);
    expect(
      computeAwaySummary({
        watchlist: [p],
        since: SINCE,
        now: NOW,
        displayCurrency: "USD",
      }),
    ).toBeNull();
  });
});
