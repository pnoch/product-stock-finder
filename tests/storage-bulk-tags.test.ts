import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Product } from "../lib/types";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

import {
  addTagsToProducts,
  getWatchlist,
  saveWatchlist,
} from "../lib/storage";

function makeProduct(id: string, tags?: string[]): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: `M-${id}`,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
    tags,
  };
}

beforeEach(() => {
  store.clear();
});

describe("addTagsToProducts", () => {
  it("adds tags to the given products, deduping existing tags", async () => {
    await saveWatchlist([makeProduct("p1", ["t1"]), makeProduct("p2")]);

    await addTagsToProducts(["p1", "p2"], ["t1", "t2"]);

    const list = await getWatchlist();
    expect(list.find((p) => p.id === "p1")?.tags).toEqual(["t1", "t2"]);
    expect(list.find((p) => p.id === "p2")?.tags).toEqual(["t1", "t2"]);
  });

  it("leaves non-targeted products untouched", async () => {
    await saveWatchlist([makeProduct("p1"), makeProduct("p2")]);

    await addTagsToProducts(["p1"], ["t9"]);

    const list = await getWatchlist();
    expect(list.find((p) => p.id === "p1")?.tags).toEqual(["t9"]);
    expect(list.find((p) => p.id === "p2")?.tags).toBeUndefined();
  });
});
