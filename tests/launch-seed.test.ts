import { describe, expect, it, vi } from "vitest";
import { seedWatchlistProducts, SEED_IDS } from "../lib/launch-seed";

function mockStorage(existing: Array<{ id: string; listings?: unknown[] }> = []) {
  return {
    getWatchlist: vi.fn(async () => existing),
    addToWatchlist: vi.fn(async () => {}),
    updateProductListings: vi.fn(async () => {}),
  };
}

describe("seedWatchlistProducts", () => {
  it("seeds all ids on empty watchlist", async () => {
    const storage = mockStorage();
    const catalog = SEED_IDS.map((id) => ({ id }));
    await seedWatchlistProducts({ storage, catalog, sampleListings: {}, freshen: (l) => l });
    expect(storage.addToWatchlist).toHaveBeenCalledTimes(SEED_IDS.length);
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
    expect(storage.updateProductListings).toHaveBeenCalledWith("mikrotik-crs804-4ddq-hrm", []);
  });
});
