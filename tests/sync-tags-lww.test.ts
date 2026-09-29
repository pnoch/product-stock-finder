import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import { syncNow } from "../lib/sync";
import type { Product, SyncItem } from "../lib/types";

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

function product(id: string): Product {
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

async function mergeIntoTags(
  local: { tags: string[]; tagsUpdatedAt?: string },
  incoming: { tags: string[]; tagsUpdatedAt?: string },
): Promise<Product> {
  const storage = makeStorage();
  await storage.addToWatchlist({ ...product("p1"), ...local });
  const pull = vi.fn(async () => ({
    lastSyncedAt: 5000,
    items: [
      {
        collection: "watchlist",
        id: "p1",
        data: { ...product("p1"), ...incoming },
        updatedAt: 4000,
        deletedAt: null,
      },
    ] as SyncItem[],
  }));
  const push = vi.fn(async () => ({ accepted: 0, stamped: [] }));
  await syncNow({
    storage,
    isSignedIn: () => true,
    pull,
    push,
    now: () => 6000,
  });
  return (await storage.getWatchlist())[0];
}

describe("tag merge across devices", () => {
  it("takes a newer remote tag removal instead of re-adding the tag", async () => {
    const result = await mergeIntoTags(
      { tags: ["a", "b"], tagsUpdatedAt: "2026-08-01T00:00:00.000Z" },
      { tags: ["a"], tagsUpdatedAt: "2026-08-02T00:00:00.000Z" },
    );
    expect(result.tags).toEqual(["a"]);
  });

  it("keeps a newer local removal against an older remote copy", async () => {
    const result = await mergeIntoTags(
      { tags: ["a"], tagsUpdatedAt: "2026-08-03T00:00:00.000Z" },
      { tags: ["a", "b"], tagsUpdatedAt: "2026-08-01T00:00:00.000Z" },
    );
    expect(result.tags).toEqual(["a"]);
  });

  it("unions when neither side carries a stamp (legacy data)", async () => {
    const result = await mergeIntoTags(
      { tags: ["a"] },
      { tags: ["a", "b"] },
    );
    expect(result.tags).toEqual(["a", "b"]);
  });

  it("compares tag stamps by parsed time across ISO formats", async () => {
    // `"…:00.500Z" >= "…:00Z"` is false lexically though chronologically later,
    // so a mixed-format remote stamp lost to the older local one.
    const result = await mergeIntoTags(
      { tags: ["a"], tagsUpdatedAt: "2026-08-01T00:00:00Z" },
      { tags: ["a", "b"], tagsUpdatedAt: "2026-08-01T00:00:00.500Z" },
    );
    expect(result.tags).toEqual(["a", "b"]);
  });

  it("carries the winning stamp forward so it keeps propagating", async () => {
    const result = await mergeIntoTags(
      { tags: ["a"], tagsUpdatedAt: "2026-08-01T00:00:00.000Z" },
      { tags: ["a", "b"], tagsUpdatedAt: "2026-08-02T00:00:00.000Z" },
    );
    expect(result.tags).toEqual(["a", "b"]);
    expect(result.tagsUpdatedAt).toBe("2026-08-02T00:00:00.000Z");
  });
});
