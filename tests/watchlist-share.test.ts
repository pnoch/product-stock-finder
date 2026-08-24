import { describe, expect, it } from "vitest";
import { buildWatchlistShareText } from "../lib/watchlist-share";
import type { DistributorListing, Product } from "../lib/types";

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
  } as DistributorListing;
}

function product(id: string, listings: DistributorListing[]): Product {
  return {
    id,
    name: id,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: new Date(NOW).toISOString(),
    listings,
  } as unknown as Product;
}

describe("buildWatchlistShareText", () => {
  it("includes all sections when data is present", () => {
    const watchlist = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore-de",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 82, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
      product("p2", [listing({ distributorId: "winncom-us", price: 50 })]),
    ];
    const text = buildWatchlistShareText(
      { watchlist, displayCurrency: "USD", days: 30, now: NOW },
    );
    expect(text).toContain("My Watchlist — 2 products");
    expect(text).toContain("Basket value:");
    expect(text).toContain("Biggest drops (30d):");
    expect(text).toContain("-18%");
    expect(text).toContain("Stock health:");
    expect(text.trimEnd().endsWith("via Product Stock Finder")).toBe(true);
  });

  it("omits sections when data is missing", () => {
    const text = buildWatchlistShareText(
      { watchlist: [product("p1", [])], displayCurrency: "USD", days: 7, now: NOW },
    );
    expect(text).not.toContain("Biggest drops");
    expect(text).not.toContain("Stock health");
    expect(text).toContain("My Watchlist — 1 products");
  });

  it("labels the window for each range", () => {
    const mk = (days: 7 | 30 | null) =>
      buildWatchlistShareText({ watchlist: [product("p1", [])], displayCurrency: "USD", days, now: NOW });
    expect(mk(7)).toContain("(7d)");
    expect(mk(30)).toContain("(30d)");
    expect(mk(null)).toContain("(all time)");
  });

  it("truncates movers to three rows", () => {
    const watchlist = Array.from({ length: 5 }, (_, i) =>
      product(`p${i}`, [
        listing({
          distributorId: "winncom-us",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 200 - i * 10, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 100 + i * 10, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
    );
    const text = buildWatchlistShareText({ watchlist, displayCurrency: "USD", days: 30, now: NOW });
    const dropRows = text.split("\n").filter((l) => l.includes("— -"));
    expect(dropRows.length).toBeLessThanOrEqual(3);
  });

  it("renders minimal output for an empty watchlist", () => {
    const text = buildWatchlistShareText({ watchlist: [], displayCurrency: "USD", days: 30, now: NOW });
    expect(text).toContain("My Watchlist — 0 products");
    expect(text.trimEnd().endsWith("via Product Stock Finder")).toBe(true);
  });
});
