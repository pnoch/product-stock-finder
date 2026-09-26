import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
  affectedRowsOf: vi.fn(() => 0),
}));

import {
  getCachedPrice,
  setCachedPrice,
  getAllFetchedAt,
  listNearExpiry,
  clearPriceCacheForTests,
} from "../server/price-cache";
import {
  getHistory,
  mergeHistory,
  clearHistoryForTests,
} from "../server/price-history";
import { storagePrice, storeKey } from "../server/store-keys";
import type { PriceSnapshot } from "../lib/types";

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

describe("store parity with the DB", () => {
  beforeEach(() => {
    clearPriceCacheForTests();
    clearHistoryForTests();
  });

  it("folds case so a differently-cased lookup finds the cached row", async () => {
    await setCachedPrice("MikroTik", "CRS804", snapshot({ price: 88.5 }));
    const found = await getCachedPrice("mikrotik", "crs804");
    expect(found?.price).toBe(88.5);
  });

  it("folds case so a differently-cased write overwrites (like the DB primary key)", async () => {
    await setCachedPrice("MikroTik", "CRS804", snapshot({ price: 88.5 }));
    await setCachedPrice("mikrotik", "crs804", snapshot({ price: 91.25 }));
    expect((await getCachedPrice("MikroTik", "CRS804"))?.price).toBe(91.25);
  });

  it("rounds the cached price to DECIMAL(12,4) scale", async () => {
    await setCachedPrice("mikrotik", "CRS804", snapshot({ price: 88.123456 }));
    expect((await getCachedPrice("mikrotik", "CRS804"))?.price).toBe(88.1235);
  });

  it("folds case for price history", async () => {
    await mergeHistory("MikroTik", "CRS804", [
      {
        date: "2026-08-10T09:00:00.000Z",
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ]);
    const history = await getHistory("mikrotik", "crs804");
    expect(history).toHaveLength(1);
    expect(history[0].price).toBe(100);
  });

  it("rounds price-history points to DECIMAL(12,4) scale", async () => {
    await mergeHistory("mikrotik", "CRS804", [
      {
        date: "2026-08-10T09:00:00.000Z",
        price: 100.123456,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ]);
    const history = await getHistory("mikrotik", "CRS804");
    expect(history[0].price).toBe(100.1235);
  });

  it("keeps the original case in getAllFetchedAt so the warmer still matches the catalog", async () => {
    await setCachedPrice("MikroTik", "CRS804", snapshot({ fetchedAt: 1000 }));
    expect(await getAllFetchedAt()).toEqual([
      { distributorId: "MikroTik", modelNumber: "CRS804", fetchedAt: 1000 },
    ]);
  });

  it("keeps the original case in listNearExpiry", async () => {
    await setCachedPrice("MikroTik", "CRS804", snapshot({ fetchedAt: 1000 }));
    expect(await listNearExpiry(10_000, 1_000)).toEqual([
      { distributorId: "MikroTik", modelNumber: "CRS804" },
    ]);
  });

  it("exposes the helpers the stores key on", () => {
    expect(storeKey("A", "B")).toBe("a:b");
    expect(storagePrice(1.00005)).toBe(1.0001);
  });
});
