import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  watchlist: [] as any[],
  addToWatchlist: vi.fn(async () => true),
  enforceLimits: false,
  canAdd: true,
}));

vi.mock("@/lib/storage", () => ({
  getWatchlist: vi.fn(async () => state.watchlist),
  addToWatchlist: (product: unknown) => state.addToWatchlist(product),
}));
vi.mock("@/lib/pro-features", () => ({
  shouldEnforceFreeLimits: () => state.enforceLimits,
  canAddToWatchlist: () => state.canAdd,
}));
vi.mock("@/lib/sample-data", () => ({ SAMPLE_LISTINGS: {} }));

import { ensureWatchlistProduct } from "../lib/ensure-watchlist-product";

const product = {
  id: "p1",
  name: "Switch A",
  brand: "MikroTik",
  category: "Networking Switch",
};

beforeEach(() => {
  state.watchlist = [];
  state.addToWatchlist.mockClear();
  state.enforceLimits = false;
  state.canAdd = true;
});

describe("ensureWatchlistProduct", () => {
  it("adds a server product to the watchlist and allows navigation", async () => {
    const result = await ensureWatchlistProduct(product, false);
    expect(result).toEqual({ ok: true, paywall: false });
    expect(state.addToWatchlist).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", isWatched: true }),
    );
  });

  it("does nothing when the product is already watchlisted", async () => {
    state.watchlist = [{ id: "p1" }];
    const result = await ensureWatchlistProduct(product, false);
    expect(result).toEqual({ ok: true, paywall: false });
    expect(state.addToWatchlist).not.toHaveBeenCalled();
  });

  it("reports a paywall when the free limit blocks the add", async () => {
    state.enforceLimits = true;
    state.canAdd = false;
    const result = await ensureWatchlistProduct(product, false);
    expect(result).toEqual({ ok: false, paywall: true });
    expect(state.addToWatchlist).not.toHaveBeenCalled();
  });

  it("reports a failure when the write throws", async () => {
    state.addToWatchlist.mockRejectedValueOnce(new Error("disk full"));
    const result = await ensureWatchlistProduct(product, false);
    expect(result).toEqual({ ok: false, paywall: false });
  });
});
