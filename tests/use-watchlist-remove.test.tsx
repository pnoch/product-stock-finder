// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackOrderReminder, PriceAlert, Product } from "../lib/types";

const state = vi.hoisted(() => ({
  confirm: true,
  alerts: [] as PriceAlert[],
  reminders: [] as BackOrderReminder[],
  watches: [] as BackOrderReminder[],
  removed: [] as string[],
  restored: [] as string[],
  restoredAlerts: [] as PriceAlert[],
  restoredReminders: [] as BackOrderReminder[],
  restoredWatches: [] as BackOrderReminder[],
}));

vi.mock("../desktop/src/storage", () => ({
  storage: {
    getAlerts: vi.fn(async () => state.alerts),
    getBackOrderReminders: vi.fn(async () => state.reminders),
    getStockWatches: vi.fn(async () => state.watches),
    removeFromWatchlist: vi.fn(async (id: string) => {
      state.removed.push(id);
    }),
    addToWatchlist: vi.fn(async (product: Product) => {
      state.restored.push(product.id);
      return true;
    }),
    addAlert: vi.fn(async (alert: PriceAlert) => {
      state.restoredAlerts.push(alert);
      return true;
    }),
    addBackOrderReminder: vi.fn(async (reminder: BackOrderReminder) => {
      state.restoredReminders.push(reminder);
    }),
    addStockWatch: vi.fn(async (watch: BackOrderReminder) => {
      state.restoredWatches.push(watch);
    }),
  },
}));

vi.mock("../desktop/src/lib/confirm", () => ({
  confirmAction: vi.fn(async () => state.confirm),
}));

import { useWatchlistRemove } from "../desktop/src/hooks/use-watchlist-remove";

const product: Product = {
  id: "p1",
  name: "Test",
  modelNumber: "T-1",
  brand: "Brand",
  category: "Router",
  description: "",
  addedAt: "2026-01-01T00:00:00.000Z",
  isWatched: true,
  listings: [],
};

const alert: PriceAlert = {
  id: "a1",
  productId: "p1",
  targetPrice: 100,
  currency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z",
  isActive: true,
};

const reminder: BackOrderReminder = {
  id: "r1",
  productId: "p1",
  productName: "Test",
  distributorId: "d1",
  distributorName: "Dist",
  reminderDate: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const watch: BackOrderReminder = {
  ...reminder,
  id: "w1",
  reminderType: "back_in_stock",
};

describe("useWatchlistRemove", () => {
  beforeEach(() => {
    state.confirm = true;
    state.alerts = [alert];
    state.reminders = [reminder];
    state.watches = [watch];
    state.removed = [];
    state.restored = [];
    state.restoredAlerts = [];
    state.restoredReminders = [];
    state.restoredWatches = [];
  });

  function setup(selectedIds = new Set<string>()) {
    const refresh = vi.fn(async () => {});
    const showToast = vi.fn();
    const exitSelection = vi.fn();
    const hook = renderHook(() =>
      useWatchlistRemove({
        products: [product],
        selectedIds,
        exitSelection,
        refresh,
        showToast,
      }),
    );
    return { ...hook, refresh, showToast, exitSelection };
  }

  it("does not remove when the confirm is dismissed", async () => {
    state.confirm = false;
    const { result } = setup();
    await act(async () => {
      await result.current.handleRemove(
        { stopPropagation: vi.fn() } as never,
        "p1",
      );
    });
    expect(state.removed).toHaveLength(0);
    expect(result.current.undoProduct).toBeNull();
  });

  it("removes and offers undo", async () => {
    const { result, refresh } = setup();
    await act(async () => {
      await result.current.handleRemove(
        { stopPropagation: vi.fn() } as never,
        "p1",
      );
    });
    expect(state.removed).toEqual(["p1"]);
    expect(result.current.undoProduct?.id).toBe("p1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("restores the product and its cascade on undo", async () => {
    const { result, refresh, showToast } = setup();
    await act(async () => {
      await result.current.handleRemove(
        { stopPropagation: vi.fn() } as never,
        "p1",
      );
    });
    await act(async () => {
      await result.current.handleUndo();
    });
    expect(state.restored).toEqual(["p1"]);
    expect(state.restoredAlerts).toHaveLength(1);
    expect(state.restoredReminders).toHaveLength(1);
    expect(state.restoredWatches).toHaveLength(1);
    expect(result.current.undoProduct).toBeNull();
    expect(showToast).toHaveBeenCalledWith("Restored Test");
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("bulk deletes the selected products", async () => {
    const { result, exitSelection } = setup(new Set(["p1"]));
    await act(async () => {
      await result.current.handleBulkDelete();
    });
    expect(state.removed).toEqual(["p1"]);
    expect(exitSelection).toHaveBeenCalledTimes(1);
  });
});
