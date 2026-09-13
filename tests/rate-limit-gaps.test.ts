import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { clearRateLimitsForTests } from "../server/rate-limit";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(async () => {}),
  evaluateNotifications: vi.fn(async () => {}),
  pullPendingEvents: vi.fn(async () => []),
  clearNotificationsForTests: vi.fn(),
  listMemoryConfigDevices: vi.fn(() => []),
}));

vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(async () => {}),
  pruneDeviceToken: vi.fn(async () => {}),
  listMemoryTokenDevices: vi.fn(() => []),
}));

vi.mock("../server/devices", () => ({
  listDevicesForUser: vi.fn(async () => []),
  getDeviceBinding: vi.fn(async () => ({ userId: 1 })),
  assertDeviceAccess: vi.fn(async () => {}),
  renameDevice: vi.fn(async () => true),
  signOutDevice: vi.fn(async () => true),
  cleanupStaleDevices: vi.fn(async () => 0),
  STALE_DEVICE_MS: 30 * 24 * 60 * 60 * 1000,
}));

function ctx(ip: string): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "open-1",
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
      ip,
      socket: { remoteAddress: ip },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: "dev-1",
  };
}

async function hammer(
  ip: string,
  fn: (caller: ReturnType<typeof appRouter.createCaller>) => Promise<unknown>,
  times: number,
): Promise<unknown> {
  const caller = appRouter.createCaller(ctx(ip));
  let last: unknown;
  for (let i = 0; i < times; i++) {
    try {
      last = await fn(caller);
    } catch (e) {
      last = e;
    }
  }
  return last;
}

describe("endpoint rate-limit gaps", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("throttles notification config uploads", async () => {
    const err = await hammer(
      "11.0.0.1",
      (c) =>
        c.notifications.uploadConfig({
          alerts: [],
          stockWatches: [],
          dateReminders: [],
        }) as Promise<unknown>,
      31,
    );
    expect((err as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
  });

  it("throttles notification pulls", async () => {
    const err = await hammer(
      "11.0.0.2",
      (c) => c.notifications.pull({}) as Promise<unknown>,
      61,
    );
    expect((err as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
  });

  it("throttles push-token registration", async () => {
    const err = await hammer(
      "11.0.0.3",
      (c) =>
        c.notifications.registerPushToken({
          token: "tok",
          platform: "web",
        }) as Promise<unknown>,
      11,
    );
    expect((err as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
  });

  it("throttles device listing", async () => {
    const err = await hammer(
      "11.0.0.4",
      (c) => c.devices.list() as Promise<unknown>,
      31,
    );
    expect((err as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
  });

  it("throttles device rename", async () => {
    const err = await hammer(
      "11.0.0.5",
      (c) =>
        c.devices.rename({ deviceId: "dev-1", label: "x" }) as Promise<unknown>,
      11,
    );
    expect((err as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
  });
});
