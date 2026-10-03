import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { seedWatchlistProducts, SEED_IDS } from "../lib/launch-seed";

function mockStorage(existing: { id: string; listings?: unknown[] }[] = []) {
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

  it("keeps the AGENTS.md seeding description tied to SEED_IDS", async () => {
    // AGENTS.md used to name only CRS804/CRS326 while SEED_IDS seeds seven
    // products, so agents reading it believed two products were seeded.
    const agents = await readFile("AGENTS.md", "utf8");
    expect(agents).toContain("SEED_IDS");
    expect(agents).toContain("lib/launch-seed.ts");
  });

  it("logs and gives up when the watchlist cannot be read", async () => {
    const storage = {
      getWatchlist: vi.fn(async () => {
        throw new Error("db down");
      }),
      addToWatchlist: vi.fn(async () => {}),
      updateProductListings: vi.fn(async () => {}),
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      seedWatchlistProducts({
        storage,
        catalog: [],
        sampleListings: {},
        freshen: (l) => l,
      }),
    ).resolves.toBeUndefined();
    expect(storage.addToWatchlist).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("continues seeding the rest after a per-product failure", async () => {
    const storage = mockStorage();
    storage.addToWatchlist.mockRejectedValueOnce(new Error("bad product"));
    const catalog = SEED_IDS.map((id) => ({ id }));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await seedWatchlistProducts({
      storage,
      catalog,
      sampleListings: {},
      freshen: (l) => l,
    });
    expect(storage.addToWatchlist).toHaveBeenCalledTimes(SEED_IDS.length);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
