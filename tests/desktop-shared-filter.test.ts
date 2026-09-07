import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { filterWatchlist } from "../lib/watchlist-org";
import type { Product } from "../lib/types";

const base = {
  id: "p1",
  name: "RTX 4090",
  brand: "NVIDIA",
  modelNumber: "NV-4090",
  category: "GPUs",
  listings: [
    {
      distributorId: "d1",
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      priceHistory: [],
    },
  ],
} as unknown as Product;

const baseFilters = {
  region: "all",
  tagIds: [] as string[],
  tagMatchMode: "any" as const,
  status: "all" as const,
  query: "",
  priceRange: undefined as [number, number] | undefined,
  inStockOnly: false,
  displayCurrency: "USD",
};

describe("desktop shared filter", () => {
  it("delegates desktop filtering to filterWatchlist", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("filterWatchlist(products");
  });

  it("matches brand and category queries", () => {
    expect(filterWatchlist([base], { ...baseFilters, query: "nvidia" })).toHaveLength(1);
    expect(filterWatchlist([base], { ...baseFilters, query: "gpus" })).toHaveLength(1);
    expect(filterWatchlist([base], { ...baseFilters, query: "nope" })).toHaveLength(0);
  });

  it("handles null listings and every FilterKey status", () => {
    const noListings = { ...base, listings: null } as unknown as Product;
    expect(filterWatchlist([noListings], baseFilters)).toHaveLength(1);
    for (const status of ["all", "in_stock", "back_order", "out_of_stock"] as const) {
      expect(() =>
        filterWatchlist([base], { ...baseFilters, status }),
      ).not.toThrow();
    }
  });
});
