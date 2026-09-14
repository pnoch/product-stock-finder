import { describe, expect, it, vi } from "vitest";

vi.mock("../server/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/notifications")>();
  return {
    ...actual,
    upsertDeviceConfig: vi.fn(async () => {}),
  };
});
vi.mock("../server/devices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/devices")>();
  return { ...actual, assertDeviceAccess: vi.fn(async () => {}) };
});

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function ctx(): TrpcContext {
  return {
    user: { id: 1, openId: "o", name: "U", role: "user" } as never,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip: "1.2.3.4",
      socket: { remoteAddress: "1.2.3.4" },
    } as never,
    res: {} as never,
    deviceId: "dev-1",
  };
}

function alert(i: number) {
  return {
    id: `a${i}`,
    productId: "mikrotik-crs804-4ddq-hrm",
    targetPrice: 500,
    currency: "USD",
  };
}

describe("notifications.uploadConfig bounds", () => {
  it("rejects more than 200 alerts", async () => {
    const caller = appRouter.createCaller(ctx());
    const alerts = Array.from({ length: 201 }, (_, i) => alert(i));
    await expect(
      caller.notifications.uploadConfig({
        alerts,
        stockWatches: [],
        dateReminders: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts 200 alerts", async () => {
    const caller = appRouter.createCaller(ctx());
    const alerts = Array.from({ length: 200 }, (_, i) => alert(i));
    await expect(
      caller.notifications.uploadConfig({
        alerts,
        stockWatches: [],
        dateReminders: [],
      }),
    ).resolves.toEqual({ accepted: true });
  });
});
