import { describe, expect, it, beforeEach } from "vitest";
import {
  getCachedPrice,
  setCachedPrice,
  listNearExpiry,
  getAllFetchedAt,
  clearPriceCacheForTests,
} from "../server/price-cache";
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

describe("price cache (memory backend)", () => {
  beforeEach(() => clearPriceCacheForTests());

  it("returns null for a missing key", async () => {
    expect(await getCachedPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("stores and retrieves a snapshot", async () => {
    const snap = snapshot({ price: 123.45, fetchedAt: 5000 });
    await setCachedPrice("server2u-my", "CRS804", snap);
    const got = await getCachedPrice("server2u-my", "CRS804");
    expect(got).toEqual(snap);
  });

  it("keeps keys distinct by distributor and model", async () => {
    await setCachedPrice("server2u-my", "CRS804", snapshot({ price: 1 }));
    await setCachedPrice("linitx-uk", "CRS804", snapshot({ price: 2 }));
    await setCachedPrice("server2u-my", "CRS326", snapshot({ price: 3 }));
    expect((await getCachedPrice("server2u-my", "CRS804"))?.price).toBe(1);
    expect((await getCachedPrice("linitx-uk", "CRS804"))?.price).toBe(2);
    expect((await getCachedPrice("server2u-my", "CRS326"))?.price).toBe(3);
  });

  it("overwrites an existing entry on set", async () => {
    await setCachedPrice("server2u-my", "CRS804", snapshot({ price: 1 }));
    await setCachedPrice("server2u-my", "CRS804", snapshot({ price: 2 }));
    expect((await getCachedPrice("server2u-my", "CRS804"))?.price).toBe(2);
  });

  it("rejects implausible snapshots instead of caching them", async () => {
    await expect(
      setCachedPrice("server2u-my", "CRS804", snapshot({ price: NaN })),
    ).rejects.toThrow(/implausible/);
    await expect(
      setCachedPrice("server2u-my", "CRS804", snapshot({ price: -5 })),
    ).rejects.toThrow(/implausible/);
    await expect(
      setCachedPrice("server2u-my", "CRS804", snapshot({ price: 5e9 })),
    ).rejects.toThrow(/implausible/);
    expect(await getCachedPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("listNearExpiry returns only entries older than the cutoff", async () => {
    const now = 10_000;
    await setCachedPrice("a", "m1", snapshot({ fetchedAt: now - 1000 }));
    await setCachedPrice("a", "m2", snapshot({ fetchedAt: now - 5000 }));
    await setCachedPrice("b", "m1", snapshot({ fetchedAt: now - 100 }));
    const entries = await listNearExpiry(now, 2000);
    expect(entries).toContainEqual({ distributorId: "a", modelNumber: "m2" });
    expect(entries).not.toContainEqual({
      distributorId: "a",
      modelNumber: "m1",
    });
    expect(entries).not.toContainEqual({
      distributorId: "b",
      modelNumber: "m1",
    });
  });
});

describe("getAllFetchedAt", () => {
  beforeEach(() => clearPriceCacheForTests());

  it("returns an empty array when nothing is cached", async () => {
    expect(await getAllFetchedAt()).toEqual([]);
  });

  it("returns all cached entries with their fetchedAt", async () => {
    await setCachedPrice(
      "server2u-my",
      "CRS804",
      snapshot({ price: 1, fetchedAt: 1000 }),
    );
    await setCachedPrice(
      "linitx-uk",
      "CRS804",
      snapshot({ price: 2, fetchedAt: 2000 }),
    );
    await setCachedPrice(
      "server2u-my",
      "CRS326",
      snapshot({ price: 3, fetchedAt: 3000 }),
    );
    const entries = await getAllFetchedAt();
    expect(entries).toHaveLength(3);
    expect(entries).toContainEqual({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
      fetchedAt: 1000,
    });
    expect(entries).toContainEqual({
      distributorId: "linitx-uk",
      modelNumber: "CRS804",
      fetchedAt: 2000,
    });
    expect(entries).toContainEqual({
      distributorId: "server2u-my",
      modelNumber: "CRS326",
      fetchedAt: 3000,
    });
  });
});
