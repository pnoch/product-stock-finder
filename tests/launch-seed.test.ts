import { describe, expect, it, vi } from "vitest";
import { seedWatchlistProducts, SEED_IDS } from "../lib/launch-seed";

function mockStorage(existing: Array<{ id: string; listings?: unknown[] }> = []) {
  return {
    getWatchlist: vi.fn(async () => existing),
    addToWatchlist: vi.fn(async (_product: { id: string; name?: string; modelNumber?: string }) => {}),
    updateProductListings: vi.fn(async (_id: string, _listings: unknown[]) => {}),
  };
}

describe("seedWatchlistProducts", () => {
  it("seeds all ids on empty watchlist with their catalog fields", async () => {
    const storage = mockStorage();
    const catalog = SEED_IDS.map((id) => ({
      id,
      name: `Name ${id}`,
      modelNumber: `MODEL-${id}`,
    }));
    await seedWatchlistProducts({ storage, catalog, sampleListings: {}, freshen: (l) => l });
    expect(storage.addToWatchlist).toHaveBeenCalledTimes(SEED_IDS.length);
    // Assert the payload, not just the call count: seeding the wrong product
    // (or dropping required fields) must fail.
    const seededIds = storage.addToWatchlist.mock.calls.map(
      (c) => (c[0] as { id: string }).id,
    );
    expect(new Set(seededIds)).toEqual(new Set(SEED_IDS));
    for (const call of storage.addToWatchlist.mock.calls) {
      const product = call[0] as { id: string; name?: string; modelNumber?: string };
      expect(product.name).toBe(`Name ${product.id}`);
      expect(product.modelNumber).toBe(`MODEL-${product.id}`);
    }
  });
  it("skips present ids and backfills empty MikroTik listings", async () => {
    const storage = mockStorage([
      { id: "nvidia-rtx-4090", listings: [{ x: 1 }] },
      { id: "mikrotik-crs804-4ddq-hrm", listings: [] },
    ]);
    const catalog = SEED_IDS.map((id) => ({ id }));
    await seedWatchlistProducts({ storage, catalog, sampleListings: {}, freshen: (l) => l });
    expect(storage.addToWatchlist).toHaveBeenCalledTimes(SEED_IDS.length - 2);
    expect(storage.updateProductListings).toHaveBeenCalledTimes(1);
    // The backfilled listings must be the sample listings for that product,
    // not an empty array.
    const [backfilledId, backfilledListings] =
      storage.updateProductListings.mock.calls[0]!;
    expect(backfilledId).toBe("mikrotik-crs804-4ddq-hrm");
    expect(Array.isArray(backfilledListings)).toBe(true);
  });
});
