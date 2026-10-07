import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../lib/storage", () => ({
  getStockWatches: vi.fn(async () => []),
  getWatchlist: vi.fn(async () => []),
  getSettings: vi.fn(async () => ({})),
  removeStockWatch: vi.fn(async () => {}),
  updateStockWatchStatus: vi.fn(async () => {}),
  updateStockWatchStatuses: vi.fn(async () => {}),
  recordNotificationEvent: vi.fn(async () => {}),
}));
vi.mock("../lib/notifications", () => ({
  ensureNotificationPermission: vi.fn(async () => true),
  scheduleStockAlert: vi.fn(async () => "notif-id"),
}));

import { checkRestocks } from "../lib/restock";

function storage(watches: unknown[], listings: unknown[]) {
  return {
    getStockWatches: vi.fn(async () => watches),
    getWatchlist: vi.fn(async () => [{ id: "p1", name: "CRS804", listings }]),
    getSettings: vi.fn(async () => ({ notificationsEnabled: true, stockAlerts: true })),
    removeStockWatch: vi.fn(async () => {}),
    updateStockWatchStatus: vi.fn(async () => {}),
    updateStockWatchStatuses: vi.fn(async () => {}),
    recordNotificationEvent: vi.fn(async () => {}),
  } as never;
}

const anyWatch = {
  id: "w1", productId: "p1", productName: "CRS804", distributorId: "*",
  distributorName: "Any distributor", reminderDate: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z", reminderType: "back_in_stock", scope: "any",
  lastKnownStatusByDistributor: { d1: "back_order" },
};

describe("checkRestocks — any scope", () => {
  it("fires when a different distributor goes in stock", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d1", stockStatus: "back_order", price: 1, currency: "USD" },
      { distributorId: "d2", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const notify = vi.fn(async (_title: string, _body: string) => true);
    await checkRestocks(s, notify);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][1]).toContain("d2");
  });

  it("fires on a NEW distributor id (new source)", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d9", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const notify = vi.fn(async (_title: string, _body: string) => true);
    await checkRestocks(s, notify);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("does not fire when nothing transitions", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d1", stockStatus: "back_order", price: 1, currency: "USD" },
    ]);
    const notify = vi.fn(async (_title: string, _body: string) => true);
    await checkRestocks(s, notify);
    expect(notify).not.toHaveBeenCalled();
  });
});
