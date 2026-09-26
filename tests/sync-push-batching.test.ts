import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import {
  SYNC_PUSH_ITEM_MAX_BYTES,
  SYNC_PUSH_MAX_BYTES,
  SYNC_PUSH_MAX_ITEMS,
} from "../shared/const";
import type { DistributorListing, Product, StockStatus, SyncItem } from "../lib/types";

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return createStorage({
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Dates must sit inside serializeItem's 30-day window, which it computes from
// the real clock, so anchor them to Date.now().
function history(): DistributorListing["priceHistory"] {
  return Array.from({ length: 30 }, (_, d) => ({
    date: new Date(Date.now() - d * DAY_MS).toISOString(),
    price: 1234.5678 + d,
    currency: "USD",
    stockStatus: "in_stock" as StockStatus,
  }));
}

function listing(i: number, urlLength: number): DistributorListing {
  return {
    distributorId: `dist-${i % 25}`,
    productId: "p",
    price: 1234.5678,
    currency: "USD",
    stockStatus: "in_stock",
    url: `https://example.com/${"x".repeat(urlLength)}/${i}`,
    lastChecked: new Date().toISOString(),
    priceHistory: history(),
  };
}

function product(id: string, listings: number, urlLength: number): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings: Array.from({ length: listings }, (_, i) => listing(i, urlLength)),
  };
}

const bytesOf = (data: unknown) => JSON.stringify(data ?? null).length;

function pushedBatches(push: { mock: { calls: unknown[][] } }): SyncItem[][] {
  return push.mock.calls.map((call) => call[0] as SyncItem[]);
}

describe("sync push batching respects the server byte caps", () => {
  it("splits a large dirty set so no batch exceeds the total byte cap", async () => {
    const storage = makeStorage();
    // ~80 KB per product (25 listings x 30 points) x 70 => well over 5 MB.
    for (let i = 0; i < 70; i++) {
      await storage.addToWatchlist(product(`bulk-${i}`, 25, 900));
    }
    const pull = vi.fn(async () => ({
      lastSyncedAt: 5000,
      items: [] as SyncItem[],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => Date.now(),
    });

    const batches = pushedBatches(push);
    expect(batches.length).toBeGreaterThan(1);
    const totalItems = batches.reduce((n, b) => n + b.length, 0);
    expect(totalItems).toBe(70);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(SYNC_PUSH_MAX_ITEMS);
      const totalBytes = batch.reduce((n, it) => n + bytesOf(it.data), 0);
      expect(totalBytes).toBeLessThanOrEqual(SYNC_PUSH_MAX_BYTES);
    }
  });

  it("trims an over-cap item's pushed history but keeps it locally", async () => {
    const storage = makeStorage();
    // 40 listings x 30 points pushes the serialized item over 100 KB.
    await storage.addToWatchlist(product("heavy", 40, 2000));
    const pull = vi.fn(async () => ({
      lastSyncedAt: 5000,
      items: [] as SyncItem[],
    }));
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => Date.now(),
    });

    const pushed = pushedBatches(push).flat();
    expect(pushed).toHaveLength(1);
    const data = pushed[0].data as Product;
    expect(bytesOf(data)).toBeLessThan(SYNC_PUSH_ITEM_MAX_BYTES);
    // The pushed copy is trimmed...
    const pushedPoints = data.listings.flatMap((l) => l.priceHistory).length;
    // ...but the local copy still has everything storage kept (capped at 500
    // points per product, but strictly more than the trimmed pushed copy).
    const local = await storage.getWatchlist();
    const localPoints = local[0].listings.flatMap((l) => l.priceHistory).length;
    expect(localPoints).toBeGreaterThan(pushedPoints);
  });
});
