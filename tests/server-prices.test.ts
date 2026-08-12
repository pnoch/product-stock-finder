import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchServerPrice } from "../lib/server-prices";

const mockedCreateClient = vi.mocked(createTRPCClient);

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: 1000,
};

const result = { snapshot, history: [] };

function mockClientQuery(query: Mock) {
  mockedCreateClient.mockReturnValue({
    prices: { get: { query } },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchServerPrice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the snapshot from the server", async () => {
    const query = vi.fn().mockResolvedValue(result);
    mockClientQuery(query);
    const res = await fetchServerPrice("server2u-my", "CRS804");
    expect(res).toEqual(snapshot);
    expect(query).toHaveBeenCalledWith({
      distributorId: "server2u-my",
      modelNumber: "CRS804",
    });
  });

  it("returns null when the server returns null snapshot", async () => {
    const query = vi.fn().mockResolvedValue({ snapshot: null, history: [] });
    mockClientQuery(query);
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const query = vi.fn().mockRejectedValue(new Error("network"));
    mockClientQuery(query);
    expect(await fetchServerPrice("server2u-my", "CRS804")).toBeNull();
  });

  it("returns null when the query times out", async () => {
    const query = vi.fn().mockImplementation(
      () =>
        new Promise<PriceSnapshot>((resolve) =>
          setTimeout(() => resolve(snapshot), 10_000),
        ),
    );
    mockClientQuery(query);
    const result = await fetchServerPrice("server2u-my", "CRS804");
    expect(result).toBeNull();
  });
});