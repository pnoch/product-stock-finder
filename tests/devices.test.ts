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
  renameDevice,
  unrevokeDevice,
  signOutDevice,
  cleanupStaleDevices,
  isDeviceRevoked,
  clearDevicesForTests,
  STALE_DEVICE_MS,
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
  deviceLabels,
  deviceNotificationConfigs,
  devicePushTokens,
  notificationEventDeliveries,
  notificationEvents,
  revokedDevices,
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
    clearDevicesForTests();
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

  it("renames a bound device and shows the label in the list", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await renameDevice(7, "dev-1", "Living Room")).toBe(true);
    const devices = await listDevicesForUser(7);
    expect(devices[0].label).toBe("Living Room");
  });

  it("refuses to rename another user's device", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await renameDevice(8, "dev-1", "Hijacked")).toBe(false);
    const devices = await listDevicesForUser(7);
    expect(devices[0].label).toBeNull();
  });

  it("signs out a bound device and records revocation", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    await renameDevice(7, "dev-1", "Living Room");
    expect(await signOutDevice(7, "dev-1")).toBe(true);
    expect(await listDevicesForUser(7)).toEqual([]);
    expect(await getDeviceBinding("dev-1")).toEqual({ userId: null });
    expect(await isDeviceRevoked("dev-1")).toBe(true);
  });

  it("refuses to sign out another user's device", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await signOutDevice(8, "dev-1")).toBe(false);
    expect(await isDeviceRevoked("dev-1")).toBe(false);
    expect(await listDevicesForUser(7)).toHaveLength(1);
  });

  it("does not revoke a device when unbinding it directly", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    expect(await unbindDevice(7, "dev-1")).toBe(true);
    expect(await isDeviceRevoked("dev-1")).toBe(false);
  });

  it("un-revokes a device so it can authenticate again", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await signOutDevice(7, "dev-1");
    expect(await isDeviceRevoked("dev-1")).toBe(true);
    await unrevokeDevice("dev-1");
    expect(await isDeviceRevoked("dev-1")).toBe(false);
  });

  it("un-revoking a clean device is a no-op", async () => {
    await unrevokeDevice("dev-1");
    expect(await isDeviceRevoked("dev-1")).toBe(false);
  });

  it("skips devices with unknown lastSeenAt during cleanup", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    const removed = await cleanupStaleDevices(7, Date.now());
    expect(removed).toBe(0);
    expect(await listDevicesForUser(7)).toHaveLength(1);
  });

  it("clears labels and revocations for tests", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await renameDevice(7, "dev-1", "Living Room");
    await signOutDevice(7, "dev-1");
    clearDevicesForTests();
    expect(await listDevicesForUser(7)).toEqual([]);
    expect(await isDeviceRevoked("dev-1")).toBe(false);
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
          if (table === deviceLabels) {
            return Promise.resolve([
              { deviceId: "dev-1", label: "Living Room", updatedAt: 300 },
            ]);
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
      label: "Living Room",
    });
    const dev2 = devices.find((d) => d.deviceId === "dev-2");
    expect(dev2).toEqual({
      deviceId: "dev-2",
      platform: null,
      lastSeenAt: 200,
      label: null,
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

  it("renames a bound device by upserting a device_labels row", async () => {
    const inserted: unknown[] = [];
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
      insert: vi.fn((table: unknown) => {
        inserted.push(table);
        return {
          values: vi.fn(() => ({
            onDuplicateKeyUpdate: vi.fn(async () => undefined),
          })),
        };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await renameDevice(7, "dev-1", "Living Room")).toBe(true);
    expect(inserted).toEqual([deviceLabels]);
    expect(await renameDevice(8, "dev-1", "Hijacked")).toBe(false);
    mockedGetDb.mockResolvedValue(null);
  });

  it("signs out by unbinding and inserting a revoked_devices row", async () => {
    const deleted: unknown[] = [];
    const inserted: unknown[] = [];
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
      insert: vi.fn((table: unknown) => {
        inserted.push(table);
        return {
          values: vi.fn(() => ({
            onDuplicateKeyUpdate: vi.fn(async () => undefined),
          })),
        };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await signOutDevice(7, "dev-1")).toBe(true);
    expect(deleted).toEqual([
      deviceNotificationConfigs,
      devicePushTokens,
      notificationEventDeliveries,
      notificationEvents,
      deviceLabels,
    ]);
    expect(inserted).toEqual([revokedDevices]);
    mockedGetDb.mockResolvedValue(null);
  });

  it("un-revokes by deleting the revoked_devices row", async () => {
    const deleted: unknown[] = [];
    const dbStub = {
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    await unrevokeDevice("dev-1");
    expect(deleted).toEqual([revokedDevices]);
    mockedGetDb.mockResolvedValue(null);
  });

  it("excludes the caller's deviceId during cleanup", async () => {
    const deleted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [
                { deviceId: "stale", userId: 7, updatedAt: 1000 },
                { deviceId: "fresh", userId: 7, updatedAt: Date.now() },
              ]),
            };
          }
          if (table === deviceLabels) return Promise.resolve([]);
          return { where: vi.fn(async () => []) };
        }),
      })),
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const removed = await cleanupStaleDevices(7, Date.now() - 5000, "stale");
    expect(removed).toBe(0);
    expect(deleted).toEqual([]);
    mockedGetDb.mockResolvedValue(null);
  });

  it("removes stale devices but keeps fresh ones in the database", async () => {
    const deleted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [
                { deviceId: "stale", userId: 7, updatedAt: 1000 },
                { deviceId: "fresh", userId: 7, updatedAt: Date.now() },
              ]),
            };
          }
          if (table === deviceLabels) return Promise.resolve([]);
          return { where: vi.fn(async () => []) };
        }),
      })),
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const removed = await cleanupStaleDevices(7, Date.now() - 5000);
    expect(removed).toBe(1);
    expect(deleted).toContain(deviceNotificationConfigs);
    mockedGetDb.mockResolvedValue(null);
  });

  it("checks revocation in the database", async () => {
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === revokedDevices) {
            return {
              where: vi.fn(async (condition: unknown) => {
                const chunks = (condition as { queryChunks?: unknown[] })
                  .queryChunks;
                const boundDevice =
                  chunks?.some(
                    (chunk) => (chunk as { value?: string }).value === "dev-1",
                  ) ?? false;
                return boundDevice
                  ? [{ deviceId: "dev-1", revokedAt: Date.now() }]
                  : [];
              }),
            };
          }
          return { where: vi.fn(async () => []) };
        }),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    expect(await isDeviceRevoked("dev-1")).toBe(true);
    expect(await isDeviceRevoked("dev-2")).toBe(false);
    mockedGetDb.mockResolvedValue(null);
  });
});
