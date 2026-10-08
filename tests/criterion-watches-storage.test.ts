import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    multiRemove: async (ks: string[]) => {
      ks.forEach((k) => store.delete(k));
    },
  },
}));

import {
  getCriterionWatches,
  addCriterionWatch,
  removeCriterionWatch,
  updateCriterionWatches,
  clearAllData,
} from "../lib/storage";

beforeEach(() => store.clear());

describe("criterion watch storage", () => {
  it("round-trips add/get/remove", async () => {
    await addCriterionWatch({
      id: "w1",
      category: "Networking Switch",
      maxPrice: 300,
      currency: "USD",
      seenProductIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      isActive: true,
    });
    expect((await getCriterionWatches()).map((w) => w.id)).toEqual(["w1"]);
    await removeCriterionWatch("w1");
    expect(await getCriterionWatches()).toEqual([]);
  });
  it("updateCriterionWatches applies a read-modify-write", async () => {
    await addCriterionWatch({
      id: "w1",
      category: "Storage",
      currency: "USD",
      seenProductIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      isActive: true,
    });
    await updateCriterionWatches((ws) =>
      ws.map((w) => ({ ...w, seenProductIds: ["p1"] })),
    );
    expect((await getCriterionWatches())[0]!.seenProductIds).toEqual(["p1"]);
  });
  it("is wiped by clearAllData", async () => {
    await addCriterionWatch({
      id: "w1",
      currency: "USD",
      seenProductIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      isActive: true,
    });
    await clearAllData();
    expect(await getCriterionWatches()).toEqual([]);
  });
});
