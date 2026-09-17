import { describe, expect, it, vi } from "vitest";
import { createStorage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { Product, SyncItem } from "../lib/types";

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

function product(id: string, tags?: string[]): Product {
  return {
    id,
    name: id,
    modelNumber: id,
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
    ...(tags ? { tags } : {}),
  };
}

describe("sync multi-batch push persists successful stamps", () => {
  it("keeps the stamps from batches that succeeded before a later failure", async () => {
    const storage = createStorage(adapter());
    const total = 250; // 2 batches at SYNC_PUSH_MAX_ITEMS = 200
    for (let i = 0; i < total; i++) {
      await storage.addToWatchlist(product(`p${i}`));
    }

    let call = 0;
    const push = vi.fn(async (items: SyncItem[]) => {
      call += 1;
      if (call === 2) throw new Error("network down");
      return {
        accepted: items.length,
        stamped: items.map((i) => ({
          collection: i.collection,
          id: i.id,
          updatedAt: 9_999_999_999_999,
        })),
      };
    });

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull: vi.fn(async () => ({ lastSyncedAt: 1000, items: [] })),
      push,
      now: () => 1000,
    });

    // The first batch's stamps must be persisted so those items are not
    // re-pushed forever.
    const meta = await storage.getSyncMeta();
    const stampedCount = Object.keys(meta.items.watchlist ?? {}).filter(
      (id) => meta.items.watchlist![id]!.updatedAt === 9_999_999_999_999,
    ).length;
    expect(stampedCount).toBe(200);
  });
});

describe("sync pull drain does not skip pending pages", () => {
  it("keeps the old cursor when the drain guard is hit", async () => {
    const storage = createStorage(adapter());
    await storage.saveSyncMeta({
      lastSyncedAt: 500,
      lastSyncOkAt: 500,
      lastSyncError: null,
      items: {},
    });

    // Always report more pages, so the 50-page guard trips.
    const pull = vi.fn(async () => ({
      lastSyncedAt: 999_999,
      items: [
        {
          collection: "watchlist" as const,
          id: "x",
          data: product("x"),
          updatedAt: 1,
          deletedAt: null,
        },
      ],
      hasMore: true,
      nextCursor: { stamp: 1, collection: "watchlist", id: "x" },
    }));

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push: vi.fn(async () => ({ accepted: 0, stamped: [] })),
      now: () => 1000,
    });

    // Cursor must NOT jump to lastSyncedAt while pages remain.
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt).toBeLessThan(999_999);
  });
});

describe("applyLocalItem unions tags", () => {
  it("keeps a locally added tag when the incoming copy lacks it", async () => {
    const storage = createStorage(adapter());
    await storage.addToWatchlist(product("p1", ["local-tag"]));
    await storage.saveSyncMeta({
      lastSyncedAt: 1000,
      lastSyncOkAt: 1000,
      lastSyncError: null,
      items: {},
    });

    const pull = vi.fn(async () => ({
      lastSyncedAt: 2000,
      items: [
        {
          collection: "watchlist" as const,
          id: "p1",
          data: product("p1"), // no tags
          updatedAt: 1500,
          deletedAt: null,
        },
      ],
    }));

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push: vi.fn(async () => ({ accepted: 0, stamped: [] })),
      now: () => 2000,
    });

    const list = await storage.getWatchlist();
    expect(list[0]!.tags).toContain("local-tag");
  });
});
