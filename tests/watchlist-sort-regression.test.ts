import { describe, it, expect } from "vitest";
import { sortWatchlist } from "../lib/watchlist-org";
import type { Product } from "../lib/types";

function makeProduct(
  id: string,
  price: number,
  addedAt: string,
): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: `M-${id}`,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt,
    isWatched: true,
    listings: [
      {
        distributorId: "d1",
        productId: id,
        price,
        currency: "USD",
        stockStatus: "in_stock",
        url: "x",
        lastChecked: "2026-01-01",
        priceHistory: [],
      },
    ],
  } as Product;
}

describe("watchlist sort secondary tie-breaker", () => {
  it("breaks price ties by date", () => {
    const older = makeProduct("a", 100, "2025-01-01T00:00:00.000Z");
    const newer = makeProduct("b", 100, "2026-01-01T00:00:00.000Z");
    // Same price — newer should come first (recent tie-breaker)
    const sorted = sortWatchlist([older, newer], "best_price");
    expect(sorted.map((p) => p.id)).toEqual(["b", "a"]);

    // Reverse input order should give same result
    const sorted2 = sortWatchlist([newer, older], "best_price");
    expect(sorted2.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("still sorts by price when prices differ", () => {
    const cheap = makeProduct("c", 50, "2025-01-01T00:00:00.000Z");
    const pricey = makeProduct("d", 200, "2026-01-01T00:00:00.000Z");
    expect(sortWatchlist([pricey, cheap], "best_price").map((p) => p.id)).toEqual([
      "c",
      "d",
    ]);
  });
});
