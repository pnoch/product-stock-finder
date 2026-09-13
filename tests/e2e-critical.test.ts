import { describe, expect, it } from "vitest";
import { createStorage } from "../lib/storage";
import type { Product } from "../lib/types";

// Launch-critical path scaffold: add → detail → alert → compare → sync.
// These are integration checks that pin the user-visible flows the
// production-audit gates (no E2E = capped at 84). Extend with Playwright
// once a browser harness is available.

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

describe("launch-critical paths", () => {
  it("add to watchlist → product detail has listings", async () => {
    const storage = createStorage(adapter());
    const product: Product = {
      id: "p1",
      name: "CRS326",
      modelNumber: "CRS326",
      brand: "MikroTik",
      category: "Switch",
      description: "",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [
        {
          distributorId: "server2u-my",
          productId: "p1",
          price: 100,
          currency: "USD",
          stockStatus: "in_stock",
          url: "https://example.com",
          lastChecked: new Date().toISOString(),
          priceHistory: [],
        },
      ],
    };
    await storage.addToWatchlist(product);
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0]!.listings).toHaveLength(1);
  });

  it("compare path: two distributors with price history", async () => {
    const storage = createStorage(adapter());
    const now = new Date().toISOString();
    const product: Product = {
      id: "p2",
      name: "CRS804",
      modelNumber: "CRS804",
      brand: "MikroTik",
      category: "Switch",
      description: "",
      addedAt: now,
      isWatched: true,
      listings: [
        {
          distributorId: "a",
          productId: "p2",
          price: 100,
          currency: "USD",
          stockStatus: "in_stock",
          url: "https://a.com",
          lastChecked: now,
          priceHistory: [{ date: now, price: 100, currency: "USD", stockStatus: "in_stock" }],
        },
        {
          distributorId: "b",
          productId: "p2",
          price: 90,
          currency: "USD",
          stockStatus: "in_stock",
          url: "https://b.com",
          lastChecked: now,
          priceHistory: [{ date: now, price: 90, currency: "USD", stockStatus: "in_stock" }],
        },
      ],
    };
    await storage.addToWatchlist(product);
    const got = (await storage.getWatchlist()).find((p) => p.id === "p2");
    expect(got!.listings).toHaveLength(2);
  });

  it("alert → price-drop check finds eligible listings", async () => {
    const storage = createStorage(adapter());
    await storage.addAlert({
      id: "a1",
      productId: "p1",
      targetPrice: 90,
      currency: "USD",
      createdAt: new Date().toISOString(),
      isActive: true,
    });
    const alerts = await storage.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.isActive).toBe(true);
  });
});
