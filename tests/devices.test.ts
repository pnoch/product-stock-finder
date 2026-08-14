import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken = (value: unknown) =>
      typeof value === "string" && value.startsWith("ExponentPushToken");
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    async sendPushNotificationsAsync() {
      return [{ status: "ok" }];
    }
  },
}));

import {
  listDevicesForUser,
  getDeviceBinding,
  unbindDevice,
} from "../server/devices";
import {
  upsertDeviceConfig,
  evaluateNotifications,
  pullPendingEvents,
  clearNotificationsForTests,
  type NotificationConfig,
} from "../server/notifications";
import {
  upsertPushToken,
  clearPushTokensForTests,
} from "../server/push-notifications";
import { setCachedPrice } from "../server/price-cache";
import { getDb } from "../server/db";
import {
  deviceNotificationConfigs,
  devicePushTokens,
  notificationEventDeliveries,
  notificationEvents,
} from "../drizzle/schema";

const mockedGetDb = vi.mocked(getDb);

const baseConfig: NotificationConfig = {
  alerts: [],
  stockWatches: [],
  dateReminders: [],
};

describe("devices (memory backend)", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    clearPushTokensForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  it("lists a user's devices from config and token maps, deduped", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await upsertDeviceConfig("dev-2", baseConfig, 7);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    const devices = await listDevicesForUser(7);
    expect(devices).toHaveLength(2);
    const dev1 = devices.find((d) => d.deviceId === "dev-1");
    expect(dev1?.platform).toBe("ios");
    expect(dev1?.lastSeenAt).toBe(0);
    const dev2 = devices.find((d) => d.deviceId === "dev-2");
    expect(dev2?.platform).toBeNull();
    expect(dev2?.lastSeenAt).toBe(0);
  });

  it("returns the config binding, falling back to the token", async () => {
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    expect(await getDeviceBinding("dev-1")).toEqual({ userId: 7 });
    expect(await getDeviceBinding("unknown")).toEqual({ userId: null });
  });

  it("unbinds a device bound to the user", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    expect(await unbindDevice(7, "dev-1")).toBe(true);
    expect(await listDevicesForUser(7)).toEqual([]);
    expect(await getDeviceBinding("dev-1")).toEqual({ userId: null });
  });

  it("refuses to unbind another user's device", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await unbindDevice(8, "dev-1")).toBe(false);
    expect(await listDevicesForUser(7)).toHaveLength(1);
  });

  it("returns false for an unknown device", async () => {
    expect(await unbindDevice(7, "unknown")).toBe(false);
  });

  it("removes anon events for the unbound device", async () => {
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
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await pullPendingEvents("dev-1")).toHaveLength(1);
    expect(await unbindDevice(7, "dev-1")).toBe(true);
    expect(await pullPendingEvents("dev-1")).toEqual([]);
  });
});

describe("devices (database backend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists a user's devices with max lastSeenAt and token platform", async () => {
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [
                { deviceId: "dev-1", userId: 7, updatedAt: 100 },
                { deviceId: "dev-2", userId: 7, updatedAt: 200 },
              ]),
            };
          }
          if (table === devicePushTokens) {
            return {
              where: vi.fn(async () => [
                {
                  deviceId: "dev-1",
                  userId: 7,
                  platform: "ios",
                  updatedAt: 150,
                },
              ]),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const devices = await listDevicesForUser(7);
    expect(devices).toHaveLength(2);
    const dev1 = devices.find((d) => d.deviceId === "dev-1");
    expect(dev1).toEqual({
      deviceId: "dev-1",
      platform: "ios",
      lastSeenAt: 150,
    });
    const dev2 = devices.find((d) => d.deviceId === "dev-2");
    expect(dev2).toEqual({
      deviceId: "dev-2",
      platform: null,
      lastSeenAt: 200,
    });
    mockedGetDb.mockResolvedValue(null);
  });

  it("unbinds a bound device by deleting all its rows", async () => {
    const deleted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [{ deviceId: "dev-1", userId: 7 }]),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await unbindDevice(7, "dev-1")).toBe(true);
    expect(deleted).toEqual([
      deviceNotificationConfigs,
      devicePushTokens,
      notificationEventDeliveries,
      notificationEvents,
    ]);
    mockedGetDb.mockResolvedValue(null);
  });

  it("refuses to unbind another user's device in the database", async () => {
    const deleteFn = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [{ deviceId: "dev-1", userId: 7 }]),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
      delete: deleteFn,
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await unbindDevice(8, "dev-1")).toBe(false);
    expect(deleteFn).not.toHaveBeenCalled();
    mockedGetDb.mockResolvedValue(null);
  });
});
