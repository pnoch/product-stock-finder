import { describe, expect, it, vi } from "vitest";
import { runDiscoveryBatch } from "../lib/bulk-discovery";

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
    const progress: Array<[number, number, string]> = [];
    await runDiscoveryBatch({ items: items(3), startIndex: 0, storage: h.storage, discover: h.discover, onProgress: (done, total, model) => progress.push([done, total, model]) });
    expect(progress).toEqual([[1, 3, "M0"], [2, 3, "M1"], [3, 3, "M2"]]);
  });

  it("handles an empty item list", async () => {
    const h = harness();
    expect(await runDiscoveryBatch({ items: [], startIndex: 0, storage: h.storage, discover: h.discover })).toEqual({ nextIndex: 0, discovered: 0 });
  });
});
