import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BackOrderReminder } from "../lib/types";

const state = vi.hoisted(() => ({
  watches: [] as BackOrderReminder[],
  watchlist: [] as any[],
  settings: { stockAlerts: true },
  removed: [] as string[],
  updated: [] as { productId: string; distributorId: string; status: string }[],
  scheduled: [] as unknown[],
  permissions: true,
}));

vi.mock("../lib/storage", () => ({
  getStockWatches: vi.fn(async () => state.watches.map((w) => ({ ...w }))),
  getWatchlist: vi.fn(async () => state.watchlist),
  getSettings: vi.fn(async () => ({ ...state.settings })),
  removeStockWatch: vi.fn(async (id: string) => {
    state.removed.push(id);
    state.watches = state.watches.filter((w) => w.id !== id);
  }),
  updateStockWatchStatus: vi.fn(
    async (productId: string, distributorId: string, status: string) => {
      state.updated.push({ productId, distributorId, status });
    },
  ),
}));

vi.mock("../lib/notifications", () => ({
  scheduleStockAlert: vi.fn(async (...args: unknown[]) => {
    state.scheduled.push(args);
    return "notif-id";
  }),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { checkRestocks } from "../lib/restock";

function makeWatch(
  overrides: Partial<BackOrderReminder> = {},
): BackOrderReminder {
  return {
    id: "w1",
    productId: "p1",
    productName: "Test",
    distributorId: "d1",
    distributorName: "Dist",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    reminderType: "back_in_stock",
    lastKnownStatus: "back_order",
    ...overrides,
  };
}

describe("checkRestocks", () => {
  beforeEach(() => {
    state.watches = [];
    state.watchlist = [];
    state.removed = [];
    state.updated = [];
    state.scheduled = [];
    state.settings = { stockAlerts: true };
    state.permissions = true;
  });

  it("fires notification and removes watch when listing is in_stock", async () => {
    state.watches = [makeWatch()];
    state.watchlist = [
      {
        id: "p1",
        listings: [
          {
            distributorId: "d1",
            stockStatus: "in_stock",
            price: 100,
            currency: "USD",
          },
        ],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(1);
    expect(state.removed).toEqual(["w1"]);
  });

  it("does not fire when watch was already in_stock", async () => {
    state.watches = [makeWatch({ lastKnownStatus: "in_stock" })];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "in_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual([]);
  });

  it("updates cached status when status changes to non-in-stock", async () => {
    state.watches = [makeWatch()]; // lastKnownStatus = back_order
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "out_of_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.updated).toEqual([
      { productId: "p1", distributorId: "d1", status: "out_of_stock" },
    ]);
    expect(state.removed).toEqual([]);
  });

  it("updates cached status when in_stock drops to non-in-stock", async () => {
    state.watches = [makeWatch({ lastKnownStatus: "in_stock" })];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "out_of_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.updated).toEqual([
      { productId: "p1", distributorId: "d1", status: "out_of_stock" },
    ]);
    expect(state.removed).toEqual([]);
    expect(state.scheduled).toHaveLength(0);
  });

  it("skips watch with no matching listing", async () => {
    state.watches = [makeWatch()];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "other-dist", stockStatus: "in_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual([]);
  });

  it("respects stockAlerts toggle (no notification, but removes watch)", async () => {
    state.settings = { stockAlerts: false };
    state.watches = [makeWatch()];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "in_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual(["w1"]);
  });

  it("is a no-op with empty watches", async () => {
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    expect(state.removed).toEqual([]);
    expect(state.updated).toEqual([]);
  });

  it("keeps the watch when the notification fails to schedule", async () => {
    const { scheduleStockAlert } = await import("../lib/notifications");
    vi.mocked(scheduleStockAlert).mockResolvedValueOnce(null);
    state.watches = [makeWatch()];
    state.watchlist = [
      {
        id: "p1",
        listings: [{ distributorId: "d1", stockStatus: "in_stock" }],
      },
    ];
    await checkRestocks();
    expect(state.scheduled).toHaveLength(0);
    // Notification failed → the watch must survive so the next cycle retries.
    expect(state.removed).toEqual([]);
  });
});
