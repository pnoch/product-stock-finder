import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  manualAddProduct,
  rediscoverProduct,
  rediscoverMissingListings,
  clearListingAttemptsForTests,
  DISCOVER_TIMEOUT_MS,
  MISSING_LISTINGS_PER_RUN,
} from "../lib/manual-add";
import type { DistributorListing } from "../lib/types";

function deps(overrides = {}) {
  return {
    storage: {
      // The real API resolves true on a successful (non-duplicate) add.
      addToWatchlist: vi.fn(async () => true),
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

  it("records a miss so the background rotation skips it", async () => {
    clearListingAttemptsForTests();
    const discover = vi.fn(async () => []);
    await rediscoverProduct({
      storage: { updateProductListings: vi.fn(async () => {}) },
      discover,
      productId: "miss",
      modelNumber: "M1",
    });
    // The same product must not be re-scraped by the background rotation within
    // the retry window after a user-driven miss.
    const result = await rediscoverMissingListings({
      storage: {
        getWatchlist: async () => [{ id: "miss", modelNumber: "M1", listings: [] }],
        updateProductListings: vi.fn(async () => {}),
      } as never,
      discover,
      now: Date.now() + 60_000,
    });
    expect(result.scanned).toBe(0);
  });
});

describe("rediscoverMissingListings", () => {
  beforeEach(() => {
    // The attempt record is per-process; reset so tests are independent.
    clearListingAttemptsForTests();
  });

  it("rotates past a product that keeps finding nothing", async () => {
    const watch = async () => [
      { id: "miss-1", modelNumber: "A", listings: [] },
      { id: "miss-2", modelNumber: "B", listings: [] },
    ];
    const discover = vi.fn(async () => []); // nothing found anywhere
    const run = (now: number) =>
      rediscoverMissingListings({
        storage: {
          getWatchlist: watch,
          updateProductListings: vi.fn(async () => {}),
        } as never,
        discover,
        limit: 1,
        now,
      });

    // Realistic timestamps: a never-attempted product must pass the freshness
    // check (a tiny epoch value would look "too recent").
    const t0 = Date.now();
    expect((await run(t0)).scanned).toBe(1);
    // A product attempted recently is skipped, so the next one is reached
    // instead of the same first product being re-scraped forever.
    expect((await run(t0 + 60_000)).scanned).toBe(1);
    const attempted = discover.mock.calls.map(
      (call) =>
        ((call as unknown[])[1] as { productId?: string } | undefined)
          ?.productId,
    );
    expect(new Set(attempted).size).toBe(2);
    // Within the cooldown nothing is retried at all.
    expect((await run(t0 + 120_000)).scanned).toBe(0);
  });

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
