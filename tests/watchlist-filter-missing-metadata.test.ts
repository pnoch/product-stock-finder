import { describe, expect, it } from "vitest";
import { filterWatchlist, countTagMatches } from "../lib/watchlist-org";
import type { Product } from "../lib/types";

function product(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    name: "Name",
    modelNumber: "M1",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
    ...overrides,
  };
}

const baseFilters = {
  region: "all" as const,
  status: "all" as const,
  query: "crs",
  priceRange: undefined,
  inStockOnly: false,
  displayCurrency: "USD",
  tagIds: [] as string[],
  tagMatchMode: "any" as const,
};

describe("watchlist filter tolerates missing optional metadata", () => {
  it("does not throw when brand/model/category are undefined", () => {
    const p = product({
      name: "MikroTik",
      modelNumber: undefined as unknown as string,
      brand: undefined as unknown as string,
      category: undefined as unknown as string,
    });
    expect(() => filterWatchlist([p], baseFilters)).not.toThrow();
    expect(() => countTagMatches([p], baseFilters)).not.toThrow();
  });

  it("still matches on the name", () => {
    const p = product({
      name: "MikroTik CRS804",
      modelNumber: undefined as unknown as string,
      brand: undefined as unknown as string,
      category: undefined as unknown as string,
    });
    expect(filterWatchlist([p], baseFilters)).toHaveLength(1);
  });
});
