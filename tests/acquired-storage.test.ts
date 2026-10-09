import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => { store.set(k, v); },
    removeItem: async (k: string) => { store.delete(k); },
    multiRemove: async (ks: string[]) => { ks.forEach((k) => store.delete(k)); },
  },
}));

import { addToWatchlist, getWatchlist, updateProductAcquired } from "../lib/storage";

beforeEach(() => store.clear());

const product = {
  id: "p1", name: "P1", modelNumber: "M1", brand: "X", category: "Router",
  description: "", isWatched: true, addedAt: "2026-01-01T00:00:00.000Z", listings: [],
} as never;

describe("updateProductAcquired", () => {
  it("sets and clears acquiredAt", async () => {
    await addToWatchlist(product);
    await updateProductAcquired("p1", "2026-02-01T00:00:00.000Z");
    expect((await getWatchlist())[0]!.acquiredAt).toBe("2026-02-01T00:00:00.000Z");
    await updateProductAcquired("p1", null);
    expect((await getWatchlist())[0]!.acquiredAt).toBeUndefined();
  });
});
