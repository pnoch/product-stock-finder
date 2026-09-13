import { describe, expect, it, vi } from "vitest";
import { createStorage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { Product, SyncItem, SyncStampedItem } from "../lib/types";

function makeAdapter() {
  const store = new Map<string, string>();
  return {
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
  };
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

describe("syncNow concurrency", () => {
  it("pushes edits that arrive during an in-flight sync via a follow-up pass", async () => {
    const storage = createStorage(makeAdapter());
    await storage.addToWatchlist(makeProduct("p1"));
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    let calls = 0;
    const push = vi.fn(
      async (
        items: SyncItem[],
      ): Promise<{ accepted: number; stamped: SyncStampedItem[] }> => {
        calls += 1;
        if (calls === 1) {
          // Concurrent edit lands while the first push is in flight.
          await storage.addToWatchlist(makeProduct("p2"));
          await storage.setItemSyncMeta("watchlist", "p2", 5000);
          return {
            accepted: 1,
            stamped: [{ collection: "watchlist", id: "p1", updatedAt: 2500 }],
          };
        }
        return {
          accepted: items.length,
          stamped: items.map((i) => ({
            collection: i.collection,
            id: i.id,
            updatedAt: 6000,
          })),
        };
      },
    );
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    expect(push).toHaveBeenCalledTimes(2);
    const second = push.mock.calls[1]![0];
    expect(second.map((i) => i.id)).toEqual(["p2"]);
    const meta = await storage.getSyncMeta();
    expect(meta.items.watchlist?.p2?.updatedAt).toBe(6000);
  });

  it("records an error and preserves tombstones when the push rejects items", async () => {
    const storage = createStorage(makeAdapter());
    await storage.saveSyncMeta({
      lastSyncedAt: 1500,
      lastSyncOkAt: 1500,
      lastSyncError: null,
      items: {},
    });
    await storage.addToWatchlist(makeProduct("p1"));
    await storage.removeFromWatchlist("p1");
    await storage.markItemDeleted("watchlist", "p1", 1000);
    await storage.addToWatchlist(makeProduct("p2"));
    await storage.setItemSyncMeta("watchlist", "p2", 1600);
    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));
    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 3000,
    });
    const meta = await storage.getSyncMeta();
    expect(meta.items.watchlist?.p1).toBeDefined();
    expect(meta.lastSyncError).toMatch(/reject/i);
  });
});
