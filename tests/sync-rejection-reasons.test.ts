import { describe, expect, it, vi, beforeEach } from "vitest";
import { createStorage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { Collection, Product, SyncItem, SyncRejectedItem, SyncRejectionReason, SyncStampedItem } from "../lib/types";

function adapter() {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => m.delete(k));
    },
  };
}

function product(id: string): Product {
  return {
    id,
    name: id,
    modelNumber: id,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-08-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
  };
}

describe("syncNow rejection reasons", () => {
  it("clears stale tombstone on stale-write rejection and keeps live item dirty", async () => {
    const storage = createStorage(adapter());
    await storage.saveSyncMeta({
      lastSyncedAt: 1000,
      lastSyncOkAt: 1000,
      lastSyncError: null,
      items: {},
    });
    // live item + deleted tombstone newer than cursor
    await storage.addToWatchlist(product("p-live"));
    await storage.setItemSyncMeta("watchlist", "p-live", 1500);
    await storage.markItemDeleted("watchlist", "p-stale", 1500);

    const pull = vi.fn(async () => ({ lastSyncedAt: 2000, items: [] }));
    // Server: p-live validation error (retry), p-stale stale LWW (clear tombstone)
    let seen: SyncItem[] = [];
    const push = vi.fn(
      async (
        items: SyncItem[],
      ): Promise<{
        accepted: number;
        stamped: SyncStampedItem[];
        rejected: Array<{ collection: Collection; id: string; reason: SyncRejectionReason }>;
      }> => {
        seen = items;
        return {
          accepted: 0,
          stamped: [],
          rejected: [
            { collection: "watchlist", id: "p-live", reason: "validation_error" },
            { collection: "watchlist", id: "p-stale", reason: "stale_write" },
          ],
        };
      },
    );

    await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 3000 });

    expect(seen.map((i) => i.id).sort()).toEqual(["p-live", "p-stale"]);
    const meta = await storage.getSyncMeta();
    // stale tombstone cleared (pull convergence will recreate if needed)
    expect(meta.items.watchlist?.["p-stale"]).toBeUndefined();
    // live item stays dirty for retry
    expect(meta.items.watchlist?.["p-live"]).toBeDefined();
    expect(meta.lastSyncError).toMatch(/validation error/i);
  });
});
