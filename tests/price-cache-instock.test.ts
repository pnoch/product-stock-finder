import { describe, expect, it, beforeEach } from "vitest";
import {
  setCachedPrice,
  listCachedInStock,
  clearPriceCacheForTests,
} from "../server/price-cache";
import { PRODUCT_CATALOG } from "../shared/src/catalog.js";
import type { PriceSnapshot } from "../lib/types";

const CATALOG_MODEL = "CRS804-4DDQ-hRM";

function snapshot(overrides: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    price: 99.5,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p",
    fetchedAt: 1000,
    ...overrides,
  };
}

describe("listCachedInStock (memory backend)", () => {
  beforeEach(() => clearPriceCacheForTests());

  it("is bounded to catalog models", () => {
    expect(PRODUCT_CATALOG.some((p) => p.modelNumber === CATALOG_MODEL)).toBe(true);
  });

  it("returns an in-stock, fresh, catalog-model row", async () => {
    const now = 10_000;
    await setCachedPrice("server2u-my", CATALOG_MODEL, snapshot({ price: 42, fetchedAt: 9_000 }));
    const rows = await listCachedInStock(now, 5_000);
    expect(rows).toContainEqual(
      expect.objectContaining({ distributorId: "server2u-my", modelNumber: CATALOG_MODEL, price: 42 }),
    );
  });

  it("excludes an out_of_stock row", async () => {
    const now = 10_000;
    await setCachedPrice(
      "server2u-my",
      CATALOG_MODEL,
      snapshot({ price: 42, fetchedAt: 9_000, stockStatus: "out_of_stock" }),
    );
    expect(await listCachedInStock(now, 5_000)).toEqual([]);
  });

  it("excludes a stale row", async () => {
    const now = 10_000;
    await setCachedPrice("server2u-my", CATALOG_MODEL, snapshot({ price: 42, fetchedAt: 4_000 }));
    expect(await listCachedInStock(now, 5_000)).toEqual([]);
  });

  it("excludes a non-catalog model", async () => {
    const now = 10_000;
    await setCachedPrice("server2u-my", "NOT-IN-CATALOG-999", snapshot({ price: 42, fetchedAt: 9_000 }));
    expect(await listCachedInStock(now, 5_000)).toEqual([]);
  });
});
