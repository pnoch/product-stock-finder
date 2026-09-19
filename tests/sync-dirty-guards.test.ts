import { describe, expect, it, vi } from "vitest";
import { createStorage } from "../lib/storage";
import { setupSync } from "../lib/sync";
import type { Product, SyncItem, SyncStampedItem } from "../lib/types";

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
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
  };
}

const noopPush = async (items: SyncItem[]) => ({
  accepted: items.length,
  stamped: [] as SyncStampedItem[],
});

describe("markDirty does not tombstone an unknown id", () => {
  it("ignores a change for an item that was never synced", async () => {
    const storage = createStorage(adapter());
    await storage.saveSyncMeta({
      lastSyncedAt: 1000,
      lastSyncOkAt: 1000,
      lastSyncError: null,
      items: {},
    });

    const setup = setupSync({
      storage,
      isSignedIn: () => true,
      pull: vi.fn(async () => ({ lastSyncedAt: 2000, items: [] })),
      push: vi.fn(noopPush),
      now: () => 2000,
      debounceMs: 0,
    });

    // A stale UI reports a mutation for an id that is not present locally and
    // was never synced (e.g. removed on another device). This must NOT create a
    // tombstone that would delete the item on the other device.
    await storage.updateProductDetails("ghost", { name: "stale edit" });
    await new Promise((r) => setTimeout(r, 20));

    const meta = await storage.getSyncMeta();
    expect(meta.items.watchlist?.["ghost"]).toBeUndefined();
    storage.setOnChange(null);
  });

  it("still tombstones an item that was previously synced", async () => {
    const storage = createStorage(adapter());
    await storage.addToWatchlist(product("p1"));
    await storage.setItemSyncMeta("watchlist", "p1", 1500);
    await storage.saveSyncMeta({
      lastSyncedAt: 1000,
      lastSyncOkAt: 1000,
      lastSyncError: null,
      items: { watchlist: { p1: { updatedAt: 1500, deleted: false } } },
    });

    const setup = setupSync({
      storage,
      isSignedIn: () => true,
      pull: vi.fn(async () => ({ lastSyncedAt: 2000, items: [] })),
      push: vi.fn(noopPush),
      now: () => 2000,
      debounceMs: 0,
    });

    // Remove it locally, then report the change: the tombstone must be created.
    await storage.removeFromWatchlist("p1");
    await storage.markItemDeleted("watchlist", "p1", 2500);
    await new Promise((r) => setTimeout(r, 20));

    const meta = await storage.getSyncMeta();
    expect(meta.items.watchlist?.["p1"]?.deleted).toBe(true);
    storage.setOnChange(null);
  });
});

describe("changes made during a sync are replayed", () => {
  it("re-marks a local edit made while suppression was active", async () => {
    const storage = createStorage(adapter());
    await storage.addToWatchlist(product("p1"));
    const changed: string[] = [];
    storage.setOnChange((collection, id) => changed.push(`${collection}:${id}`));

    storage.setChangeSuppressed(true);
    await storage.updateProductDetails("p1", { name: "Edited during sync" });
    storage.setChangeSuppressed(false);

    expect(changed).toContain("watchlist:p1");
  });

  it("does not replay keys the sync itself applied", async () => {
    const storage = createStorage(adapter());
    await storage.addToWatchlist(product("p1"));
    const changed: string[] = [];
    storage.setOnChange((collection, id) => changed.push(`${collection}:${id}`));

    storage.setChangeSuppressed(true);
    await storage.updateProductDetails("p1", { name: "from server" });
    storage.setChangeSuppressed(false, new Set(["watchlist:p1"]));

    expect(changed).not.toContain("watchlist:p1");
  });
});
