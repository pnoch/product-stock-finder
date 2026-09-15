import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { Product, SyncItem } from "../lib/types";
import { SYNC_PUSH_MAX_ITEMS } from "../shared/const";

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

function makeProduct(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-08-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
  };
}

describe("sync push batching", () => {
  it("splits a large dirty set into batches within the server cap", async () => {
    const storage = makeStorage();
    const total = SYNC_PUSH_MAX_ITEMS * 2 + 5;
    for (let i = 0; i < total; i++) {
      await storage.addToWatchlist(makeProduct(`p${i}`));
    }

    const batches: number[] = [];
    const push = vi.fn(async (items: SyncItem[]) => {
      batches.push(items.length);
      return {
        accepted: items.length,
        stamped: items.map((i) => ({
          collection: i.collection,
          id: i.id,
          updatedAt: i.updatedAt,
        })),
      };
    });

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull: vi.fn(async () => ({ lastSyncedAt: 0, items: [] })),
      push,
      now: () => 1000,
    });

    expect(batches.length).toBeGreaterThan(1);
    for (const size of batches) {
      expect(size).toBeLessThanOrEqual(SYNC_PUSH_MAX_ITEMS);
    }
    expect(batches.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("keeps local changes dirty when a batch fails", async () => {
    const storage = makeStorage();
    for (let i = 0; i < 3; i++) {
      await storage.addToWatchlist(makeProduct(`p${i}`));
    }
    const push = vi.fn(async () => {
      throw new Error("network down");
    });
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull: vi.fn(async () => ({ lastSyncedAt: 0, items: [] })),
      push,
      now: () => 1000,
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect((await storage.getWatchlist()).length).toBe(3);
  });
});
