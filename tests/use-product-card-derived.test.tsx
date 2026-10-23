// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DistributorListing, Product, TagDefinition } from "../lib/types";
import { useProductCardDerived } from "../hooks/use-product-card-derived";

function listing(
  distributorId: string,
  price: number,
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com",
    lastChecked: "2026-02-01T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  };
}

function product(listings: DistributorListing[], tags: string[] = []): Product {
  return {
    id: "p1",
    name: "Test",
    modelNumber: "T-1",
    brand: "Brand",
    category: "Router",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings,
    tags,
  };
}

const tags: Record<string, TagDefinition> = {
  "tag-1": { id: "tag-1", name: "Wanted", color: "#fff" },
};

describe("useProductCardDerived", () => {
  it("picks the cheapest in-stock price", () => {
    const { result } = renderHook(() =>
      useProductCardDerived({
        product: product([listing("a", 120), listing("b", 90)]),
        tagDefinitions: tags,
      }),
    );
    expect(result.current.bestPrice?.price).toBe(90);
  });

  it("requires an in-stock listing with a URL for the buy action", () => {
    const { result } = renderHook(() =>
      useProductCardDerived({
        product: product([
          listing("a", 50, { stockStatus: "out_of_stock" }),
          listing("b", 80, { url: "" }),
          listing("c", 100),
        ]),
        tagDefinitions: tags,
      }),
    );
    expect(result.current.bestInStockListing?.distributorId).toBe("c");
  });

  it("reports in-stock status when any listing is in stock", () => {
    const { result } = renderHook(() =>
      useProductCardDerived({
        product: product([
          listing("a", 50, { stockStatus: "out_of_stock" }),
          listing("b", 80),
        ]),
        tagDefinitions: tags,
      }),
    );
    expect(result.current.bestStatus).toBe("in_stock");
  });

  it("drops orphaned tag ids", () => {
    const { result } = renderHook(() =>
      useProductCardDerived({
        product: product([listing("a", 100)], ["tag-1", "missing"]),
        tagDefinitions: tags,
      }),
    );
    expect(result.current.validTags).toEqual(["tag-1"]);
  });

  it("shows the insight row for an all-time low or hot deal", () => {
    const low = renderHook(() =>
      useProductCardDerived({
        product: product([listing("a", 100)]),
        tagDefinitions: tags,
        insight: { atAllTimeLow: true, dropStreak: 0 },
      }),
    );
    expect(low.result.current.showInsightRow).toBe(true);

    const hot = renderHook(() =>
      useProductCardDerived({
        product: product([listing("a", 100)]),
        tagDefinitions: tags,
        dealScore: { score: 90, band: "hot" } as never,
      }),
    );
    expect(hot.result.current.showInsightRow).toBe(true);

    const none = renderHook(() =>
      useProductCardDerived({
        product: product([listing("a", 100)]),
        tagDefinitions: tags,
      }),
    );
    expect(none.result.current.showInsightRow).toBe(false);
  });

  it("counts distributor listings", () => {
    const { result } = renderHook(() =>
      useProductCardDerived({
        product: product([listing("a", 100), listing("b", 110)]),
        tagDefinitions: tags,
      }),
    );
    expect(result.current.distributorCount).toBe(2);
  });
});
