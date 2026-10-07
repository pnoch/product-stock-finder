import { describe, expect, it, beforeEach } from "vitest";

import { createStorage } from "../lib/storage";

const store = new Map<string, string>();

function makeStorage() {
  return createStorage({
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => {
      store.set(key, value);
    },
    removeItem: async (key) => {
      store.delete(key);
    },
    multiRemove: async (keys) => {
      keys.forEach((key) => store.delete(key));
    },
  });
}

beforeEach(() => {
  store.clear();
});

describe("any-scope stock watches", () => {
  it("de-dupes an 'any' watch on the '*' sentinel", async () => {
    const storage = makeStorage();
    await storage.addStockWatch({
      id: "w1",
      productId: "p1",
      productName: "P",
      distributorId: "*",
      distributorName: "Any distributor",
      reminderDate: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      reminderType: "back_in_stock",
      scope: "any",
    });
    await storage.addStockWatch({
      id: "w2",
      productId: "p1",
      productName: "P",
      distributorId: "*",
      distributorName: "Any distributor",
      reminderDate: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-02T00:00:00.000Z",
      reminderType: "back_in_stock",
      scope: "any",
    });
    const watches = await storage.getStockWatches();
    expect(watches.filter((w) => w.productId === "p1")).toHaveLength(1);
  });

  it("updateStockWatchStatuses sets the per-distributor map", async () => {
    const storage = makeStorage();
    await storage.addStockWatch({
      id: "w3",
      productId: "p2",
      productName: "P2",
      distributorId: "*",
      distributorName: "Any distributor",
      reminderDate: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      reminderType: "back_in_stock",
      scope: "any",
    });
    await storage.updateStockWatchStatuses("w3", {
      d1: "in_stock",
      d2: "back_order",
    });
    const watch = (await storage.getStockWatches()).find((w) => w.id === "w3");
    expect(watch?.lastKnownStatusByDistributor).toEqual({
      d1: "in_stock",
      d2: "back_order",
    });
  });
});
