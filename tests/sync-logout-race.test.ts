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

const remoteProduct = {
  id: "remote-1",
  name: "Remote",
  modelNumber: "remote-1",
  brand: "B",
  category: "Switch",
  description: "",
  addedAt: "2026-08-01T00:00:00.000Z",
  isWatched: true,
  listings: [],
};

describe("sync vs a concurrent logout wipe", () => {
  it("does not re-apply pulled rows or resurrect the cursor after a wipe", async () => {
    const storage = makeStorage();
    const items: SyncItem[] = [
      {
        collection: "watchlist",
        id: "remote-1",
        data: remoteProduct,
        updatedAt: 4000,
        deletedAt: null,
      },
    ];
    const pull = vi.fn(async () => {
      // Sign-out wipes the local store while the network pull is in flight.
      // isSignedIn still reads the stale auth ref here, so only the generation
      // gate can stop the sync from writing the previous account's rows back.
      await storage.clearAccountData();
      return { lastSyncedAt: 5000, items };
    });
    const push = vi.fn(async () => ({ accepted: 0, stamped: [] }));

    await syncNow({
      storage,
      isSignedIn: () => true,
      pull,
      push,
      now: () => 6000,
    });

    expect(await storage.getWatchlist()).toEqual([]);
    const meta = await storage.getSyncMeta();
    expect(meta.lastSyncedAt || 0).toBe(0);
  });
});
