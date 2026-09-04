import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { PricePoint, PriceSnapshot } from "../lib/types";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchServerPrice, uploadServerHistory } from "../lib/server-prices";

const mockedCreateClient = vi.mocked(createTRPCClient);

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: 1000,
};

function mockClient(query: Mock, mutation: Mock) {
  mockedCreateClient.mockReturnValue({
    prices: {
      get: { query },
      uploadHistory: { mutate: mutation },
    },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchServerPrice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the snapshot and history from the server", async () => {
    const query = vi.fn().mockResolvedValue({
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
    mockClient(query, vi.fn());
    const result = await fetchServerPrice("server2u-my", "CRS804");
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
    expect(query).toHaveBeenCalledWith({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
  });

  it("returns null when the server returns a null snapshot", async () => {
    const query = vi.fn().mockResolvedValue({ snapshot: null, history: [] });
    mockClient(query, vi.fn());
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const query = vi.fn().mockRejectedValue(new Error("network"));
    mockClient(query, vi.fn());
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query times out", async () => {
    const query = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise<{ snapshot: PriceSnapshot; history: unknown[] }>(
            (resolve) =>
              setTimeout(() => resolve({ snapshot, history: [] }), 10_000),
          ),
      );
    mockClient(query, vi.fn());
    const result = await fetchServerPrice("server2u-my", "CRS804");
    expect(result).toBeNull();
  });
});

describe("uploadServerHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mutates the server with the uploaded points", async () => {
    const mutation = vi.fn().mockResolvedValue({ accepted: 2 });
    mockClient(vi.fn(), mutation);
    const points: PricePoint[] = [
      {
        date: "2026-08-01T00:00:00.000Z",
        price: 90,
        currency: "MYR",
        stockStatus: "in_stock",
      },
      {
        date: "2026-08-02T00:00:00.000Z",
        price: 88,
        currency: "MYR",
        stockStatus: "in_stock",
      },
    ];
    await uploadServerHistory("server2u-my", "CRS804", points);
    expect(mutation).toHaveBeenCalledWith({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
      points,
    });
  });

  it("swallows errors", async () => {
    const mutation = vi.fn().mockRejectedValue(new Error("network"));
    mockClient(vi.fn(), mutation);
    await expect(
      uploadServerHistory("server2u-my", "CRS804", []),
    ).resolves.toBeUndefined();
  });
});

describe("isFreshPriceSnapshot", () => {
  it("accepts recent snapshots", async () => {
    const { isFreshPriceSnapshot } = await import("../lib/server-prices");
    const now = 1_800_000_000_000;
    expect(
      isFreshPriceSnapshot(
        { price: 1, currency: "USD", stockStatus: "in_stock", url: "", fetchedAt: now - 1000 },
        now,
      ),
    ).toBe(true);
  });

  it("rejects snapshots older than the TTL", async () => {
    const { isFreshPriceSnapshot } = await import("../lib/server-prices");
    const now = 1_800_000_000_000;
    expect(
      isFreshPriceSnapshot(
        { price: 1, currency: "USD", stockStatus: "in_stock", url: "", fetchedAt: now - 2 * 60 * 60 * 1000 },
        now,
      ),
    ).toBe(false);
  });

  it("rejects missing or non-finite timestamps", async () => {
    const { isFreshPriceSnapshot } = await import("../lib/server-prices");
    const now = 1_800_000_000_000;
    expect(isFreshPriceSnapshot(null, now)).toBe(false);
    expect(
      isFreshPriceSnapshot(
        { price: 1, currency: "USD", stockStatus: "in_stock", url: "", fetchedAt: NaN },
        now,
      ),
    ).toBe(false);
  });
});
