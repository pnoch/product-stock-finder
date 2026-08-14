import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(),
  evaluateNotifications: vi.fn(),
  pullPendingEvents: vi.fn(),
  clearNotificationsForTests: vi.fn(),
}));

vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
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
  };
}

function createAuthedContext(userId: number): TrpcContext {
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
  };
}

describe("notifications router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a device config", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.uploadConfig({
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
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsert).toHaveBeenCalledTimes(1);
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
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.pull({ deviceId: "dev-1" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.alertId).toBe("a1");
    expect(mockedPull).toHaveBeenCalledWith("dev-1", undefined);
  });

  it("works without authentication (public procedure)", async () => {
    mockedPull.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.notifications.pull({ deviceId: "x" })).resolves.toEqual(
      {
        events: [],
      },
    );
  });

  it("registers a push token for a device", async () => {
    mockedUpsertPush.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.registerPushToken({
      deviceId: "dev-1",
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    });
    expect(result).toEqual({ accepted: true });
    expect(mockedUpsertPush).toHaveBeenCalledWith(
      "dev-1",
      "ExponentPushToken[abc123]",
      "ios",
      null,
    );
  });

  it("rejects an invalid platform for registerPushToken", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.registerPushToken({
        deviceId: "dev-1",
        token: "ExponentPushToken[abc123]",
        platform: "web",
      } as never),
    ).rejects.toThrow();
    expect(mockedUpsertPush).not.toHaveBeenCalled();
  });

  it("forwards stock watch lastKnownStatus through uploadConfig", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    await caller.notifications.uploadConfig({
      deviceId: "dev-1",
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
    expect(mockedUpsert).toHaveBeenCalledWith("dev-1", {
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
    }, null);
  });

  it("rejects an oversized deviceId for uploadConfig", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.uploadConfig({
        deviceId: "x".repeat(129),
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      }),
    ).rejects.toThrow();
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("rejects an oversized deviceId for pull", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.notifications.pull({ deviceId: "x".repeat(129) }),
    ).rejects.toThrow();
    expect(mockedPull).not.toHaveBeenCalled();
  });

  it("pulls user-scoped events when authenticated", async () => {
    mockedPull.mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.pull({ deviceId: "dev-1" });
    expect(mockedPull).toHaveBeenCalledWith("dev-1", 7);
  });

  it("binds the device to the user on authenticated uploadConfig", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.uploadConfig({
      deviceId: "dev-1",
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

  it("binds the device to the user on authenticated registerPushToken", async () => {
    mockedUpsertPush.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.registerPushToken({
      deviceId: "dev-1",
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    });
    expect(mockedUpsertPush).toHaveBeenCalledWith(
      "dev-1",
      "ExponentPushToken[abc123]",
      "ios",
      7,
    );
  });
});
