import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sortWatchlist } from "../lib/watchlist-org";
import type { DistributorListing, Product } from "../lib/types";

const ROOT = path.join(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const D = [
  "2025-10-01T00:00:00.000Z",
  "2025-10-16T00:00:00.000Z",
  "2025-10-31T00:00:00.000Z",
  "2025-11-15T00:00:00.000Z",
  "2025-11-30T00:00:00.000Z",
];

function listing(
  productId: string,
  prices: { date: string; price: number }[],
): DistributorListing {
  return {
    distributorId: "d1",
    productId,
    price: prices[prices.length - 1].price,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/x",
    lastChecked: prices[prices.length - 1].date,
    priceHistory: prices.map((p) => ({
      date: p.date,
      price: p.price,
      currency: "USD",
      stockStatus: "in_stock" as const,
    })),
  };
}

function product(id: string, values: number[] | null): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: `M-${id}`,
    brand: "Brand",
    category: "Cat",
    description: "",
    addedAt: D[0],
    isWatched: true,
    listings:
      values === null
        ? []
        : [
            listing(
              id,
              values.map((price, i) => ({ date: D[i], price })),
            ),
          ],
  };
}

describe("deal score surfaces", () => {
  it("sortWatchlist handles 'deal' (score desc, nulls last)", () => {
    const hot = product("hot", [200, 180, 160, 140, 100]);
    const cold = product("cold", [100, 120, 140, 160, 200]);
    const none = product("none", null);
    const sorted = sortWatchlist([none, cold, hot], "deal", "USD").map(
      (p) => p.id,
    );
    expect(sorted[0]).toBe("hot");
    expect(sorted[sorted.length - 1]).toBe("none");
  });

  it("mobile watchlist sort options include Best deals", () => {
    expect(read("lib/watchlist-org.ts")).toContain("Best deals");
    expect(read("app/(tabs)/watchlist.tsx")).toContain("dealScore");
  });

  it("mobile product card shows Hot deal badge", () => {
    expect(read("components/watchlist/product-card.tsx")).toContain("Hot deal");
  });

  it("mobile product detail shows Deal Score card", () => {
    expect(read("app/product/[id].tsx")).toContain("Deal Score");
  });

  it("desktop Watchlist has deal sortKey + Hot deal", () => {
    const src = read("desktop/src/pages/Watchlist.tsx");
    expect(src).toContain('"deal"');
    expect(src).toContain("Hot deal");
  });

  it("desktop ProductDetail has Deal Score", () => {
    expect(read("desktop/src/pages/ProductDetail.tsx")).toContain("Deal Score");
  });
});
