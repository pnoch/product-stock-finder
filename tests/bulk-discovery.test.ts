import { describe, expect, it, vi } from "vitest";
import { runDiscoveryBatch, runDiscoveryLoop } from "../lib/bulk-discovery";

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    productId: `p${i}`,
    modelNumber: `M${i}`,
  }));
}

function harness(listingsPerModel = 1) {
  const updated: Record<string, number> = {};
  return {
    updated,
    storage: {
      updateProductListings: vi.fn(async (id: string, listings: unknown[]) => {
        updated[id] = listings.length;
      }),
    },
    discover: vi.fn(async () =>
      Array.from({ length: listingsPerModel }, (_, i) => ({
        distributorId: `d${i}`,
        productId: "p",
        price: 1,
        currency: "USD",
        stockStatus: "in_stock" as const,
        url: "u",
        lastChecked: "2026-01-01T00:00:00.000Z",
        priceHistory: [],
      })),
    ),
  };
}

describe("runDiscoveryBatch", () => {
  it("runs a default batch of 3 and returns the next index", async () => {
    const h = harness();
    const result = await runDiscoveryBatch({ items: items(7), startIndex: 0, storage: h.storage, discover: h.discover });
    expect(h.discover).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ nextIndex: 3, discovered: 3 });
  });

  it("continues from a prior nextIndex", async () => {
    const h = harness();
    const result = await runDiscoveryBatch({ items: items(7), startIndex: 3, storage: h.storage, discover: h.discover });
    expect(result.nextIndex).toBe(6);
    expect(h.discover).toHaveBeenCalledTimes(3);
  });

  it("honors a batchSize override and never runs past the end", async () => {
    const h = harness();
    expect((await runDiscoveryBatch({ items: items(5), startIndex: 0, batchSize: 1, storage: h.storage, discover: h.discover })).nextIndex).toBe(1);
    expect((await runDiscoveryBatch({ items: items(2), startIndex: 0, batchSize: 10, storage: h.storage, discover: h.discover })).nextIndex).toBe(2);
  });

  it("stops early when shouldCancel becomes true", async () => {
    const h = harness();
    let calls = 0;
    const result = await runDiscoveryBatch({ items: items(7), startIndex: 0, storage: h.storage, discover: h.discover, shouldCancel: () => calls++ > 0 });
    expect(h.discover).toHaveBeenCalledTimes(1);
    expect(result.nextIndex).toBe(1);
  });

  it("absorbs a throwing discover and still advances", async () => {
    const h = harness();
    h.discover.mockRejectedValue(new Error("boom"));
    const result = await runDiscoveryBatch({ items: items(3), startIndex: 0, storage: h.storage, discover: h.discover });
    expect(result).toEqual({ nextIndex: 3, discovered: 0 });
  });

  it("reports progress with the model number", async () => {
    const h = harness();
    const progress: [number, number, string][] = [];
    await runDiscoveryBatch({ items: items(3), startIndex: 0, storage: h.storage, discover: h.discover, onProgress: (done, total, model) => progress.push([done, total, model]) });
    expect(progress).toEqual([[1, 3, "M0"], [2, 3, "M1"], [3, 3, "M2"]]);
  });

  it("reports overall progress across continuation batches", async () => {
    const h = harness();
    const progress: [number, number, string][] = [];
    await runDiscoveryBatch({
      items: items(7),
      startIndex: 3,
      storage: h.storage,
      discover: h.discover,
      onProgress: (done, total, model) => progress.push([done, total, model]),
    });
    expect(progress).toEqual([[4, 7, "M3"], [5, 7, "M4"], [6, 7, "M5"]]);
  });

  it("clamps a startIndex past the end and ignores a non-positive batch", async () => {
    const h = harness();
    expect(await runDiscoveryBatch({ items: items(3), startIndex: 99, storage: h.storage, discover: h.discover })).toEqual({ nextIndex: 3, discovered: 0 });
    expect(await runDiscoveryBatch({ items: items(3), startIndex: 0, batchSize: 0, storage: h.storage, discover: h.discover })).toEqual({ nextIndex: 0, discovered: 0 });
  });

  it("handles an empty item list", async () => {
    const h = harness();
    expect(await runDiscoveryBatch({ items: [], startIndex: 0, storage: h.storage, discover: h.discover })).toEqual({ nextIndex: 0, discovered: 0 });
  });
});

describe("runDiscoveryLoop", () => {
  it("drains every model when there is no confirm callback", async () => {
    const h = harness();
    const result = await runDiscoveryLoop({ items: items(7), storage: h.storage, discover: h.discover });
    expect(result).toEqual({ nextIndex: 7, discovered: 7 });
    expect(h.discover).toHaveBeenCalledTimes(7);
  });

  it("stops early when confirmContinue returns false after the first batch", async () => {
    const h = harness();
    const confirm = vi.fn(() => false);
    const result = await runDiscoveryLoop({
      items: items(10),
      storage: h.storage,
      discover: h.discover,
      confirmContinue: confirm,
    });
    expect(result.nextIndex).toBe(3);
    expect(confirm).toHaveBeenCalledWith(7);
    expect(h.discover).toHaveBeenCalledTimes(3);
  });

  it("continues through batches while confirmContinue returns true", async () => {
    const h = harness();
    const confirm = vi.fn(() => true);
    const result = await runDiscoveryLoop({
      items: items(7),
      storage: h.storage,
      discover: h.discover,
      confirmContinue: confirm,
    });
    expect(result).toEqual({ nextIndex: 7, discovered: 7 });
    // Confirmed once after each batch that leaves a remainder (4, then 1).
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenNthCalledWith(1, 4);
    expect(confirm).toHaveBeenNthCalledWith(2, 1);
  });

  it("does nothing for an empty list", async () => {
    const h = harness();
    expect(await runDiscoveryLoop({ items: [], storage: h.storage, discover: h.discover })).toEqual({ nextIndex: 0, discovered: 0 });
    expect(h.discover).not.toHaveBeenCalled();
  });

  it("terminates without progress when shouldCancel is immediately true", async () => {
    const h = harness();
    const confirm = vi.fn(() => true);
    const result = await runDiscoveryLoop({
      items: items(10),
      storage: h.storage,
      discover: h.discover,
      shouldCancel: () => true,
      confirmContinue: confirm,
    });
    expect(result).toEqual({ nextIndex: 0, discovered: 0 });
    expect(confirm).not.toHaveBeenCalled();
    expect(h.discover).not.toHaveBeenCalled();
  });

  it("absorbs a storage failure and still drains the list", async () => {
    const h = harness();
    // rediscoverProduct propagates a storage throw; the batch runner must
    // absorb it per item so one bad write cannot abort the whole import.
    h.storage.updateProductListings.mockRejectedValue(new Error("disk full"));
    const result = await runDiscoveryLoop({ items: items(3), storage: h.storage, discover: h.discover });
    // The write failure is swallowed per item, so the loop still advances.
    expect(result).toEqual({ nextIndex: 3, discovered: 0 });
    expect(h.discover).toHaveBeenCalledTimes(3);
  });
});
