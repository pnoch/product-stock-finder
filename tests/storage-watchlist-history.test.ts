import { describe, expect, it } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import type { DistributorListing, Product } from "../lib/types";

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return createStorage({
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => {
      store.set(k, v);
    },
    removeItem: async (k) => {
      store.delete(k);
    },
    multiRemove: async (keys) => {
      keys.forEach((k) => store.delete(k));
    },
  });
}

function history(days: number): DistributorListing["priceHistory"] {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    price: 100 + i,
    currency: "USD",
    stockStatus: "in_stock" as const,
  }));
}

function listing(price: number, points = history(30)): DistributorListing {
  return {
    distributorId: "d1",
    productId: "p1",
    price,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p1",
    lastChecked: "2026-08-01T00:00:00.000Z",
    priceHistory: points,
  };
}

function product(): Product {
  return {
    id: "p1",
    name: "Product",
    modelNumber: "P1",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-07-01T00:00:00.000Z",
    isWatched: true,
    listings: [listing(100)],
  };
}

describe("updateProductListings", () => {
  it("merges history for a refreshed distributor instead of replacing it", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist(product());

    await storage.updateProductListings("p1", [
      listing(120, [
        {
          date: "2026-08-01T00:00:00.000Z",
          price: 120,
          currency: "USD",
          stockStatus: "in_stock",
        },
      ]),
    ]);

    const [stored] = await storage.getWatchlist();
    const refreshed = stored!.listings![0]!;
    expect(refreshed.price).toBe(120);
    expect(refreshed.priceHistory).toHaveLength(31);
    expect(refreshed.priceHistory[0]!.date).toBe("2026-07-01T00:00:00.000Z");
    expect(refreshed.priceHistory.at(-1)!.date).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("still keeps distributors that were not part of the refresh", async () => {
    const storage = makeStorage();
    await storage.addToWatchlist({
      ...product(),
      listings: [
        listing(100),
        { ...listing(90), distributorId: "d2", productId: "p1" },
      ],
    });

    await storage.updateProductListings("p1", [listing(120, [])]);

    const [stored] = await storage.getWatchlist();
    expect(stored!.listings!.map((l) => l.distributorId).sort()).toEqual([
      "d1",
      "d2",
    ]);
  });
});
