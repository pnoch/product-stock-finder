import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("../server/devices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/devices")>();
  return { ...actual, assertDeviceAccess: vi.fn(async () => {}) };
});

import {
  upsertPushToken,
  listMemoryTokenDevices,
  clearPushTokensForTests,
} from "../server/push-notifications";
import { assertDeviceAccess } from "../server/devices";

const mockedAssertDeviceAccess = vi.mocked(assertDeviceAccess);

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

describe("notifications unregisterPushToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPushTokensForTests();
  });

  it("removes a registered token", async () => {
    await upsertPushToken("dev-1", "tok", "web", 7);
    expect(
      listMemoryTokenDevices().some((d) => d.deviceId === "dev-1"),
    ).toBe(true);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.notifications.unregisterPushToken();
    expect(result).toEqual({ accepted: true });
    expect(
      listMemoryTokenDevices().some((d) => d.deviceId === "dev-1"),
    ).toBe(false);
  });

  it("is idempotent when no token exists", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(
      caller.notifications.unregisterPushToken(),
    ).resolves.toEqual({ accepted: true });
  });

  it("rejects when the context has no device id", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7, null));
    await expect(caller.notifications.unregisterPushToken()).rejects.toThrow(
      "Missing device id",
    );
  });

  it("checks device ownership before pruning", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7));
    await caller.notifications.unregisterPushToken();
    expect(mockedAssertDeviceAccess).toHaveBeenCalledWith(7, "dev-1");
  });

  it("rejects cross-user access without pruning the token", async () => {
    await upsertPushToken("dev-1", "tok", "web", 7);
    mockedAssertDeviceAccess.mockRejectedValueOnce(
      new TRPCError({ code: "FORBIDDEN", message: "Device access denied" }),
    );
    const caller = appRouter.createCaller(createAuthedContext(8));
    await expect(
      caller.notifications.unregisterPushToken(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      listMemoryTokenDevices().some((d) => d.deviceId === "dev-1"),
    ).toBe(true);
  });
});
