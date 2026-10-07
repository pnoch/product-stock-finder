import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PriceAlert, PricePoint, Product } from "../lib/types";

// Hoisted mutable state so vi.mock factories can reference it safely
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
  setLastBackgroundRun: vi.fn(async () => {}),
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
  rearmAlert: vi.fn(async () => {}),
  getBackgroundTaskInterval: vi.fn(async (task: string) => state.taskIntervals[task] ?? null),
  saveBackgroundTaskInterval: vi.fn(async (minutes: number | null, task: string) => {
    if (minutes === null) delete state.taskIntervals[task];
    else state.taskIntervals[task] = minutes;
  }),
}));

vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => state.permissionGranted),
  ensureNotificationPermission: vi.fn(async () => state.permissionGranted),
  scheduleHealthAlert: vi.fn(async () => "notif-id"),
  scheduleHealthRecovery: vi.fn(async () => "notif-id"),
  channelIdFor: vi.fn(() => undefined),
  immediateTrigger: vi.fn(() => null),
}));

vi.mock("../lib/restock", () => ({
  checkRestocks: vi.fn(async () => {}),
}));

vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {}),
  uploadHealthEventToServer: vi.fn(async (event: Record<string, unknown>) => {
    state.uploadedHealthEvents.push(event);
  }),
}));

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(async (input: unknown) => {
    state.scheduledNotifications.push(input);
    return "notif-id";
  }),
}));

vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(async () => state.taskRegistered),
}));
vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success", Failed: "failed" },
  registerTaskAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

vi.mock("@/lib/entitlements", () => ({
  getEntitlementState: vi.fn(async () => ({ tier: "pro", isPro: true })),
  getEntitlementProvider: vi.fn(() => null),
}));

const webPush = vi.hoisted(() => ({ display: true }));
vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn(() => webPush.display),
}));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(() => undefined),
}));
vi.mock("../lib/scrapers/utils", () => ({
  fetchWithRateLimit: vi.fn(async () => ""),
}));
vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(async () => null),
  uploadServerHistory: vi.fn(async () => {}),
}));

import { checkPriceDropsNow } from "../lib/background-price-check";
import { deactivateAlert, recordNotificationEvent } from "../lib/storage";

function makePoint(price: number, daysAgo: number): PricePoint {
  return {
    date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    price,
    currency: "USD",
    stockStatus: "in_stock",
  };
}

function makeListing(
  price: number,
  currency: string,
  stockStatus: string,
  priceHistory: PricePoint[] = [],
) {
  return {
    distributorId: "d1",
    productId: "p1",
    price,
    currency,
    stockStatus,
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory,
  };
}

function makeAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
  return {
    id: "a1",
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Several in-stock points hovering around 100 in the alert currency — the
// product's usual price band.
const normalHistory = [
  makePoint(100, 3),
  makePoint(102, 2),
  makePoint(99, 1),
];

beforeEach(async () => {
  state.alertsStore.length = 0;
  state.watchlistStore = [];
  state.scheduledNotifications.length = 0;
  state.recordedNotifications.length = 0;
  state.permissionGranted = true;
  webPush.display = true;
  vi.mocked(deactivateAlert).mockClear();
  vi.mocked(recordNotificationEvent).mockClear();
  const { Platform } = await import("react-native");
  Platform.OS = "ios";
});

describe("checkPriceDropsNow price-anomaly guard", () => {
  it("suppresses a misparsed price and keeps the alert armed", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 50 }));
    state.watchlistStore = [
      {
        id: "p1",
        name: "Test Product",
        listings: [makeListing(3, "USD", "in_stock", normalHistory)],
      } as unknown as Product,
    ];

    await checkPriceDropsNow();

    expect(deactivateAlert).not.toHaveBeenCalled();
    expect(state.scheduledNotifications).toHaveLength(0);
    expect(state.alertsStore[0]!.isActive).toBe(true);

    const suspicious = state.recordedNotifications.filter(
      (e) => e.type === "suspicious_price",
    );
    expect(suspicious).toHaveLength(1);
    expect(suspicious[0]).toMatchObject({
      type: "suspicious_price",
      alertId: "a1",
      productId: "p1",
      triggeredPrice: 3,
      currency: "USD",
    });
  });

  it("still fires a real drop within the product's usual band", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 50 }));
    state.watchlistStore = [
      {
        id: "p1",
        name: "Test Product",
        listings: [makeListing(40, "USD", "in_stock", normalHistory)],
      } as unknown as Product,
    ];

    await checkPriceDropsNow();

    expect(deactivateAlert).toHaveBeenCalledTimes(1);
    expect(state.scheduledNotifications).toHaveLength(1);
    expect(state.alertsStore[0]!.isActive).toBe(false);
  });

  it("does not record a suppression for an outlier that never crossed target", async () => {
    // Target 1: the $3 misparse is above target, so it never crosses and must
    // not be recorded as a suppressed alert (the guard runs only after the
    // target check).
    state.alertsStore.push(makeAlert({ targetPrice: 1 }));
    state.watchlistStore = [
      {
        id: "p1",
        name: "Test Product",
        listings: [makeListing(3, "USD", "in_stock", normalHistory)],
      } as unknown as Product,
    ];

    await checkPriceDropsNow();

    expect(deactivateAlert).not.toHaveBeenCalled();
    expect(
      state.recordedNotifications.filter((e) => e.type === "suspicious_price"),
    ).toHaveLength(0);
  });
});
