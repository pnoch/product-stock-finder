import { describe, expect, it } from "vitest";
import { watchlistToCsv } from "../lib/csv";
import type { Product, DistributorListing } from "../lib/types";

function listing(overrides: Partial<DistributorListing>): DistributorListing {
  return {
    distributorId: "winncom-us",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

function product(id: string, listings: DistributorListing[], overrides?: Partial<Product>): Product {
  return {
    id,
    name: `Product ${id}`,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: new Date().toISOString(),
    listings,
    ...overrides,
  } as unknown as Product;
}

describe("watchlistToCsv", () => {
  it("emits header + rows with bestPrice via getBestPrice", () => {
    const products = [
      product("p1", [listing({ price: 100, currency: "USD", stockStatus: "in_stock" }), listing({ price: 90, currency: "EUR", stockStatus: "in_stock" })]),
      product("p2", [listing({ price: 50, currency: "USD", stockStatus: "out_of_stock" })]),
    ];
    const csv = watchlistToCsv(products, "USD");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("product,model,brand,category,bestPrice,stockStatus");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Product p1");
    expect(lines[1]).toContain("in_stock");
    expect(lines[1]).toContain("$");
    expect(lines[2]).toContain("Product p2");
    expect(lines[2]).toContain("out_of_stock");
    const p2Cols = lines[2].split(",");
    expect(p2Cols[4]).toBe("");
  });

  it("handles empty watchlist with header only", () => {
    const csv = watchlistToCsv([], "USD");
    expect(csv).toBe("product,model,brand,category,bestPrice,stockStatus");
  });

  it("converts bestPrice to requested currency", () => {
    const products = [product("p1", [listing({ price: 100, currency: "USD", stockStatus: "in_stock" })])];
    const csvUsd = watchlistToCsv(products, "USD");
    const csvEur = watchlistToCsv(products, "EUR");
    expect(csvUsd).toContain("$");
    expect(csvEur).toContain("€");
  });

  it("resolves stockStatus correctly", () => {
    const inStock = product("p1", [listing({ stockStatus: "in_stock" }), listing({ stockStatus: "out_of_stock" })]);
    const backOrder = product("p2", [listing({ stockStatus: "back_order" }), listing({ stockStatus: "out_of_stock" })]);
    const outOf = product("p3", [listing({ stockStatus: "out_of_stock" })]);
    const empty = product("p4", []);
    const csv = watchlistToCsv([inStock, backOrder, outOf, empty], "USD");
    const lines = csv.split("\n");
    expect(lines[1]).toContain("in_stock");
    expect(lines[2]).toContain("back_order");
    expect(lines[3]).toContain("out_of_stock");
    expect(lines[4]).toContain("unknown");
  });

  it("escapes commas and quotes in fields", () => {
    const p = product("p1", [listing({ stockStatus: "in_stock" })], { name: 'My, "Special" Product', brand: 'Brand, Inc.' });
    const csv = watchlistToCsv([p], "USD");
    const line = csv.split("\n")[1];
    expect(line).toContain('"My, ""Special"" Product"');
    expect(line).toContain('"Brand, Inc."');
  });

  it("produces stable output for product with no listings", () => {
    const p = product("p1", []);
    const csv = watchlistToCsv([p], "USD");
    const cols = csv.split("\n")[1].split(",");
    expect(cols[4]).toBe("");
    expect(cols[5]).toBe("unknown");
  });
});
