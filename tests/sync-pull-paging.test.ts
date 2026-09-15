import { describe, expect, it, vi } from "vitest";
import { createStorage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { SyncItem } from "../lib/types";

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

function item(id: string, updatedAt: number): SyncItem {
  return {
    collection: "watchlist",
    id,
    data: { id, name: id, modelNumber: id, listings: [] },
    updatedAt,
    deletedAt: null,
  };
}

describe("sync pull paging", () => {
  it("drains every page until hasMore is false", async () => {
    const storage = createStorage(adapter());
    const pages: SyncItem[][] = [
      [item("a", 10), item("b", 20)],
      [item("c", 30)],
      [item("d", 40)],
    ];
    let call = 0;
    const pull = vi.fn(async (_since: number | null, cursor?: number | null) => {
      const idx = call++;
      void cursor;
      return {
        lastSyncedAt: 100,
        items: pages[idx] ?? [],
        hasMore: idx < pages.length - 1,
      };
    });
    const push = vi.fn(async () => ({ accepted: 0, stamped: [] }));

    await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 1000 });

    // 3 pages → 3 pull calls (the loop stops once hasMore is false).
    expect(pull).toHaveBeenCalledTimes(3);
    const watchlist = await storage.getWatchlist();
    expect(watchlist.map((p) => p.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("stops when a page returns no items even if hasMore is set", async () => {
    const storage = createStorage(adapter());
    let call = 0;
    const pull = vi.fn(async () => {
      call += 1;
      return {
        lastSyncedAt: 100,
        items: call === 1 ? [item("a", 10)] : [],
        hasMore: true,
      };
    });
    const push = vi.fn(async () => ({ accepted: 0, stamped: [] }));

    await syncNow({ storage, isSignedIn: () => true, pull, push, now: () => 1000 });
    // Second call returns empty → loop breaks rather than spinning.
    expect(pull).toHaveBeenCalledTimes(2);
  });
});
