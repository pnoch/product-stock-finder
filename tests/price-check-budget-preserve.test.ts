import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../lib/restock", () => ({ checkRestocks: vi.fn(async () => {}) }));
vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {}),
}));
vi.mock("../lib/storage", async (importOriginal) => {
  // Keep the real module (its exported `Storage` type uses
  // `ReturnType<typeof createStorage>`, which the transform chokes on when the
  // module is loaded directly) but stub the functions this test needs.
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getWatchlist: vi.fn(async () => []),
    updateProductListings: vi.fn(async () => {}),
    getSettings: vi.fn(async () => ({
      notificationsEnabled: false,
      priceAlerts: false,
      stockAlerts: false,
      healthAlerts: false,
      checkInterval: "manual",
      displayCurrency: "USD",
    })),
    getAlerts: vi.fn(async () => []),
    getPriceDigestSnapshot: vi.fn(async () => null),
    savePriceDigestSnapshot: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => ({})),
  };
});
vi.mock("../lib/notifications", () => ({
  scheduleHealthAlert: vi.fn(async () => null),
  scheduleHealthRecovery: vi.fn(async () => null),
  scheduleStockAlert: vi.fn(async () => null),
  channelIdFor: vi.fn(() => undefined),
  ensureNotificationPermission: vi.fn(async () => true),
  requestNotificationPermissions: vi.fn(async () => true),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
    multiRemove: vi.fn(async () => {}),
  },
}));
vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(async () => "n1"),
  getPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  setNotificationHandler: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  getLastNotificationResponseAsync: vi.fn(async () => null),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { HIGH: 4 },
  cancelScheduledNotificationAsync: vi.fn(),
}));
vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(async () => false),
}));
vi.mock("expo-background-task", () => ({
  registerTaskAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
  BackgroundTaskStatus: { Available: 2 },
  getStatusAsync: vi.fn(async () => 2),
}));
vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(async () => null),
  uploadServerHistory: vi.fn(async () => true),
}));
vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(() => null),
}));
vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(),
  fetchAndParse: vi.fn(async () => ({
    result: null,
    url: "u",
    outcome: { status: "error", method: "plain" },
  })),
  createMemoryBreakerStore: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
  createStorageBreakerStore: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

import { refreshListingsWithinBudget } from "../lib/background-tasks/price-check";
import { createHealthCollector } from "../lib/background-tasks/health-collector";
import type { Product } from "../lib/types";

function product(listings: number): Product {
  return {
    id: "p1",
    name: "P1",
    modelNumber: "M1",
    brand: "B",
    category: "C",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: Array.from({ length: listings }, (_, i) => ({
      distributorId: `d${i}`,
      productId: "p1",
      price: 100 + i,
      currency: "USD",
      stockStatus: "in_stock" as const,
      url: "",
      lastChecked: "2026-01-01T00:00:00.000Z",
      priceHistory: [],
    })),
  };
}

describe("refreshListingsWithinBudget", () => {
  it("returns every listing when the budget is already exhausted", async () => {
    const result = await refreshListingsWithinBudget(
      product(5),
      createHealthCollector(),
      () => true,
    );
    // All 5 carried through unchanged — none dropped.
    expect(result).toHaveLength(5);
    expect(result.map((l) => l.distributorId)).toEqual([
      "d0",
      "d1",
      "d2",
      "d3",
      "d4",
    ]);
  });

  it("carries the remainder through when the budget trips mid-loop", async () => {
    let calls = 0;
    const result = await refreshListingsWithinBudget(
      product(5),
      createHealthCollector(),
      () => {
        calls += 1;
        return calls > 2; // allow 2 refreshes, then exhaust
      },
    );
    expect(result).toHaveLength(5);
    expect(result.map((l) => l.distributorId)).toEqual([
      "d0",
      "d1",
      "d2",
      "d3",
      "d4",
    ]);
  });

  it("returns an empty array only when there are no listings", async () => {
    const result = await refreshListingsWithinBudget(
      { ...product(0), listings: [] },
      createHealthCollector(),
      () => false,
    );
    expect(result).toEqual([]);
  });
});
