import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../server/prices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/prices")>();
  return {
    ...actual,
    getPrice: vi.fn(),
  };
});

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

import { getPrice } from "../server/prices";
import { mergeHistory } from "../server/price-history";
const mockedGetPrice = vi.mocked(getPrice);
const mockedMergeHistory = vi.mocked(mergeHistory);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
  };
}

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: 1000,
};

describe("prices router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the snapshot and history for a distributor and model", async () => {
    mockedGetPrice.mockResolvedValue({
      snapshot,
      history: [
        {
          date: "2026-08-01T00:00:00.000Z",
          price: 90,
          currency: "MYR",
          stockStatus: "in_stock",
        },
      ],
    });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toEqual({
      snapshot,
      history: [
        {
          date: "2026-08-01T00:00:00.000Z",
          price: 90,
          currency: "MYR",
          stockStatus: "in_stock",
        },
      ],
    });
    expect(mockedGetPrice).toHaveBeenCalledWith("server2u-my", "CRS804");
  });

  it("returns null snapshot when there is no cached price", async () => {
    mockedGetPrice.mockResolvedValue({ snapshot: null, history: [] });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toEqual({ snapshot: null, history: [] });
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetPrice.mockResolvedValue({ snapshot, history: [] });
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.prices.get({ distributorId: "a", modelNumber: "b" }),
    ).resolves.toEqual({ snapshot, history: [] });
  });

  it("uploadHistory merges uploaded points and returns the accepted count", async () => {
    mockedMergeHistory.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const points: {
      date: string;
      price: number;
      currency: string;
      stockStatus: "in_stock" | "back_order" | "out_of_stock" | "unknown";
    }[] = [
      {
        date: "2026-08-01T00:00:00.000Z",
        price: 90,
        currency: "MYR",
        stockStatus: "in_stock",
      },
    ];
    const result = await caller.prices.uploadHistory({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
      points,
    });
    expect(result).toEqual({ accepted: 1 });
    expect(mockedMergeHistory).toHaveBeenCalledWith(
      "server2u-my",
      "CRS804",
      points,
    );
  });
});
