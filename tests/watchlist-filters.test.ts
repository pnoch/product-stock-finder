import { describe, it, expect } from "vitest";
import { filterWatchlist, sortWatchlist } from "../lib/watchlist-org";
import type { DistributorListing, Product } from "../lib/types";

function listing(overrides: Partial<DistributorListing> = {}): DistributorListing {
  return {
    distributorId: "server2u-my",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
    ...overrides,
  };
}
function product(id: string, price: number, currency = "USD", status: DistributorListing["stockStatus"] = "in_stock"): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [{ ...listing({ price, currency, stockStatus: status }), productId: id }],
  } as Product;
}

describe("priceRange filter via convertPrice + CURRENCY_SYMBOLS", () => {
  it("filters by priceRange in displayCurrency", () => {
    const cheap = product("a", 50, "USD");
    const mid = product("b", 150, "USD");
    const pricey = product("c", 300, "USD");
    const list = [cheap, mid, pricey];
    const filtered = filterWatchlist(list, {
      region: "all",
      tagIds: [],
      tagMatchMode: "any",
      status: "all",
      query: "",
      priceRange: [100, 200],
      displayCurrency: "USD",
    });
    expect(filtered.map((p) => p.id)).toEqual(["b"]);
  });

  it("excludes products with no best price when priceRange is set", () => {
    const noPrice = product("a", 0, "USD", "out_of_stock");
    const filtered = filterWatchlist([noPrice], {
      region: "all",
      tagIds: [],
      tagMatchMode: "any",
      status: "all",
      query: "",
      priceRange: [0, 1000],
      displayCurrency: "USD",
    });
    expect(filtered).toHaveLength(0);
  });
});

describe("inStockOnly toggle", () => {
  it("filters to in_stock only when toggle on", () => {
    const inStock = product("a", 100, "USD", "in_stock");
    const back = product("b", 100, "USD", "back_order");
    const out = product("c", 100, "USD", "out_of_stock");
    const filtered = filterWatchlist([inStock, back, out], {
      region: "all",
      tagIds: [],
      tagMatchMode: "any",
      status: "all",
      query: "",
      inStockOnly: true,
    });
    expect(filtered.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("sort best_price uses displayCurrency", () => {
  it("sorts by converted best price", () => {
    const eurCheap = product("a", 100, "EUR");
    const usd80 = product("b", 80, "USD");
    expect(sortWatchlist([eurCheap, usd80], "best_price", "EUR").map((p) => p.id)).toEqual(["b", "a"]);
  });
});
