import { describe, expect, it } from "vitest";
import {
  computeMovers,
  computeBasketValue,
  computeStockHealth,
  computeDataFreshness,
} from "@/lib/watchlist-stats";
import type { DistributorListing, Product } from "@/lib/types";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function listing(
  overrides: Partial<DistributorListing> & { distributorId: string },
): DistributorListing {
  return {
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW - DAY).toISOString(),
    priceHistory: [],
    ...overrides,
  };
}

function product(
  id: string,
  listings: DistributorListing[],
  name = id,
): Product {
  return {
    id,
    name,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: new Date(NOW).toISOString(),
    listings,
  };
}

describe("computeMovers", () => {
  it("ranks drops and gainers by magnitude within the window", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 80, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ], "Router A"),
      product("p2", [
        listing({
          distributorId: "winncom",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 200, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 250, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ], "Router B"),
      product("p3", [
        listing({
          distributorId: "miro",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 50, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 40, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ], "Router C"),
    ];
    const result = computeMovers(wl, "USD", 30, NOW);
    expect(result.drops.map((d) => d.productId)).toEqual(["p1", "p3"]);
    expect(result.drops[0].changePct).toBe(-20);
    expect(result.gainers.map((g) => g.productId)).toEqual(["p2"]);
    expect(result.gainers[0].changePct).toBe(25);
  });

  it("excludes points outside the window", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore",
          priceHistory: [
            { date: new Date(NOW - 90 * DAY).toISOString(), price: 300, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 95, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
    ];
    const result = computeMovers(wl, "USD", 7, NOW);
    expect(result.drops[0]).toMatchObject({ changePct: -5 });
  });

  it("skips listings with fewer than two points in window", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore",
          priceHistory: [
            { date: new Date(NOW).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
    ];
    expect(computeMovers(wl, "USD", 30, NOW)).toEqual({ drops: [], gainers: [] });
  });

  it("converts foreign currencies into the display currency", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "interprojekt",
          priceHistory: [
            { date: new Date(NOW - DAY).toISOString(), price: 100, currency: "EUR", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 90, currency: "EUR", stockStatus: "in_stock" },
          ],
        }),
      ]),
    ];
    const result = computeMovers(wl, "USD", 30, NOW);
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0].currency).toBe("USD");
    expect(result.drops[0].oldPrice).toBeGreaterThan(0);
  });
});

describe("computeBasketValue", () => {
  it("sums cheapest in-stock price per product and counts exclusions", () => {
    const wl = [
      product("p1", [
        listing({ distributorId: "a", price: 120 }),
        listing({ distributorId: "b", price: 100 }),
      ]),
      product("p2", [listing({ distributorId: "a", price: 50 })]),
      product("p3", [
        listing({ distributorId: "a", stockStatus: "out_of_stock", price: 70 }),
      ]),
    ];
    expect(computeBasketValue(wl, "USD")).toEqual({
      total: 150,
      productCount: 2,
      excludedCount: 1,
    });
  });

  it("counts a back-order listing (matches getBestPrice orderability)", () => {
    const wl = [
      product("p1", [
        listing({ distributorId: "a", stockStatus: "back_order", price: 80 }),
      ]),
    ];
    // back_order is orderable, so the product is not excluded.
    expect(computeBasketValue(wl, "USD")).toEqual({
      total: 80,
      productCount: 1,
      excludedCount: 0,
    });
  });

  it("excludes an unknown-availability listing", () => {
    const wl = [
      product("p1", [
        listing({ distributorId: "a", stockStatus: "unknown", price: 80 }),
      ]),
    ];
    expect(computeBasketValue(wl, "USD")).toEqual({
      total: 0,
      productCount: 0,
      excludedCount: 1,
    });
  });
});

describe("computeStockHealth", () => {
  it("computes percentage and per-product extremes", () => {
    const wl = [
      product("p1", [
        listing({ distributorId: "a", stockStatus: "in_stock" }),
        listing({ distributorId: "b", stockStatus: "back_order" }),
      ]),
      product("p2", [
        listing({ distributorId: "a", stockStatus: "out_of_stock" }),
        listing({ distributorId: "b", stockStatus: "out_of_stock" }),
      ]),
      product("p3", [
        listing({ distributorId: "a", stockStatus: "back_order" }),
      ]),
    ];
    expect(computeStockHealth(wl)).toEqual({
      totalListings: 5,
      inStockPct: 20,
      fullyOutOfStock: 1,
      backOrderOnly: 1,
    });
  });

  it("returns zeros for an empty watchlist", () => {
    expect(computeStockHealth([])).toEqual({
      totalListings: 0,
      inStockPct: 0,
      fullyOutOfStock: 0,
      backOrderOnly: 0,
    });
  });
});

describe("computeDataFreshness", () => {
  it("computes averages, staleness, and oldest check", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "a",
          lastChecked: new Date(NOW - 10 * DAY).toISOString(),
          priceHistory: [{ date: "", price: 1, currency: "USD", stockStatus: "in_stock" }],
        }),
        listing({
          distributorId: "b",
          lastChecked: new Date(NOW - 2 * DAY).toISOString(),
          priceHistory: [],
        }),
      ]),
      product("p2", [
        listing({ distributorId: "a", lastChecked: undefined, priceHistory: [] }),
      ]),
    ];
    expect(computeDataFreshness(wl, NOW)).toEqual({
      avgHistoryPoints: 0.5,
      staleCount: 1,
      neverCheckedCount: 1,
      oldestCheck: new Date(NOW - 10 * DAY).toISOString(),
    });
  });
});
