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

import { addToWatchlist, getWatchlist, updateProductSourcing } from "../lib/storage";

beforeEach(() => store.clear());

const product = {
  id: "p1", name: "P1", modelNumber: "M1", brand: "X", category: "Router",
  description: "", isWatched: true, addedAt: "2026-01-01T00:00:00.000Z", listings: [],
} as never;

describe("updateProductSourcing", () => {
  it("sets quantity and target sell price", async () => {
    await addToWatchlist(product);
    await updateProductSourcing("p1", { quantity: 20, targetSellPrice: 280, sellCurrency: "USD" });
    const p = (await getWatchlist())[0]!;
    expect(p.quantity).toBe(20);
    expect(p.targetSellPrice).toBe(280);
    expect(p.sellCurrency).toBe("USD");
  });
  it("clears the fields when passed null", async () => {
    await addToWatchlist(product);
    await updateProductSourcing("p1", { quantity: 5, targetSellPrice: 100, sellCurrency: "USD" });
    await updateProductSourcing("p1", { quantity: null, targetSellPrice: null });
    const p = (await getWatchlist())[0]!;
    expect(p.quantity).toBeUndefined();
    expect(p.targetSellPrice).toBeUndefined();
  });
});
