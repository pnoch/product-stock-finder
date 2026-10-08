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

  it("persists statuses (and does not notify) when nothing transitions", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d1", stockStatus: "back_order", price: 1, currency: "USD" },
    ]);
    const notify = vi.fn(async () => true);
    await checkRestocks(s, notify);
    expect(notify).not.toHaveBeenCalled();
    expect((s as any).updateStockWatchStatuses).toHaveBeenCalledWith(
      "w1",
      { d1: "back_order" },
    );
  });

  it("keeps the watch and does not persist statuses when notify fails", async () => {
    const s = storage([anyWatch], [
      { distributorId: "d2", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const notify = vi.fn(async () => false);
    await checkRestocks(s, notify);
    expect((s as any).removeStockWatch).not.toHaveBeenCalled();
    expect((s as any).updateStockWatchStatuses).not.toHaveBeenCalled();
  });

  it("threads the restocked listing's distributor id and url to the alert", async () => {
    const { scheduleStockAlert } = await import("../lib/notifications");
    vi.mocked(scheduleStockAlert).mockClear();
    const s = storage([anyWatch], [
      {
        distributorId: "d2",
        stockStatus: "in_stock",
        price: 2,
        currency: "USD",
        url: "https://d2.example/p",
      },
    ]);
    await checkRestocks(s);
    expect(scheduleStockAlert).toHaveBeenCalledWith(
      "CRS804",
      "d2",
      2,
      "USD",
      "p1",
      "d2",
      "https://d2.example/p",
    );
  });

  it("does not fire for a distributor already known in stock (seed guard)", async () => {
    const seeded = { ...anyWatch, lastKnownStatusByDistributor: { d2: "in_stock" } };
    const s = storage([seeded], [
      { distributorId: "d2", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const notify = vi.fn(async () => true);
    await checkRestocks(s, notify);
    expect(notify).not.toHaveBeenCalled();
  });

  it("treats a '*' sentinel without scope as an any-watch", async () => {
    const legacy = { ...anyWatch, scope: undefined, distributorId: "*" };
    const s = storage([legacy], [
      { distributorId: "d2", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const notify = vi.fn(async () => true);
    await checkRestocks(s, notify);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("names a single store for one hit and counts distributors for many", async () => {
    const one = storage([anyWatch], [
      { distributorId: "d2", stockStatus: "in_stock", price: 2, currency: "USD" },
    ]);
    const n1 = vi.fn(async (_title: string, _body: string) => true);
    await checkRestocks(one, n1);
    expect(n1.mock.calls[0][1]).toMatch(/in stock at /);
    expect(n1.mock.calls[0][1]).not.toMatch(/distributors:/);

    const many = storage([anyWatch], [
      { distributorId: "d2", stockStatus: "in_stock", price: 2, currency: "USD" },
      { distributorId: "d3", stockStatus: "in_stock", price: 3, currency: "USD" },
    ]);
    const n2 = vi.fn(async (_title: string, _body: string) => true);
    await checkRestocks(many, n2);
    expect(n2.mock.calls[0][1]).toMatch(/2 distributors:/);
  });
});
