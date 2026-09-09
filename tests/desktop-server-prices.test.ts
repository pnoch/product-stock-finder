import { describe, expect, it, vi } from "vitest";
import {
  fetchListingsWithTimeout,
  QUERY_TIMEOUT_MS,
  type PriceQueryClient,
} from "../desktop/src/lib/server-prices";
import type { DistributorListing, ServerPriceResult } from "../lib/types";

function makeListing(distributorId: string): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com",
    lastChecked: new Date(0).toISOString(),
    priceHistory: [],
  };
}

function makeResult(): ServerPriceResult {
  return { snapshot: null, history: [] };
}

function makeClient(
  query: (input: { distributorId: string; modelNumber: string }) => Promise<ServerPriceResult>,
): PriceQueryClient {
  return { prices: { get: { query } } };
}

describe("fetchListingsWithTimeout", () => {
  it("returns results in order and calls onItem once per listing", async () => {
    const listings = [makeListing("a"), makeListing("b"), makeListing("c")];
    const byId = { a: makeResult(), b: makeResult(), c: makeResult() };
    const onItem = vi.fn();
    const client = makeClient(async (input) => byId[input.distributorId as keyof typeof byId]);
    const results = await fetchListingsWithTimeout(client, listings, "model-1", onItem);
    expect(results[0]).toBe(byId.a);
    expect(results[1]).toBe(byId.b);
    expect(results[2]).toBe(byId.c);
    expect(onItem).toHaveBeenCalledTimes(3);
  });

  it("maps a rejecting query to null and continues the loop", async () => {
    const listings = [makeListing("a"), makeListing("b"), makeListing("c")];
    const onItem = vi.fn();
    const client = makeClient(async (input) => {
      if (input.distributorId === "b") throw new Error("boom");
      return makeResult();
    });
    const results = await fetchListingsWithTimeout(client, listings, "model-1", onItem);
    expect(results[0]).not.toBeNull();
    expect(results[1]).toBeNull();
    expect(results[2]).not.toBeNull();
    expect(onItem).toHaveBeenCalledTimes(3);
  });

  it("maps a never-resolving query to null after the injected timeout", async () => {
    const listings = [makeListing("a")];
    const onItem = vi.fn();
    const client = makeClient(() => new Promise<ServerPriceResult>(() => {}));
    const start = Date.now();
    const results = await fetchListingsWithTimeout(client, listings, "model-1", onItem, 20);
    expect(results).toEqual([null]);
    expect(Date.now() - start).toBeLessThan(QUERY_TIMEOUT_MS);
    expect(onItem).toHaveBeenCalledTimes(1);
  });

  it("returns [] for empty listings without calling onItem", async () => {
    const onItem = vi.fn();
    const client = makeClient(async () => makeResult());
    const results = await fetchListingsWithTimeout(client, [], "model-1", onItem);
    expect(results).toEqual([]);
    expect(onItem).not.toHaveBeenCalled();
  });
});
