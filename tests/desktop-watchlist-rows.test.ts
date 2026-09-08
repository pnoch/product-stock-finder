import { describe, expect, it } from "vitest";
import { flattenWatchlistRows } from "../desktop/src/lib/watchlist-rows";
import { groupWatchlist } from "../lib/watchlist-org";
import type { Product } from "../lib/types";

function makeProduct(id: string, name: string, stockStatus = "in_stock"): Product {
  return {
    id,
    name,
    brand: "TestBrand",
    modelNumber: `model-${id}`,
    listings: [{ distributorId: "test-dist", stockStatus, priceHistory: [] }],
  } as unknown as Product;
}

describe("flattenWatchlistRows", () => {
  it("off-mode maps sorted products to product rows preserving order and identity", () => {
    const a = makeProduct("a", "Alpha");
    const b = makeProduct("b", "Beta");
    const rows = flattenWatchlistRows("off", [a, b], []);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ kind: "product", product: a });
    expect(rows[1]).toEqual({ kind: "product", product: b });
    if (rows[0]?.kind === "product") expect(rows[0].product).toBe(a);
    if (rows[1]?.kind === "product") expect(rows[1].product).toBe(b);
  });

  it("grouped mode emits header descriptors with key/title/count followed by products in order", () => {
    const a = makeProduct("a", "Alpha");
    const b = makeProduct("b", "Beta");
    const rows = flattenWatchlistRows("status", [a, b], [
      { key: "status-in_stock", title: "In Stock", products: [a] },
      { key: "status-back_order", title: "Back Order", products: [b] },
    ]);
    expect(rows).toEqual([
      { kind: "header", key: "status-in_stock", title: "In Stock", count: 1 },
      { kind: "product", product: a },
      { kind: "header", key: "status-back_order", title: "Back Order", count: 1 },
      { kind: "product", product: b },
    ]);
  });

  it("grouped mode with an empty sections list returns []", () => {
    const a = makeProduct("a", "Alpha");
    expect(flattenWatchlistRows("status", [a], [])).toEqual([]);
  });

  it("off-mode with empty sorted returns []", () => {
    expect(flattenWatchlistRows("off", [], [])).toEqual([]);
  });

  it("flattens real groupWatchlist output with empty sections already filtered", () => {
    const inStock = makeProduct("a", "Alpha", "in_stock");
    const backOrdered = makeProduct("b", "Beta", "back_order");
    const sorted = [inStock, backOrdered];
    const sections = groupWatchlist(sorted, "status", {});
    expect(sections.map((s) => s.key)).toEqual(["status-in_stock", "status-back_order"]);
    const rows = flattenWatchlistRows("status", sorted, sections);
    expect(
      rows.map((r) => (r.kind === "header" ? `${r.title}:${r.count}` : r.product.id)),
    ).toEqual(["In Stock:1", "a", "Back Order:1", "b"]);
  });
});
