import { describe, expect, it } from "vitest";
import { pickAlternatives, localAlternatives } from "../lib/alternatives";
import type { AvailableProduct, Product } from "../lib/types";

function avail(id: string, category: string, price: number): AvailableProduct {
  return {
    id, name: id, brand: "X", category, modelNumber: id,
    bestPrice: price, bestCurrency: "USD", bestDistributorId: "d1",
    storeCount: 2, fetchedAt: 1000,
  };
}

describe("pickAlternatives", () => {
  it("filters to the category, excludes self, sorts by price, caps at limit", () => {
    const available = [
      avail("self", "Switch", 1),
      avail("b", "Switch", 300),
      avail("a", "Switch", 100),
      avail("c", "Switch", 200),
      avail("d", "Switch", 400),
      avail("e", "Switch", 500),
      avail("f", "Switch", 600),
      avail("other", "Router", 50),
    ];
    const out = pickAlternatives({ product: { id: "self", category: "Switch" }, available });
    expect(out.map((a) => a.id)).toEqual(["a", "c", "b", "d", "e"]);
    expect(out).toHaveLength(5);
  });

  it("returns [] when none match", () => {
    expect(
      pickAlternatives({ product: { id: "self", category: "Switch" }, available: [avail("x", "Router", 1)] }),
    ).toEqual([]);
  });
});

describe("localAlternatives", () => {
  it("builds from in-stock watchlist products in the category, excluding self", () => {
    const watchlist = [
      { id: "self", name: "self", category: "Switch", listings: [] },
      { id: "a", name: "A", category: "Switch", listings: [{ distributorId: "d1", price: 100, currency: "USD", stockStatus: "in_stock" }] },
      { id: "b", name: "B", category: "Switch", listings: [{ distributorId: "d1", price: 50, currency: "USD", stockStatus: "out_of_stock" }] },
      { id: "c", name: "C", category: "Router", listings: [{ distributorId: "d1", price: 10, currency: "USD", stockStatus: "in_stock" }] },
    ] as unknown as Product[];
    const out = localAlternatives({ id: "self", category: "Switch" }, watchlist, "USD");
    expect(out.map((a) => a.id)).toEqual(["a"]);
  });

  it("excludes self even when it is in stock, and sorts cheapest first", () => {
    const watchlist = [
      { id: "self", name: "self", category: "Switch", listings: [{ distributorId: "d1", price: 1, currency: "USD", stockStatus: "in_stock" }] },
      { id: "dear", name: "Dear", category: "Switch", listings: [{ distributorId: "d1", price: 300, currency: "USD", stockStatus: "in_stock" }] },
      { id: "cheap", name: "Cheap", category: "Switch", listings: [{ distributorId: "d1", price: 100, currency: "USD", stockStatus: "in_stock" }] },
    ] as unknown as Product[];
    const out = localAlternatives({ id: "self", category: "Switch" }, watchlist, "USD");
    expect(out.map((a) => a.id)).toEqual(["cheap", "dear"]);
  });
});
