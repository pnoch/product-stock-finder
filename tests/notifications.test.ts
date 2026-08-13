import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/price-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/price-cache")>();
  return { ...actual };
});

vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
  sendPushForDevice: vi.fn(),
  clearPushTokensForTests: vi.fn(),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

import {
  upsertDeviceConfig,
  evaluateNotifications,
  pullPendingEvents,
  clearNotificationsForTests,
  type NotificationConfig,
} from "../server/notifications";
import { setCachedPrice } from "../server/price-cache";
import { sendPushForDevice } from "../server/push-notifications";
import { getDb } from "../server/db";
import { deviceNotificationConfigs, notificationEvents, priceCache } from "../drizzle/schema";

const mockedGetDb = vi.mocked(getDb);

const baseConfig: NotificationConfig = {
  alerts: [],
  stockWatches: [],
  dateReminders: [],
};

describe("upsertDeviceConfig", () => {
  beforeEach(() => clearNotificationsForTests());

  it("stores a config for a device", async () => {
    const config: NotificationConfig = {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    };
    await upsertDeviceConfig("dev-1", config);
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });
});

describe("evaluateNotifications", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  it("queues a price_drop event when the best price is below target", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("price_drop");
    expect(events[0]!.alertId).toBe("a1");
    expect(events[0]!.triggeredPrice).toBe(480);
  });

  it("pushes newly created events to the device's channel", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    expect(vi.mocked(sendPushForDevice)).toHaveBeenCalledWith(
      "dev-1",
      expect.arrayContaining([expect.objectContaining({ type: "price_drop" })]),
    );
  });

  it("pushes newly created events on the database path", async () => {
    const inserted: unknown[] = [];
    const storedSnapshots: Array<Record<string, unknown>> = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return [
              {
                deviceId: "dev-1",
                alerts: [
                  {
                    id: "a1",
                    productId: "mikrotik-crs804-4ddq-hrm",
                    targetPrice: 500,
                    currency: "USD",
                  },
                ],
                stockWatches: [],
                dateReminders: [],
                updatedAt: Date.now(),
              },
            ];
          }
          if (table === priceCache) {
            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => storedSnapshots),
              })),
            };
          }
          return { where: vi.fn(() => []) };
        }),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((rows: unknown) => {
          if (table === priceCache) {
            storedSnapshots.push(rows as Record<string, unknown>);
          } else {
            inserted.push(rows);
          }
          return { onDuplicateKeyUpdate: vi.fn(async () => undefined) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await evaluateNotifications(Date.now());
    expect(inserted).toHaveLength(1);
    expect(vi.mocked(sendPushForDevice)).toHaveBeenCalledWith(
      "dev-1",
      expect.arrayContaining([expect.objectContaining({ type: "price_drop" })]),
    );
    mockedGetDb.mockResolvedValue(null);
  });

  it("does not queue a price_drop event when the price is above target", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 600,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });

  it("queues a restock event when the distributor is in stock", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 520,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      stockWatches: [
        { id: "w1", productId: "mikrotik-crs804-4ddq-hrm", distributorId: "server2u-my" },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("restock");
    expect(events[0]!.watchId).toBe("w1");
  });

  it("does not queue a restock event when the watch was already in stock", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 520,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      stockWatches: [
        {
          id: "w1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "server2u-my",
          lastKnownStatus: "in_stock",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });

  it("queues a reminder event when the date has passed", async () => {
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      dateReminders: [
        {
          id: "r1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "server2u-my",
          reminderDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("reminder");
    expect(events[0]!.reminderId).toBe("r1");
  });

  it("does not re-queue an undelivered event with the same dedup key", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
  });

  it("does not queue a price_drop for an unknown product", async () => {
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        { id: "a1", productId: "unknown-product", targetPrice: 100, currency: "USD" },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });
});

describe("pullPendingEvents", () => {
  beforeEach(() => clearNotificationsForTests());

  it("marks events as delivered after pulling", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const first = await pullPendingEvents("dev-1");
    expect(first).toHaveLength(1);
    const second = await pullPendingEvents("dev-1");
    expect(second).toEqual([]);
  });

  it("returns only events for the requested device", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await upsertDeviceConfig("dev-2", {
      ...baseConfig,
      alerts: [
        {
          id: "a2",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const dev1 = await pullPendingEvents("dev-1");
    const dev2 = await pullPendingEvents("dev-2");
    expect(dev1).toHaveLength(1);
    expect(dev2).toHaveLength(1);
    expect(dev1[0]!.alertId).toBe("a1");
    expect(dev2[0]!.alertId).toBe("a2");
  });
});