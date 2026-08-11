import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product, PriceAlert } from "../lib/types";

// Hoisted mutable state so vi.mock factories can reference it safely
const state = vi.hoisted(() => ({
  alertsStore: [] as PriceAlert[],
  watchlistStore: [] as Product[],
  scheduledNotifications: [] as unknown[],
  permissionGranted: true,
}));

// Mock storage + notifications so we can drive checkPriceDropsNow deterministically
vi.mock("../lib/storage", () => ({
  getAlerts: vi.fn(async () => state.alertsStore.map((a) => ({ ...a }))),
  getWatchlist: vi.fn(async () => state.watchlistStore),
  getSettings: vi.fn(async () => ({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    priceAlerts: true,
    stockAlerts: true,
  })),
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
  }),
  updateProductListings: vi.fn(async () => {}),
  getPriceDigestSnapshot: vi.fn(async () => null),
  savePriceDigestSnapshot: vi.fn(async () => {}),
}));

vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => state.permissionGranted),
}));

vi.mock("../lib/restock", () => ({
  checkRestocks: vi.fn(async () => {}),
}));

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(async (input: unknown) => {
    state.scheduledNotifications.push(input);
    return "notif-id";
  }),
}));

vi.mock("expo-task-manager", () => ({ defineTask: vi.fn() }));
vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success", Failed: "failed" },
  registerTaskAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(() => undefined),
}));
vi.mock("../lib/scrapers/utils", () => ({
  fetchWithRateLimit: vi.fn(async () => ""),
}));

import { checkPriceDropsNow } from "../lib/background-price-check";

function makeListing(price: number, currency: string, stockStatus: string) {
  return {
    distributorId: "d1",
    productId: "p1",
    price,
    currency,
    stockStatus,
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory: [],
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

beforeEach(() => {
  state.alertsStore.length = 0;
  state.watchlistStore = [];
  state.scheduledNotifications.length = 0;
  state.permissionGranted = true;
});

describe("checkPriceDropsNow", () => {
  it("does nothing when there are no active alerts", async () => {
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("does nothing when the product has no listings", async () => {
    state.alertsStore.push(makeAlert());
    state.watchlistStore = [{ id: "p1", listings: [] } as unknown as Product];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("does nothing when the best price is above the target", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(150, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
    expect(state.alertsStore[0]!.isActive).toBe(true);
  });

  it("fires a notification and deactivates the alert when price drops below target", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(90, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(1);
    expect(state.alertsStore[0]!.isActive).toBe(false);
    expect(state.alertsStore[0]!.triggeredPrice).toBe(90);
    expect(state.alertsStore[0]!.triggeredAt).toBeTruthy();
  });

  it("converts listing price to the alert currency before comparing", async () => {
    // Alert in EUR, listing in USD. 100 USD -> 92 EUR. Target 95 EUR -> triggers.
    state.alertsStore.push(makeAlert({ targetPrice: 95, currency: "EUR" }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(100, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(1);
    expect(state.alertsStore[0]!.triggeredPrice).toBeCloseTo(92);
  });

  it("ignores out-of-stock listings when computing the best price", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [
          makeListing(50, "USD", "out_of_stock"),
          makeListing(200, "USD", "in_stock"),
        ],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    // Best in-stock is 200, above target -> no trigger
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("skips alerts that were already triggered (duplicate-fire guard)", async () => {
    state.alertsStore.push(
      makeAlert({ isActive: true, triggeredAt: "2026-01-01" }),
    );
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(50, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("does not schedule when notification permission is denied", async () => {
    state.permissionGranted = false;
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(50, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    // requestNotificationPermissions returns false; no notification scheduled
    expect(state.scheduledNotifications).toHaveLength(0);
    // Alert must stay active so it can fire once permission is granted
    expect(state.alertsStore[0]!.isActive).toBe(true);
    expect(state.alertsStore[0]!.triggeredAt).toBeUndefined();
  });
});
