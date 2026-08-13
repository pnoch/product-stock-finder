import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(),
  evaluateNotifications: vi.fn(),
  pullPendingEvents: vi.fn(),
  clearNotificationsForTests: vi.fn(),
}));

import { upsertDeviceConfig, pullPendingEvents } from "../server/notifications";

const mockedUpsert = vi.mocked(upsertDeviceConfig);
const mockedPull = vi.mocked(pullPendingEvents);

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

describe("notifications router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a device config", async () => {
    mockedUpsert.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.notifications.uploadConfig({
      deviceId: "dev-1",
      alerts: [
        { id: "a1", productId: "mikrotik-crs804-4ddq-hrm", targetPrice: 500, currency: "USD" },
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
    expect(mockedPull).toHaveBeenCalledWith("dev-1");
  });

  it("works without authentication (public procedure)", async () => {
    mockedPull.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.notifications.pull({ deviceId: "x" })).resolves.toEqual({
      events: [],
    });
  });
});