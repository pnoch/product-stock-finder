import { describe, expect, it, vi, beforeEach } from "vitest";
import { createStorage } from "../../lib/storage";

const store = new Map<string, string>();
const localStorageAdapter = {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => store.set(key, value),
  removeItem: async (key: string) => store.delete(key),
  multiRemove: async (keys: string[]) => keys.forEach((k) => store.delete(k)),
};

const storage = createStorage(localStorageAdapter);

const state = vi.hoisted(() => ({
  uploaded: [] as unknown[],
  pulled: [] as unknown[],
  notifications: [] as unknown[],
}));

vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      uploadConfig: {
        mutate: vi.fn(async (input: unknown) => {
          state.uploaded.push(input);
          return { accepted: true };
        }),
      },
      pull: {
        query: vi.fn(async () => ({ events: state.pulled })),
      },
    },
  })),
}));

vi.mock("../src/notifications", () => ({
  sendDesktopNotification: vi.fn(async (title: string, body: string, route?: string) => {
    state.notifications.push({ title, body, route });
  }),
}));

import { syncDesktopNotifications } from "../src/server-notifications";
import { sendDesktopNotification } from "../src/notifications";

describe("syncDesktopNotifications", () => {
  beforeEach(async () => {
    globalThis.localStorage = localStorageAdapter as never;
    store.clear();
    state.uploaded.length = 0;
    state.pulled.length = 0;
    state.notifications.length = 0;
  });

  it("uploads the active config and shows pulled events", async () => {
    await storage.addAlert({
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    state.pulled = [
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        createdAt: 123,
      },
    ];
    await syncDesktopNotifications();
    expect(state.uploaded).toHaveLength(1);
    const input = state.uploaded[0] as Record<string, unknown>;
    expect(input.deviceId).toBeUndefined();
    const alerts = input.alerts as Array<{ id: string }>;
    expect(alerts.map((a) => a.id)).toContain("a1");
    expect(state.notifications).toEqual([
      {
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        route: "/product/mikrotik-crs804-4ddq-hrm",
      },
    ]);
  });

  it("routes restock and reminder events to their watched product", async () => {
    await storage.addStockWatch({
      id: "w1",
      productId: "mikrotik-crs804-4ddq-hrm",
      productName: "CRS804",
      distributorId: "d1",
      distributorName: "D1",
      reminderDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "back_in_stock",
    });
    await storage.addBackOrderReminder({
      id: "r1",
      productId: "mikrotik-crs804-4ddq-hrm",
      productName: "CRS804",
      distributorId: "d1",
      distributorName: "D1",
      reminderDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "date",
    });
    state.pulled = [
      {
        id: "e1",
        type: "restock",
        title: "Back in stock!",
        body: "CRS804 is back!",
        watchId: "w1",
        createdAt: 123,
      },
      {
        id: "e2",
        type: "reminder",
        title: "Reminder",
        body: "Check CRS804",
        reminderId: "r1",
        createdAt: 124,
      },
    ];
    await syncDesktopNotifications();
    expect(state.notifications).toEqual([
      {
        title: "Back in stock!",
        body: "CRS804 is back!",
        route: "/product/mikrotik-crs804-4ddq-hrm",
      },
      {
        title: "Reminder",
        body: "Check CRS804",
        route: "/product/mikrotik-crs804-4ddq-hrm",
      },
    ]);
  });

  it("reconciles a pulled price_drop by deactivating the alert", async () => {
    await storage.addAlert({
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    state.pulled = [
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        triggeredPrice: 480,
        createdAt: 123,
      },
    ];
    await syncDesktopNotifications();
    const alerts = await storage.getAlerts();
    expect(alerts[0]!.isActive).toBe(false);
    expect(alerts[0]!.triggeredPrice).toBe(480);
  });

  it("skips stale price_drop notifications for already-inactive alerts", async () => {
    await storage.addAlert({
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
      isActive: false,
      createdAt: new Date().toISOString(),
    });
    state.pulled = [
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        triggeredPrice: 480,
        createdAt: 123,
      },
    ];
    await syncDesktopNotifications();
    expect(state.notifications).toEqual([]);
    const alerts = await storage.getAlerts();
    expect(alerts[0]!.triggeredPrice).toBe(480);
  });

  it("continues processing remaining events when one render fails", async () => {
    vi.mocked(sendDesktopNotification).mockRejectedValueOnce(new Error("boom"));
    await storage.addAlert({
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await storage.addAlert({
      id: "a2",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 450,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    state.pulled = [
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        triggeredPrice: 480,
        createdAt: 123,
      },
      {
        id: "e2",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $450.00!",
        alertId: "a2",
        productId: "mikrotik-crs804-4ddq-hrm",
        triggeredPrice: 450,
        createdAt: 124,
      },
    ];
    await syncDesktopNotifications();
    expect(state.notifications).toEqual([
      {
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $450.00!",
        route: "/product/mikrotik-crs804-4ddq-hrm",
      },
    ]);
    const alerts = await storage.getAlerts();
    expect(alerts.find((a) => a.id === "a2")!.isActive).toBe(false);
  });

  it("persists a stable device id in localStorage", async () => {
    const { getDesktopDeviceId } = await import("../src/lib/device-id");
    const first = await getDesktopDeviceId();
    const second = await getDesktopDeviceId();
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });
});
