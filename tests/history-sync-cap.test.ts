import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/server-prices", () => ({
  uploadServerHistory: vi.fn(),
}));
vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn(),
}));
vi.mock("../constants/oauth", () => ({
  isServerConfigured: vi.fn(() => true),
}));

import { backfillLocalHistory } from "../lib/history-sync";
import { uploadServerHistory } from "../lib/server-prices";
import { getWatchlist } from "../lib/storage";
import { MAX_UPLOAD_HISTORY_POINTS } from "../shared/const";

function product(points: number) {
  return {
    id: "p1",
    name: "P",
    modelNumber: "CRS804",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [
      {
        distributorId: "d1",
        productId: "p1",
        price: 1,
        currency: "USD",
        stockStatus: "in_stock",
        url: "",
        lastChecked: "2026-01-01T00:00:00.000Z",
        priceHistory: Array.from({ length: points }, (_, i) => ({
          date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
          price: 1,
          currency: "USD",
          stockStatus: "in_stock",
        })),
      },
    ],
  };
}

describe("backfillLocalHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trims to the server cap (newest kept)", async () => {
    vi.mocked(getWatchlist).mockResolvedValue([product(500)] as never);
    vi.mocked(uploadServerHistory).mockResolvedValue(true);

    await backfillLocalHistory();

    const points = vi.mocked(uploadServerHistory).mock.calls[0]![2];
    expect(points.length).toBe(MAX_UPLOAD_HISTORY_POINTS);
  });

  it("counts only confirmed uploads", async () => {
    vi.mocked(getWatchlist).mockResolvedValue([product(10)] as never);
    vi.mocked(uploadServerHistory).mockResolvedValue(false);

    expect(await backfillLocalHistory()).toBe(0);
  });

  it("counts a successful upload", async () => {
    vi.mocked(getWatchlist).mockResolvedValue([product(10)] as never);
    vi.mocked(uploadServerHistory).mockResolvedValue(true);

    expect(await backfillLocalHistory()).toBe(1);
  });
});
