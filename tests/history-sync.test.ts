import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product } from "../lib/types";

const state = vi.hoisted(() => ({
  watchlistStore: [] as Product[],
  uploaded: [] as Array<{
    distributorId: string;
    modelNumber: string;
    points: unknown[];
  }>,
}));

vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn(async () => state.watchlistStore),
}));

vi.mock("../lib/server-prices", () => ({
  uploadServerHistory: vi.fn(
    async (distributorId: string, modelNumber: string, points: unknown[]) => {
      state.uploaded.push({ distributorId, modelNumber, points });
    },
  ),
}));

import { backfillLocalHistory } from "../lib/history-sync";

function makeProduct(modelNumber: string, historyLength: number): Product {
  const points = Array.from({ length: historyLength }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    price: 100 - i,
    currency: "USD",
    stockStatus: "in_stock" as const,
  }));
  return {
    id: modelNumber.toLowerCase(),
    name: modelNumber,
    modelNumber,
    brand: "MikroTik",
    category: "Networking Switch",
    description: "",
    imageUrl: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [
      {
        distributorId: "server2u-my",
        productId: modelNumber.toLowerCase(),
        price: 90,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        lastChecked: "2026-08-01T00:00:00.000Z",
        priceHistory: points,
      },
    ],
  };
}

describe("backfillLocalHistory", () => {
  beforeEach(() => {
    state.watchlistStore = [];
    state.uploaded = [];
  });

  it("uploads local history for each watched listing", async () => {
    state.watchlistStore = [makeProduct("CRS804", 3), makeProduct("CRS326", 2)];
    const count = await backfillLocalHistory();
    expect(count).toBe(2);
    expect(state.uploaded).toHaveLength(2);
    expect(state.uploaded[0]).toMatchObject({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(state.uploaded[0]!.points).toHaveLength(3);
    expect(state.uploaded[1]).toMatchObject({ modelNumber: "CRS326" });
  });

  it("skips listings with empty history", async () => {
    state.watchlistStore = [makeProduct("CRS804", 0)];
    const count = await backfillLocalHistory();
    expect(count).toBe(0);
    expect(state.uploaded).toHaveLength(0);
  });

  it("returns 0 when the watchlist is empty", async () => {
    const count = await backfillLocalHistory();
    expect(count).toBe(0);
  });

  it("swallows upload errors", async () => {
    state.watchlistStore = [makeProduct("CRS804", 1)];
    state.uploaded = [];
    const { uploadServerHistory } = await import("../lib/server-prices");
    vi.mocked(uploadServerHistory).mockRejectedValueOnce(new Error("network"));
    const count = await backfillLocalHistory();
    expect(count).toBe(1);
  });
});
