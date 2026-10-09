import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product, PriceAlert } from "../lib/types";

const state = vi.hoisted(() => ({
  alertsStore: [] as PriceAlert[],
  watchlistStore: [] as Product[],
  scheduledNotifications: [] as unknown[],
  permissionGranted: true,
  taskRegistered: false,
  taskIntervals: {} as Record<string, number>,
  settingsStore: {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    priceAlerts: true,
    stockAlerts: true,
    healthAlerts: true,
    basketAlertThreshold: null as number | null,
    quietHours: undefined as
      | { start: string; end: string; utcOffsetMinutes?: number }
      | undefined,
  },
  recordedNotifications: [] as Record<string, unknown>[],
  uploadedHealthEvents: [] as Record<string, unknown>[],
}));

vi.mock("../lib/storage", () => ({
  getAlerts: vi.fn(async () => state.alertsStore.map((a) => ({ ...a }))),
  getWatchlist: vi.fn(async () => state.watchlistStore),
  getSettings: vi.fn(async () => state.settingsStore),
  saveAlerts: vi.fn(async (alerts: PriceAlert[]) => {
    state.alertsStore.length = 0;
    state.alertsStore.push(...alerts.map((a) => ({ ...a })));
  }),
  deactivateAlert: vi.fn(async (alertId: string, triggeredPrice: number) => {
    state.alertsStore = state.alertsStore.map((a) =>
      a.id === alertId
        ? {
            ...a,
            isActive: false,
            triggeredAt: new Date().toISOString(),
            triggeredPrice,
          }
        : a,
    );
    return true;
  }),
  updateProductListings: vi.fn(async () => {}),
  recordNotificationEvent: vi.fn(async (e: Record<string, unknown>) => {
    state.recordedNotifications.push(e);
  }),
  getPriceDigestSnapshot: vi.fn(async () => null),
  savePriceDigestSnapshot: vi.fn(async () => {}),
  updateSettings: vi.fn(async (patch: Record<string, unknown>) => {
    state.settingsStore = { ...state.settingsStore, ...patch };
    return state.settingsStore;
  }),
  setLastBackgroundRun: vi.fn(async () => {}),
  getLastBackgroundRun: vi.fn(async () => null),
  getCriterionWatches: vi.fn(async () => []),
  updateCriterionWatches: vi.fn(async () => {}),
  getStockWatches: vi.fn(async () => []),
  updateStockWatchStatuses: vi.fn(async () => {}),
}));

vi.mock("../lib/notifications", () => ({
  ensureNotificationPermission: vi.fn(async () => state.permissionGranted),
  schedulePriceAlert: vi.fn(async (input: unknown) => {
    state.scheduledNotifications.push(input);
    return "notif-id";
  }),
  scheduleStockAlert: vi.fn(async () => "notif-id"),
  scheduleHealthAlert: vi.fn(async () => "notif-id"),
  scheduleHealthRecovery: vi.fn(async () => "notif-id"),
  channelIdFor: vi.fn(() => undefined),
  immediateTrigger: vi.fn(() => null),
}));

vi.mock("../lib/restock", () => ({ checkRestocks: vi.fn(async () => {}) }));
vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {}),
}));
vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn(() => true),
}));
vi.mock("../lib/health", () => ({
  createHealthService: vi.fn(() => ({ getHealthHistory: vi.fn(async () => ({})) })),
}));
vi.mock("../lib/scrapers/registry", () => ({ getAllParsers: vi.fn(() => []) }));
vi.mock("../lib/scrapers/utils", () => ({ getTaxRate: vi.fn(() => 0) }));
vi.mock("../lib/server-prices", () => ({ fetchServerPrice: vi.fn(async () => null) }));
vi.mock("../lib/entitlements", () => ({
  getEntitlementState: vi.fn(async () => ({ tier: "pro", isPro: true })),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(async () => "id"),
  cancelScheduledNotificationAsync: vi.fn(async () => {}),
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: vi.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));
vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(async () => false),
  unregisterTaskAsync: vi.fn(async () => {}),
}));
vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  registerTaskAsync: vi.fn(async () => {}),
  unregisterTaskAsync: vi.fn(async () => {}),
}));

import { checkPriceDropsNow } from "../lib/background-tasks/price-check";
import { deactivateAlert } from "../lib/storage";

function makeListing(price: number) {
  return {
    distributorId: "d1",
    productId: "p1",
    price,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory: [],
  };
}

beforeEach(() => {
  state.alertsStore.length = 0;
  state.watchlistStore = [];
  state.scheduledNotifications.length = 0;
  state.permissionGranted = true;
  vi.mocked(deactivateAlert).mockClear();
});

describe("acquired products and price alerts", () => {
  it("does not fire an alert for an acquired product and leaves it armed", async () => {
    state.alertsStore.push({
      id: "a1",
      productId: "p1",
      targetPrice: 100,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    state.watchlistStore = [
      {
        id: "p1",
        acquiredAt: "2026-02-01T00:00:00.000Z",
        listings: [makeListing(50)], // would trigger (50 <= 100)
      } as unknown as Product,
    ];

    await checkPriceDropsNow();

    expect(state.scheduledNotifications).toHaveLength(0);
    expect(deactivateAlert).not.toHaveBeenCalled();
    expect(state.alertsStore[0]!.isActive).toBe(true);
  });
});
