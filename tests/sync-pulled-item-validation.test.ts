import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { SyncItem } from "../lib/types";

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

async function pullItems(storage: Storage, items: SyncItem[]) {
  const pull = vi.fn(async () => ({ lastSyncedAt: 5000, items }));
  const push = vi.fn(async () => ({ accepted: 0, stamped: [] }));
  await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 6000 });
}

describe("pulled item shape validation", () => {
  it("drops a malformed watchlist item instead of writing it to the store", async () => {
    // The server accepts `data` as arbitrary JSON, so a buggy/malicious client
    // can push a malformed product that would render on every device.
    const storage = makeStorage();
    await pullItems(storage, [
      {
        collection: "watchlist",
        id: "bad",
        data: { id: "bad", name: 123, listings: "not-an-array" },
        updatedAt: 4000,
        deletedAt: null,
      },
      {
        collection: "watchlist",
        id: "good",
        data: { id: "good", name: "Good", listings: [] },
        updatedAt: 4000,
        deletedAt: null,
      },
    ]);
    const list = await storage.getWatchlist();
    expect(list.map((p) => p.id)).toEqual(["good"]);
  });

  it("drops an alert without a finite target price", async () => {
    const storage = makeStorage();
    await pullItems(storage, [
      {
        collection: "alerts",
        id: "a1",
        data: { id: "a1", targetPrice: "not-a-number" },
        updatedAt: 4000,
        deletedAt: null,
      },
    ]);
    expect(await storage.getAlerts()).toEqual([]);
  });

  it("keeps a valid settings row (keyed by collection, not an item id)", async () => {
    const storage = makeStorage();
    await pullItems(storage, [
      {
        collection: "settings",
        id: "settings",
        data: { theme: "dark", displayCurrency: "GBP" },
        updatedAt: 4000,
        deletedAt: null,
      },
    ]);
    expect((await storage.getSettings()).displayCurrency).toBe("GBP");
  });
});
