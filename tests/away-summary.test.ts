import { describe, expect, it } from "vitest";
import { computeAwaySummary } from "../lib/away-summary";
import type { Product } from "../lib/types";

const DAY = 86_400_000;
const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const SINCE = NOW - 3 * DAY;

function product(
  id: string,
  points: {
    distributorId: string;
    price: number;
    stockStatus: string;
    date: string;
  }[],
): Product {
  // Real data: one listing per distributor carrying its full history, with the
  // current price/status being the latest point. Group the given points by
  // distributor so the fixture models that shape.
  const byDistributor = new Map<string, typeof points>();
  for (const p of points) {
    const group = byDistributor.get(p.distributorId);
    if (group) group.push(p);
    else byDistributor.set(p.distributorId, [p]);
  }
  return {
    id,
    name: id,
    modelNumber: id,
    brand: "X",
    category: "Router",
    isWatched: true,
    addedAt: new Date(SINCE - DAY).toISOString(),
    listings: [...byDistributor.entries()].map(([distributorId, group]) => {
      const sorted = [...group].sort(
        (a, b) => Date.parse(a.date) - Date.parse(b.date),
      );
      const latest = sorted[sorted.length - 1]!;
      return {
        distributorId,
        productId: id,
        price: latest.price,
        currency: "USD",
        stockStatus: latest.stockStatus,
        url: "",
        lastChecked: latest.date,
        priceHistory: sorted.map((p) => ({
          date: p.date,
          price: p.price,
          currency: "USD",
          stockStatus: p.stockStatus,
        })),
      };
    }),
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

  it("detects a price rise beyond the threshold", () => {
    const p = product("p6", [
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - DAY).toISOString() },
      { distributorId: "d1", price: 120, stockStatus: "in_stock", date: new Date(NOW).toISOString() },
    ]);
    const s = computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })!;
    expect(s.priceRises).toHaveLength(1);
    expect(s.priceRises[0]!.pct).toBeGreaterThan(0);
  });

  it("ignores a move below the minDropPct threshold", () => {
    // 100 -> 98 is a 2% drop, below the default 3%.
    const p = product("p7", [
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - DAY).toISOString() },
      { distributorId: "d1", price: 98, stockStatus: "in_stock", date: new Date(NOW).toISOString() },
    ]);
    expect(computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })).toBeNull();
  });

  it("does not report a stock-out when an in-stock listing was not re-sampled since", () => {
    // In stock at SINCE-2d and SINCE-1d, but no sample after `since`. "Not
    // refreshed" must not masquerade as "now out of stock".
    const p = product("p9", [
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - 2 * DAY).toISOString() },
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - DAY).toISOString() },
    ]);
    expect(computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })).toBeNull();
  });

  it("honors a custom minDropPct", () => {
    const p = product("p8", [
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - DAY).toISOString() },
      { distributorId: "d1", price: 98, stockStatus: "in_stock", date: new Date(NOW).toISOString() },
    ]);
    const s = computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD", minDropPct: 1 })!;
    expect(s.priceDrops).toHaveLength(1);
  });
});
