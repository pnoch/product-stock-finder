import { describe, expect, it, vi, afterEach } from "vitest";
import {
  manualAddProduct,
  rediscoverProduct,
  rediscoverMissingListings,
  DISCOVER_TIMEOUT_MS,
  MISSING_LISTINGS_PER_RUN,
} from "../lib/manual-add";
import type { DistributorListing } from "../lib/types";

function deps(overrides = {}) {
  return {
    storage: {
      addToWatchlist: vi.fn(async () => {}),
      updateProductListings: vi.fn(async () => {}),
    },
    trackedIds: new Set<string>(),
    discover: vi.fn(async () => []),
    timeoutMs: DISCOVER_TIMEOUT_MS,
    ...overrides,
  };
}

const input = { id: "crs326", name: "CRS326", modelNumber: "CRS326-24G", brand: "MikroTik", category: "Switches", description: "" };

describe("manualAddProduct", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("returns duplicate without writing", async () => {
    const d = deps({ trackedIds: new Set(["crs326"]) });
    await expect(manualAddProduct({ ...d, input })).resolves.toEqual({ status: "duplicate" });
    expect(d.storage.addToWatchlist).not.toHaveBeenCalled();
  });
  it("creates, discovers, and updates", async () => {
    const found = [{ distributorId: "d1" } as unknown as DistributorListing];
    const d = deps({ discover: vi.fn(async () => found) });
    await expect(manualAddProduct({ ...d, input })).resolves.toEqual({ status: "created", discovered: 1, timedOut: false });
    expect(d.storage.addToWatchlist).toHaveBeenCalledWith(expect.objectContaining({ id: "crs326", listings: [] }));
    expect(d.storage.updateProductListings).toHaveBeenCalledWith("crs326", found);
  });
  it("times out to empty without throwing", async () => {
    vi.useFakeTimers();
    const d = deps({ discover: vi.fn(() => new Promise<DistributorListing[]>(() => {})) });
    const p = manualAddProduct({ ...d, input });
    await vi.advanceTimersByTimeAsync(DISCOVER_TIMEOUT_MS + 100);
    await expect(p).resolves.toEqual({ status: "created", discovered: 0, timedOut: true });
    expect(d.storage.updateProductListings).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("rethrows add failures", async () => {
    const d = deps({ storage: { addToWatchlist: vi.fn(async () => { throw new Error("db"); }), updateProductListings: vi.fn() } });
    await expect(manualAddProduct({ ...d, input })).rejects.toThrow("db");
  });
  it("propagates onProgress", async () => {
    const onProgress = vi.fn();
    const d = deps({ discover: vi.fn(async (_m: string, o?: { onProgress?: (done: number, total: number) => void }) => { o?.onProgress?.(1, 2); return []; }) });
    await manualAddProduct({ ...d, input, onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 2);
  });
  it("carries tags into the created product", async () => {
    const d = deps();
    await manualAddProduct({ ...d, input: { ...input, tags: ["t1"] } });
    expect(d.storage.addToWatchlist).toHaveBeenCalledWith(expect.objectContaining({ tags: ["t1"] }));
  });
});

describe("rediscoverProduct", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("discovers and updates", async () => {
    const found = [{ distributorId: "d1" } as unknown as DistributorListing];
    const storage = {
      updateProductListings: vi.fn(async () => {}),
    };
    const discover = vi.fn(async () => found);
    await expect(
      rediscoverProduct({ storage, discover, productId: "crs326", modelNumber: "CRS326-24G" }),
    ).resolves.toEqual({ discovered: 1, timedOut: false });
    expect(storage.updateProductListings).toHaveBeenCalledWith("crs326", found);
  });
  it("times out without writing", async () => {
    vi.useFakeTimers();
    const storage = {
      updateProductListings: vi.fn(async () => {}),
    };
    const discover = vi.fn(() => new Promise<DistributorListing[]>(() => {}));
    const p = rediscoverProduct({ storage, discover, productId: "crs326", modelNumber: "CRS326-24G" });
    await vi.advanceTimersByTimeAsync(DISCOVER_TIMEOUT_MS + 100);
    await expect(p).resolves.toEqual({ discovered: 0, timedOut: true });
    expect(storage.updateProductListings).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("rediscoverMissingListings", () => {
  it("discovers only products without listings, up to the limit", async () => {
    const discover = vi.fn(async () => [
      { distributorId: "d1" } as unknown as DistributorListing,
    ]);
    const updateProductListings = vi.fn(async () => {});
    const result = await rediscoverMissingListings({
      storage: {
        getWatchlist: async () => [
          { id: "empty-1", modelNumber: "A", listings: [] },
          { id: "has", modelNumber: "B", listings: [{ distributorId: "x" }] },
          { id: "empty-2", modelNumber: "C", listings: [] },
          { id: "empty-3", modelNumber: "D", listings: [] },
          { id: "no-model", modelNumber: "", listings: [] },
        ],
        updateProductListings,
      } as never,
      discover,
      limit: 2,
    });
    expect(result).toEqual({ scanned: 2, discovered: 2 });
    expect(discover).toHaveBeenCalledTimes(2);
    expect(updateProductListings).toHaveBeenCalledWith("empty-1", [
      { distributorId: "d1" },
    ]);
  });

  it("keeps going when one product's discovery fails", async () => {
    let call = 0;
    const discover = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new Error("boom");
      return [{ distributorId: "d1" } as unknown as DistributorListing];
    });
    const result = await rediscoverMissingListings({
      storage: {
        getWatchlist: async () => [
          { id: "a", modelNumber: "A", listings: [] },
          { id: "b", modelNumber: "B", listings: [] },
        ],
        updateProductListings: vi.fn(async () => {}),
      } as never,
      discover,
      limit: 2,
    });
    expect(result).toEqual({ scanned: 2, discovered: 1 });
  });

  it("defaults to a small batch so a big import cannot flood the network", async () => {
    const discover = vi.fn(async () => []);
    const products = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      modelNumber: `M${i}`,
      listings: [],
    }));
    const result = await rediscoverMissingListings({
      storage: {
        getWatchlist: async () => products,
        updateProductListings: vi.fn(async () => {}),
      } as never,
      discover,
    });
    expect(result.scanned).toBe(MISSING_LISTINGS_PER_RUN);
    expect(discover).toHaveBeenCalledTimes(MISSING_LISTINGS_PER_RUN);
  });
});
