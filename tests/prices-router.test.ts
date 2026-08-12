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

import { getPrice } from "../server/prices";
const mockedGetPrice = vi.mocked(getPrice);

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

  it("returns the price snapshot for a distributor and model", async () => {
    mockedGetPrice.mockResolvedValue(snapshot);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toEqual(snapshot);
    expect(mockedGetPrice).toHaveBeenCalledWith("server2u-my", "CRS804");
  });

  it("returns null when there is no cached price", async () => {
    mockedGetPrice.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prices.get({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
    expect(result).toBeNull();
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetPrice.mockResolvedValue(snapshot);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.prices.get({ distributorId: "a", modelNumber: "b" }),
    ).resolves.toEqual(snapshot);
  });
});