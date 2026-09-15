import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/trpc", () => ({ createTRPCClient: vi.fn() }));

import { createStorage } from "../lib/storage";

function makeStorage() {
  const m = new Map<string, string>();
  return createStorage({
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
  });
}

describe("discovery storage caps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bounds discovered products to the cap, keeping the newest", async () => {
    const storage = makeStorage();
    for (let i = 0; i < 250; i++) {
      await storage.addDiscoveredProduct({
        id: `p${i}`,
        name: `P${i}`,
        modelNumber: `M${i}`,
        brand: "B",
        category: "C",
        description: "",
        addedAt: "2026-01-01T00:00:00.000Z",
        isWatched: false,
        listings: [],
      });
    }
    const products = await storage.getDiscoveredProducts();
    expect(products.length).toBe(200);
    expect(products[products.length - 1]!.id).toBe("p249");
  });
});
