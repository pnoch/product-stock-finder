import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CriterionWatch, Product } from "../lib/types";

const state = vi.hoisted(() => ({
  alertsStore: [] as unknown[],
  watchlistStore: [] as Product[],
  scheduledNotifications: [] as unknown[],
  criterionWatches: [] as CriterionWatch[],
  available: [] as Record<string, unknown>[],
  criterionNotifications: [] as Record<string, unknown>[],
  permissionGranted: true,
  settingsStore: {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    priceAlerts: true,
    stockAlerts: true,
    healthAlerts: true,
    basketAlertThreshold: null as number | null,
  },
  recordedNotifications: [] as Record<string, unknown>[],
  uploadedHealthEvents: [] as Record<string, unknown>[],
}));

vi.mock("../lib/storage", () => ({
  getAlerts: vi.fn(async () => state.alertsStore),
  getWatchlist: vi.fn(async () => state.watchlistStore),
  getSettings: vi.fn(async () => state.settingsStore),
  saveAlerts: vi.fn(async () => {}),
  deactivateAlert: vi.fn(async () => true),
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
  getBackgroundTaskInterval: vi.fn(async () => null),
  saveBackgroundTaskInterval: vi.fn(async () => {}),
  setLastBackgroundRun: vi.fn(async () => {}),
  getCriterionWatches: vi.fn(async () => state.criterionWatches),
  updateCriterionWatches: vi.fn(
    async (fn: (w: CriterionWatch[]) => CriterionWatch[] | Promise<CriterionWatch[]>) => {
      state.criterionWatches = await fn(state.criterionWatches);
    },
  ),
}));

vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => state.permissionGranted),
  ensureNotificationPermission: vi.fn(async () => state.permissionGranted),
  scheduleHealthAlert: vi.fn(async () => "notif-id"),
  scheduleHealthRecovery: vi.fn(async () => "notif-id"),
  scheduleStockAlert: vi.fn(
    async (
      productName: string,
      distributorName: string,
      price: number,
      currency: string,
      productId?: string,
    ) => {
      state.criterionNotifications.push({
        productName,
        distributorName,
        price,
        currency,
        productId,
        body: `${productName} is now available at ${distributorName} for ${currency} ${price.toFixed(2)}`,
      });
      return "notif-id";
    },
  ),
  channelIdFor: vi.fn(() => undefined),
  immediateTrigger: vi.fn(() => null),
}));

vi.mock("../lib/restock", () => ({
  checkRestocks: vi.fn(async () => {}),
}));

vi.mock("../lib/server-catalog", () => ({
  fetchAvailable: vi.fn(async () => state.available),
}));

vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {}),
  uploadHealthEventToServer: vi.fn(async (event: Record<string, unknown>) => {
    state.uploadedHealthEvents.push(event);
  }),
}));

vi.mock("@/constants/oauth", () => ({
  isServerConfigured: vi.fn(() => true),
}));

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(async (input: unknown) => {
    state.scheduledNotifications.push(input);
    return "notif-id";
  }),
}));

vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(async () => false),
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

beforeEach(() => {
  state.alertsStore.length = 0;
  // getWatchlist must be non-empty or runPriceCheckCoreInner returns before the
  // criterion evaluation. Empty listings keeps it from scraping.
  state.watchlistStore = [{ id: "p1", name: "Filler", listings: [] } as unknown as Product];
  state.scheduledNotifications.length = 0;
  state.criterionNotifications.length = 0;
  state.criterionWatches = [
    {
      id: "w1",
      category: "Switch",
      maxPrice: 300,
      currency: "USD",
      seenProductIds: [],
      createdAt: "",
      isActive: true,
    },
  ];
  state.available = [
    {
      id: "b",
      name: "Switch B",
      brand: "X",
      category: "Switch",
      modelNumber: "B",
      bestPrice: 200,
      bestCurrency: "USD",
      bestDistributorId: "d1",
      storeCount: 2,
      fetchedAt: 1,
    },
  ];
});

describe("criterion watches in the price check", () => {
  it("notifies about a new matching product and marks it seen", async () => {
    await checkPriceDropsNow();

    expect(state.criterionNotifications).toHaveLength(1);
    expect(String(state.criterionNotifications[0]!.body)).toContain("Switch B");
    expect(state.criterionWatches[0]!.seenProductIds).toEqual(["b"]);
  });

  it("does not notify again for a product already seen", async () => {
    await checkPriceDropsNow();
    await checkPriceDropsNow();

    expect(state.criterionNotifications).toHaveLength(1);
    expect(state.criterionWatches[0]!.seenProductIds).toEqual(["b"]);
  });
});
