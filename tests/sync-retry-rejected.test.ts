import { describe, expect, it, vi } from "vitest";
import { createStorage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type {
  Collection,
  Product,
  SyncItem,
  SyncRejectedItem,
  SyncStampedItem,
} from "../lib/types";

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

describe("rejected push items are retried on the next sync", () => {
  it("re-collects a validation-rejected item after the cursor advances past it", async () => {
    const storage = createStorage(adapter());
    await storage.saveSyncMeta({
      lastSyncedAt: 1000,
      lastSyncOkAt: 1000,
      lastSyncError: null,
      items: {},
    });
    await storage.addToWatchlist(product("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1500);

    const pull = vi.fn(async () => ({ lastSyncedAt: 5000, items: [] }));
    const pushes: string[][] = [];
    let rejectFirst = true;
    const push = vi.fn(
      async (
        items: SyncItem[],
      ): Promise<{
        accepted: number;
        stamped: SyncStampedItem[];
        rejected: SyncRejectedItem[];
      }> => {
        pushes.push(items.map((i) => i.id));
        if (rejectFirst) {
          rejectFirst = false;
          return {
            accepted: 0,
            stamped: [],
            rejected: [
              { collection: "watchlist", id: "p1", reason: "validation_error" },
            ],
          };
        }
        return {
          accepted: items.length,
          stamped: items.map((i) => ({
            collection: i.collection,
            id: i.id,
            updatedAt: i.updatedAt,
          })),
          rejected: [],
        };
      },
    );

    await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 6000 });
    // First sync rejected it; the cursor advanced past its stamp.
    expect(pushes[0]).toEqual(["p1"]);
    const metaAfterFirst = await storage.getSyncMeta();
    expect(metaAfterFirst.retryKeys).toContain("watchlist:p1");

    // Second sync must re-collect it despite entry.updatedAt <= cursor.
    await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 7000 });
    expect(pushes[1]).toEqual(["p1"]);
    const metaAfterSecond = await storage.getSyncMeta();
    expect(metaAfterSecond.retryKeys ?? []).not.toContain("watchlist:p1");
  });

  it("does not retry within the same sync pass", async () => {
    const storage = createStorage(adapter());
    await storage.saveSyncMeta({
      lastSyncedAt: 1000,
      lastSyncOkAt: 1000,
      lastSyncError: null,
      items: {},
    });
    await storage.addToWatchlist(product("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1500);

    const pull = vi.fn(async () => ({ lastSyncedAt: 5000, items: [] }));
    const push = vi.fn(async () => ({
      accepted: 0,
      stamped: [],
      rejected: [
        { collection: "watchlist", id: "p1", reason: "validation_error" },
      ],
    })) as unknown as (items: SyncItem[]) => Promise<{
      accepted: number;
      stamped: SyncStampedItem[];
      rejected: SyncRejectedItem[];
    }>;
    await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 6000 });
    expect(push).toHaveBeenCalledTimes(1);
  });
});
