import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { Product, SyncItem } from "../lib/types";

// The session changed lib/sync.ts several times (byte caps, generation gate,
// full-resync drop condition, tag LWW, pulled-item sanitizer). Each was tested
// in isolation; this exercises them together in one run to catch interactions.
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

function product(id: string, overrides: Partial<Product> = {}): Product {
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
    ...overrides,
  };
}

describe("sync fixes interaction", () => {
  it("handles a full resync, a malformed item, a tag removal, and a large push together", async () => {
    const storage = makeStorage();
    // A stale, previously-synced item (droppable) and a never-pushed local item
    // (must survive) — the Phase-599 drop condition.
    await storage.addToWatchlist(product("stale"));
    await storage.setItemSyncMeta("watchlist", "stale", 1000);
    await storage.addToWatchlist(product("never-pushed"));
    // A never-pushed item's stamp is always AFTER the last successful sync (a
    // successful sync would have pushed it), which is what the drop condition
    // keys on. A stamp equal to the cursor is indistinguishable from "synced".
    await storage.setItemSyncMeta("watchlist", "never-pushed", 2000);
    await storage.saveSyncMeta({ lastSyncedAt: 1000, items: {} });

    // A local tag removal with a newer stamp (Phase-602 tag LWW).
    await storage.addToWatchlist(
      product("tagged", {
        tags: ["a"],
        tagsUpdatedAt: "2026-08-03T00:00:00.000Z",
      }),
    );

    // A large dirty set to force byte-aware batching (Phase-598): ~80 KB per
    // product (25 listings with long URLs) × 70 is well over the 5 MB cap.
    for (let i = 0; i < 70; i++) {
      await storage.addToWatchlist(
        product(`bulk-${i}`, {
          listings: Array.from({ length: 25 }, (_, j) => ({
            distributorId: `d${j}`,
            productId: `bulk-${i}`,
            price: 100 + j,
            currency: "USD",
            stockStatus: "in_stock" as const,
            url: `https://example.com/${"x".repeat(900)}/${j}`,
            lastChecked: "2026-08-01T00:00:00.000Z",
            // History dominates the size (the storage layer caps it at 500
            // points per product), which is what pushes the total over 5 MB.
            priceHistory: Array.from({ length: 30 }, (_, d) => ({
              date: new Date(Date.now() - d * 86_400_000).toISOString(),
              price: 100 + d,
              currency: "USD",
              stockStatus: "in_stock" as const,
            })),
          })),
        }),
      );
    }

    const pull = vi.fn(
      async (): Promise<{
        lastSyncedAt: number;
        items: SyncItem[];
        fullResyncSince?: number | null;
      }> => ({
        lastSyncedAt: 5000,
        fullResyncSince: 4000,
        items: [
          // Malformed: must be dropped (Phase-666), not written.
          {
            collection: "watchlist",
            id: "bad",
            data: { id: "bad", name: 123, listings: "nope" },
            updatedAt: 4500,
            deletedAt: null,
          },
          // A newer remote tag removal: must win over the local tags (Phase-602).
          {
            collection: "watchlist",
            id: "tagged",
            data: {
              ...product("tagged"),
              tags: [],
              tagsUpdatedAt: "2026-08-05T00:00:00.000Z",
            },
            updatedAt: 4500,
            deletedAt: null,
          },
        ],
      }),
    );
    const push = vi.fn(async (_items: SyncItem[]) => ({
      accepted: 0,
      stamped: [],
    }));

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });

    const list = await storage.getWatchlist();
    const ids = list.map((p) => p.id);
    // The malformed item never entered the store.
    expect(ids).not.toContain("bad");
    // The stale synced item was dropped; the never-pushed one survived.
    expect(ids).not.toContain("stale");
    expect(ids).toContain("never-pushed");
    // The newer remote tag removal won.
    expect(list.find((p) => p.id === "tagged")!.tags).toEqual([]);
    // The large dirty set was pushed in byte-bounded batches.
    const batches = push.mock.calls.map((c) => (c as unknown[])[0] as SyncItem[]);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      const bytes = batch.reduce(
        (n, it) => n + JSON.stringify(it.data ?? null).length,
        0,
      );
      expect(bytes).toBeLessThanOrEqual(5_000_000);
    }
  });
});
