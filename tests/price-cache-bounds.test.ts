import { describe, expect, it, beforeEach } from "vitest";
import {
  getAllFetchedAt,
  listNearExpiry,
  setCachedPrice,
  clearPriceCacheForTests,
} from "../server/price-cache";

describe("price cache bounds (memory backend)", () => {
  beforeEach(() => clearPriceCacheForTests());

  it("caps listNearExpiry results per tick", async () => {
    for (let i = 0; i < 10; i++) {
      await setCachedPrice("d", `m${i}`, {
        price: 10 + i,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        fetchedAt: 1000,
      });
    }
    const entries = await listNearExpiry(100_000, 90_000, 3);
    expect(entries).toHaveLength(3);
  });

  it("caps getAllFetchedAt rows", async () => {
    for (let i = 0; i < 10; i++) {
      await setCachedPrice("d", `m${i}`, {
        price: 10 + i,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        fetchedAt: 1000 + i,
      });
    }
    const rows = await getAllFetchedAt(4);
    expect(rows).toHaveLength(4);
  });
});
