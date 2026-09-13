import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/price-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/price-cache")>();
  return { ...actual };
});

vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
  sendPushForDevice: vi.fn(),
  sendPushForUser: vi.fn(),
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
import {
  sendPushForDevice,
  sendPushForUser,
} from "../server/push-notifications";
import { getDb } from "../server/db";
import {
  deviceNotificationConfigs,
  notificationEvents,
  notificationEventDeliveries,
  priceCache,
} from "../drizzle/schema";

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
            const rows = [
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
            return {
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(async () => rows),
                })),
              })),
            };
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
        {
          id: "w1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "server2u-my",
        },
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
          reminderDate: new Date(
            Date.now() - 24 * 60 * 60 * 1000,
          ).toISOString(),
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
        {
          id: "a1",
          productId: "unknown-product",
          targetPrice: 100,
          currency: "USD",
        },
      ],
    });
    await evaluateNotifications(Date.now());
    const events = await pullPendingEvents("dev-1");
    expect(events).toEqual([]);
  });

  it("does not re-create an event after it was fully delivered", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
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
    await evaluateNotifications(now);
    const first = await pullPendingEvents("dev-1");
    expect(first).toHaveLength(1);

    vi.mocked(sendPushForDevice).mockClear();
    // Next warmer tick, 5 minutes later — condition persists but was delivered
    await evaluateNotifications(now + 5 * 60_000);
    expect(sendPushForDevice).not.toHaveBeenCalled();
    const second = await pullPendingEvents("dev-1");
    expect(second).toEqual([]);
  });

  it("allows a new event for the same condition once the cooldown expires", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
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
    await evaluateNotifications(now);
    expect(await pullPendingEvents("dev-1")).toHaveLength(1);

    // 25 hours later the same persisting condition may notify again
    await evaluateNotifications(now + 25 * 60 * 60_000);
    expect(vi.mocked(sendPushForDevice)).toHaveBeenCalledTimes(2);
    expect(await pullPendingEvents("dev-1")).toHaveLength(1);
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

describe("user-scoped notifications (memory)", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  it("dedupes an alert shared across a user's devices into one event", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    const alert = {
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
    };
    await upsertDeviceConfig("dev-1", { ...baseConfig, alerts: [alert] }, 7);
    await upsertDeviceConfig("dev-2", { ...baseConfig, alerts: [alert] }, 7);
    await evaluateNotifications(Date.now());
    const dev1 = await pullPendingEvents("dev-1", 7);
    const dev2 = await pullPendingEvents("dev-2", 7);
    expect(dev1).toHaveLength(1);
    expect(dev2).toHaveLength(1);
    expect(dev1[0]!.id).toBe(dev2[0]!.id);
    expect(vi.mocked(sendPushForUser)).toHaveBeenCalledWith(
      7,
      expect.arrayContaining([expect.objectContaining({ type: "price_drop" })]),
    );
  });

  it("catches up a device that binds after the event fired", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a1",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      7,
    );
    await evaluateNotifications(Date.now());
    await upsertDeviceConfig("dev-2", { ...baseConfig }, 7);
    const dev1 = await pullPendingEvents("dev-1", 7);
    expect(dev1).toHaveLength(1);
    const dev2 = await pullPendingEvents("dev-2", 7);
    expect(dev2).toHaveLength(1);
    expect(dev2[0]!.id).toBe(dev1[0]!.id);
  });

  it("marks delivery per device, not per user", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a1",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      7,
    );
    await upsertDeviceConfig("dev-2", { ...baseConfig }, 7);
    await evaluateNotifications(Date.now());
    const dev1First = await pullPendingEvents("dev-1", 7);
    expect(dev1First).toHaveLength(1);
    const dev2First = await pullPendingEvents("dev-2", 7);
    expect(dev2First).toHaveLength(1);
    const dev1Second = await pullPendingEvents("dev-1", 7);
    expect(dev1Second).toEqual([]);
  });

  it("keeps a device bound to its user across an anonymous re-upsert", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    const alert = {
      id: "a1",
      productId: "mikrotik-crs804-4ddq-hrm",
      targetPrice: 500,
      currency: "USD",
    };
    await upsertDeviceConfig("dev-1", { ...baseConfig, alerts: [alert] }, 7);
    await upsertDeviceConfig("dev-1", { ...baseConfig, alerts: [alert] });
    await evaluateNotifications(Date.now());
    const userEvents = await pullPendingEvents("dev-1", 7);
    expect(userEvents).toHaveLength(1);
    expect(userEvents[0]!.alertId).toBe("a1");
    const anonEvents = await pullPendingEvents("dev-1");
    expect(anonEvents).toEqual([]);
  });

  it("re-binds a device to a new user", async () => {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    });
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a1",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      7,
    );
    await upsertDeviceConfig(
      "dev-1",
      {
        ...baseConfig,
        alerts: [
          {
            id: "a2",
            productId: "mikrotik-crs804-4ddq-hrm",
            targetPrice: 500,
            currency: "USD",
          },
        ],
      },
      8,
    );
    await evaluateNotifications(Date.now());
    const user7 = await pullPendingEvents("dev-1", 7);
    expect(user7).toEqual([]);
    const user8 = await pullPendingEvents("dev-1", 8);
    expect(user8).toHaveLength(1);
    expect(user8[0]!.alertId).toBe("a2");
  });
});

describe("user-scoped notifications (database)", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
  });

  it("evaluates a user's aggregated config once and pushes to the user", async () => {
    const inserted: unknown[] = [];
    const storedSnapshots: Array<Record<string, unknown>> = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            const rows = [
              {
                deviceId: "dev-1",
                userId: 7,
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
              {
                deviceId: "dev-2",
                userId: 7,
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
            return {
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(async () => rows),
                })),
              })),
            };
          }
          if (table === notificationEvents) {
            return { where: vi.fn(async () => []) };
          }
          if (table === notificationEventDeliveries) {
            return { where: vi.fn(async () => []) };
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
    const rows = inserted[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      userId: 7,
      deviceId: null,
      type: "price_drop",
    });
    expect(vi.mocked(sendPushForUser)).toHaveBeenCalledWith(
      7,
      expect.arrayContaining([expect.objectContaining({ type: "price_drop" })]),
    );
    mockedGetDb.mockResolvedValue(null);
  });

  it("omits userId from the duplicate-key update set on anonymous upsert", async () => {
    const onUpdateSets: Array<Record<string, unknown>> = [];
    const storedSnapshots: Array<Record<string, unknown>> = [];
    const dbStub = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((rows: unknown) => {
          if (table === priceCache) {
            storedSnapshots.push(rows as Record<string, unknown>);
          }
          return {
            onDuplicateKeyUpdate: vi.fn(
              (arg: { set: Record<string, unknown> }) => {
                onUpdateSets.push(arg.set);
                return Promise.resolve(undefined);
              },
            ),
          };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const config: NotificationConfig = { ...baseConfig };

    await upsertDeviceConfig("dev-1", config, 7);
    expect(onUpdateSets).toHaveLength(1);
    expect(onUpdateSets[0]!.userId).toBe(7);

    await upsertDeviceConfig("dev-1", config);
    expect(onUpdateSets).toHaveLength(2);
    expect(onUpdateSets[1]).not.toHaveProperty("userId");

    await upsertDeviceConfig("dev-1", config, 8);
    expect(onUpdateSets).toHaveLength(3);
    expect(onUpdateSets[2]!.userId).toBe(8);

    mockedGetDb.mockResolvedValue(null);
  });

describe("upsertDeviceConfig with healthEvents", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  it("stores health events and pushes to other devices", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 42);
    await upsertDeviceConfig(
      "dev-2",
      {
        ...baseConfig,
        healthEvents: [
          {
            id: "health-winncom-blocked-1234",
            distributorId: "winncom",
            distributorName: "Winncom",
            status: "blocked",
            title: "🟠 Distributor Blocked",
            body: "Winncom has been blocked for 3 consecutive probes",
            createdAt: 1234,
          },
        ],
      },
      42,
    );
    const events = await pullPendingEvents("dev-1", 42);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("health");
    expect(events[0]!.distributorId).toBe("winncom");
    expect(sendPushForUser).toHaveBeenCalledWith(
      42,
      expect.arrayContaining([
        expect.objectContaining({ id: "health-winncom-blocked-1234" }),
      ]),
      "dev-2",
    );
  });

  it("deduplicates health events by id", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 42);
    const healthEvent = {
      id: "health-winncom-blocked-1234",
      distributorId: "winncom",
      distributorName: "Winncom",
      status: "blocked" as const,
      title: "🟠 Distributor Blocked",
      body: "Winncom has been blocked for 3 consecutive probes",
      createdAt: 1234,
    };
    await upsertDeviceConfig(
      "dev-2",
      { ...baseConfig, healthEvents: [healthEvent] },
      42,
    );
    await upsertDeviceConfig(
      "dev-3",
      { ...baseConfig, healthEvents: [healthEvent] },
      42,
    );
    const events = await pullPendingEvents("dev-1", 42);
    expect(events).toHaveLength(1);
  });
});

  it("pulls a user's undelivered events and records per-device delivery", async () => {
    const inserted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(async () => [
              {
                id: "evt-1",
                type: "price_drop",
                title: "💸 Price Drop Alert!",
                body: "CRS804 is now $480.00!",
                payload: {
                  alertId: "a1",
                  productId: "mikrotik-crs804-4ddq-hrm",
                  triggeredPrice: 480,
                },
                createdAt: 123,
              },
            ]),
          })),
        })),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((rows: unknown) => {
          inserted.push(rows);
          return { onDuplicateKeyUpdate: vi.fn(async () => undefined) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const events = await pullPendingEvents("dev-2", 7);
    expect(events).toHaveLength(1);
    expect(events[0]!.alertId).toBe("a1");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject([
      { deviceId: "dev-2", eventId: "evt-1", deliveredAt: expect.any(Number) },
    ]);
    mockedGetDb.mockResolvedValue(null);
  });
});
