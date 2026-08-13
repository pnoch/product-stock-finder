import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  deviceId: "dev-1",
  alerts: [] as Array<Record<string, unknown>>,
  stockWatches: [] as Array<Record<string, unknown>>,
  dateReminders: [] as Array<Record<string, unknown>>,
  pulledEvents: [] as Array<Record<string, unknown>>,
  displayed: [] as string[],
  recorded: [] as string[],
  rendered: [] as Array<Record<string, unknown>>,
  deactivated: [] as Array<Record<string, unknown>>,
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      uploadConfig: { mutate: vi.fn(async () => ({ accepted: true })) },
      pull: { query: vi.fn(async () => ({ events: state.pulledEvents })) },
    },
  })),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => state.deviceId),
}));

vi.mock("../lib/storage", () => ({
  getAlerts: vi.fn(async () => state.alerts),
  getStockWatches: vi.fn(async () => state.stockWatches),
  getBackOrderReminders: vi.fn(async () => state.dateReminders),
  getDisplayedEventIds: vi.fn(async () => state.displayed),
  recordDisplayedEventId: vi.fn(async (id: string) => {
    state.recorded.push(id);
  }),
  deactivateAlert: vi.fn(async (alertId: string, price: number) => {
    state.deactivated.push({ alertId, price });
  }),
  removeStockWatch: vi.fn(async () => {}),
  removeBackOrderReminder: vi.fn(async () => {}),
}));

vi.mock("../lib/notifications", () => ({
  scheduleServerEventNotification: vi.fn(async (title: string, body: string) => {
    state.rendered.push({ title, body });
  }),
}));

import { syncServerNotifications } from "../lib/server-notifications";

const priceDropEvent = {
  id: "evt-1",
  type: "price_drop",
  alertId: "a1",
  triggeredPrice: 480,
  title: "Price dropped",
  body: "CRS804 below $500",
  createdAt: 1,
};

const activeAlert = {
  id: "a1",
  productId: "p1",
  targetPrice: 500,
  currency: "USD",
  isActive: true,
  createdAt: "2026-01-01",
};

beforeEach(() => {
  state.alerts = [activeAlert];
  state.stockWatches = [];
  state.dateReminders = [];
  state.pulledEvents = [];
  state.displayed = [];
  state.recorded = [];
  state.rendered = [];
  state.deactivated = [];
});

describe("syncServerNotifications dedup", () => {
  it("renders and records a new event", async () => {
    state.pulledEvents = [priceDropEvent];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(1);
    expect(state.recorded).toEqual(["evt-1"]);
    expect(state.deactivated).toEqual([{ alertId: "a1", price: 480 }]);
  });

  it("skips rendering an already-displayed event but still reconciles", async () => {
    state.displayed = ["evt-1"];
    state.pulledEvents = [priceDropEvent];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(0);
    expect(state.recorded).toEqual([]);
    expect(state.deactivated).toEqual([{ alertId: "a1", price: 480 }]);
  });
});
