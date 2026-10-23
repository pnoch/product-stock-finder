// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../lib/types";

const state = vi.hoisted(() => ({
  reminders: [] as unknown[],
  watches: [] as unknown[],
  settings: { displayCurrency: "USD" } as Record<string, unknown>,
  rejectSettings: false,
}));

vi.mock("../desktop/src/storage", () => ({
  storage: {
    getBackOrderReminders: vi.fn(async () => state.reminders),
    getStockWatches: vi.fn(async () => state.watches),
    getSettings: vi.fn(async () => {
      if (state.rejectSettings) throw new Error("settings unavailable");
      return state.settings;
    }),
  },
}));

import { useHomeData } from "../desktop/src/hooks/use-home-data";

function product(id: string, lastChecked: string | null, addedAt = "2026-01-01T00:00:00.000Z"): Product {
  return {
    id,
    name: id,
    modelNumber: id,
    brand: "Brand",
    category: "Router",
    description: "",
    addedAt,
    isWatched: true,
    listings:
      lastChecked === null
        ? []
        : [
            {
              distributorId: "d1",
              productId: id,
              price: 100,
              currency: "USD",
              stockStatus: "in_stock",
              url: "https://example.com",
              lastChecked,
              priceHistory: [],
            },
          ],
  };
}

describe("useHomeData", () => {
  beforeEach(() => {
    state.reminders = [];
    state.watches = [];
    state.settings = { displayCurrency: "USD" };
    state.rejectSettings = false;
  });

  it("counts reminders and stock watches", async () => {
    state.reminders = [{ id: "r1" }, { id: "r2" }];
    state.watches = [{ id: "w1" }];
    const { result } = renderHook(() =>
      useHomeData({
        products: [],
        watchlistLoading: false,
        alertsLoading: false,
        refreshWatchlist: vi.fn(),
        refreshAlerts: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.reminderCount).toBe(3));
  });

  it("reads the display currency", async () => {
    state.settings = { displayCurrency: "EUR" };
    const { result } = renderHook(() =>
      useHomeData({
        products: [],
        watchlistLoading: false,
        alertsLoading: false,
        refreshWatchlist: vi.fn(),
        refreshAlerts: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.displayCurrency).toBe("EUR"));
  });

  it("orders recent activity by latest listing check", async () => {
    const older = product("older", "2026-01-01T00:00:00.000Z");
    const newer = product("newer", "2026-02-01T00:00:00.000Z");
    const { result } = renderHook(() =>
      useHomeData({
        products: [older, newer],
        watchlistLoading: false,
        alertsLoading: false,
        refreshWatchlist: vi.fn(),
        refreshAlerts: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.recentActivity).toHaveLength(2));
    expect(result.current.recentActivity[0]!.product.id).toBe("newer");
  });

  it("includes products without listings using their added date", async () => {
    const noListings = product("no-listings", null, "2026-03-01T00:00:00.000Z");
    const withListings = product("with-listings", "2026-02-01T00:00:00.000Z");
    const { result } = renderHook(() =>
      useHomeData({
        products: [withListings, noListings],
        watchlistLoading: false,
        alertsLoading: false,
        refreshWatchlist: vi.fn(),
        refreshAlerts: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.recentActivity).toHaveLength(2));
    expect(result.current.recentActivity[0]!.product.id).toBe("no-listings");
    expect(result.current.recentActivity[0]!.listing).toBeNull();
  });

  it("surfaces a settings read failure", async () => {
    state.rejectSettings = true;
    const { result } = renderHook(() =>
      useHomeData({
        products: [],
        watchlistLoading: false,
        alertsLoading: false,
        refreshWatchlist: vi.fn(),
        refreshAlerts: vi.fn(),
      }),
    );
    await waitFor(() =>
      expect(result.current.loadError).toBe("settings unavailable"),
    );
  });

  it("refreshes watchlist and alerts together", async () => {
    const refreshWatchlist = vi.fn(async () => {});
    const refreshAlerts = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useHomeData({
        products: [],
        watchlistLoading: false,
        alertsLoading: false,
        refreshWatchlist,
        refreshAlerts,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.refreshDashboard();
    });
    expect(refreshWatchlist).toHaveBeenCalledTimes(1);
    expect(refreshAlerts).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });
});
