import { describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import type { Product } from "../lib/types";

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

describe("subscribeToStorageChanges", () => {
  it("notifies observers alongside the single setOnChange handler", async () => {
    const storage = makeStorage();
    const primary = vi.fn();
    const observer = vi.fn();
    storage.setOnChange(primary);
    const unsubscribe = storage.subscribeToStorageChanges(observer);

    await storage.addToWatchlist(product("p1"));

    expect(primary).toHaveBeenCalledWith("watchlist", "p1");
    expect(observer).toHaveBeenCalledWith("watchlist", "p1");

    unsubscribe();
    primary.mockClear();
    observer.mockClear();
    await storage.addToWatchlist(product("p2"));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(observer).not.toHaveBeenCalled();
  });

  it("fires observers even when no setOnChange handler is registered", async () => {
    // The sync engine is the only setOnChange user; a badge/observer must still
    // be woken on a local mutation when signed out.
    const storage = makeStorage();
    const observer = vi.fn();
    storage.subscribeToStorageChanges(observer);

    await storage.addToWatchlist(product("p1"));

    expect(observer).toHaveBeenCalledWith("watchlist", "p1");
  });
});
