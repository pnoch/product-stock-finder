import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const state = vi.hoisted(() => ({
  memoryConfigs: [] as Array<{ deviceId: string; userId: number | null }>,
  memoryTokens: [] as Array<{
    deviceId: string;
    userId: number | null;
    platform: string;
  }>,
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(),
  evaluateNotifications: vi.fn(),
  pullPendingEvents: vi.fn(),
  clearNotificationsForTests: vi.fn(),
  listMemoryConfigDevices: vi.fn(() => state.memoryConfigs),
}));

vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
  listMemoryTokenDevices: vi.fn(() => state.memoryTokens),
}));

import { upsertDeviceConfig, pullPendingEvents } from "../server/notifications";
import { upsertPushToken } from "../server/push-notifications";

const mockedUpsert = vi.mocked(upsertDeviceConfig);
const mockedPull = vi.mocked(pullPendingEvents);
const mockedUpsertPush = vi.mocked(upsertPushToken);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: null,
  };
}

function createAuthedContext(
  userId: number,
  deviceId: string | null = "dev-1",
): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId,
  };
}

describe("notifications router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.memoryConfigs = [];
    state.memoryTokens = [];
  });

  it("uploads a device config", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.notifications.uploadConfig({
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
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsert).toHaveBeenCalledTimes(1);
  });

  it("uploads a device config with healthEvents", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.notifications.uploadConfig({
      alerts: [],
      stockWatches: [],
      dateReminders: [],
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
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsert).toHaveBeenCalledWith(
      "dev-1",
      expect.objectContaining({
        healthEvents: expect.arrayContaining([
          expect.objectContaining({ distributorId: "winncom" }),
        ]),
      }),
      7,
    );
  });

  it("pulls pending events", async () => {
    mockedPull.mockResolvedValue([
      {
        id: "e1",
        type: "price_drop",
        title: "💸 Price Drop Alert!",
        body: "MikroTik CRS804-4DDQ-hRM is now $480.00 — below your target of $500.00!",
        alertId: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        triggeredPrice: 480,
        createdAt: 123,
      },
    ]);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.notifications.pull({});
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.alertId).toBe("a1");
    expect(mockedPull).toHaveBeenCalledWith("dev-1", 7);
  });

  it("rejects unauthenticated uploadConfig", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.uploadConfig({
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      }),
    ).rejects.toThrow("Please login");
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated pull", async () => {
    mockedPull.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.notifications.pull({})).rejects.toThrow("Please login");
    expect(mockedPull).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated registerPushToken", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.registerPushToken({
        token: "ExponentPushToken[abc123]",
      platform: "ios",
    }),
  ).rejects.toThrow("Please login");
    expect(mockedUpsertPush).not.toHaveBeenCalled();
  });

  it("registers a push token for a device", async () => {
    mockedUpsertPush.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.notifications.registerPushToken({
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsertPush).toHaveBeenCalledWith(
      "dev-1",
      "ExponentPushToken[abc123]",
      "ios",
      7,
    );
  });

  it("registers a web push subscription", async () => {
    mockedUpsertPush.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.notifications.registerPushToken({
      token: JSON.stringify({
        endpoint: "https://push.example.com/abc",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      }),
      platform: "web",
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsertPush).toHaveBeenCalledWith(
      "dev-1",
      JSON.stringify({
        endpoint: "https://push.example.com/abc",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      }),
      "web",
      7,
    );
  });

  it("rejects an invalid platform for registerPushToken", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(
      caller.notifications.registerPushToken({
        token: "ExponentPushToken[abc123]",
        platform: "desktop",
      } as never),
    ).rejects.toThrow();
    expect(mockedUpsertPush).not.toHaveBeenCalled();
  });

  it("forwards stock watch lastKnownStatus through uploadConfig", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.uploadConfig({
      alerts: [],
      stockWatches: [
        {
          id: "w1",
          productId: "mikrotik-crs804-4ddq-hrm",
          distributorId: "d1",
          lastKnownStatus: "back_order",
        },
      ],
      dateReminders: [],
    });
    expect(mockedUpsert).toHaveBeenCalledWith(
      "dev-1",
      {
        alerts: [],
        stockWatches: [
          {
            id: "w1",
            productId: "mikrotik-crs804-4ddq-hrm",
            distributorId: "d1",
            lastKnownStatus: "back_order",
          },
        ],
        dateReminders: [],
      },
      7,
    );
  });

  it("rejects when the context has no device id", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7, null));
    await expect(caller.notifications.pull({})).rejects.toThrow(
      "Missing device id",
    );
    expect(mockedPull).not.toHaveBeenCalled();
  });

  it("adopts an unbound device on uploadConfig", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.uploadConfig({
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(mockedUpsert).toHaveBeenCalledWith(
      "dev-1",
      { alerts: [], stockWatches: [], dateReminders: [] },
      7,
    );
  });

  it("rejects uploadConfig for a device owned by another user", async () => {
    state.memoryConfigs = [{ deviceId: "dev-1", userId: 8 }];
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(
      caller.notifications.uploadConfig({
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      }),
    ).rejects.toThrow("Notification device belongs to another account");
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("rejects pull for a device owned by another user", async () => {
    state.memoryConfigs = [{ deviceId: "dev-1", userId: 8 }];
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(caller.notifications.pull({})).rejects.toThrow(
      "Notification device belongs to another account",
    );
    expect(mockedPull).not.toHaveBeenCalled();
  });

  it("allows pull for the owning user", async () => {
    state.memoryConfigs = [{ deviceId: "dev-1", userId: 7 }];
    mockedPull.mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.pull({});
    expect(mockedPull).toHaveBeenCalledWith("dev-1", 7);
  });

  it("rejects registerPushToken for a device owned by another user", async () => {
    state.memoryConfigs = [{ deviceId: "dev-1", userId: 8 }];
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(
      caller.notifications.registerPushToken({
        token: "ExponentPushToken[abc123]",
        platform: "ios",
      }),
    ).rejects.toThrow("Notification device belongs to another account");
    expect(mockedUpsertPush).not.toHaveBeenCalled();
  });
});
