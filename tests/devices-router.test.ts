import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/devices", () => ({
  listDevicesForUser: vi.fn(),
  getDeviceBinding: vi.fn(),
  unbindDevice: vi.fn(),
}));

import {
  listDevicesForUser,
  getDeviceBinding,
  unbindDevice,
} from "../server/devices";

const mockedList = vi.mocked(listDevicesForUser);
const mockedBinding = vi.mocked(getDeviceBinding);
const mockedUnbind = vi.mocked(unbindDevice);

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
    deviceId: null,
  };
}

describe("devices router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists devices for the signed-in user", async () => {
    mockedList.mockResolvedValue([
      { deviceId: "dev-1", platform: "ios", lastSeenAt: 123, label: null },
    ]);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.list();
    expect(result.devices).toHaveLength(1);
    expect(mockedList).toHaveBeenCalledWith(7);
  });

  it("throws UNAUTHORIZED for list without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.devices.list()).rejects.toThrow();
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("returns the current device binding anonymously", async () => {
    mockedBinding.mockResolvedValue({ userId: 7 });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.devices.current({ deviceId: "dev-1" });
    expect(result).toEqual({ deviceId: "dev-1", userId: 7 });
    expect(mockedBinding).toHaveBeenCalledWith("dev-1");
  });

  it("unbinds a device for the signed-in user", async () => {
    mockedUnbind.mockResolvedValue(true);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.unbind({ deviceId: "dev-1" });
    expect(result).toEqual({ unbound: true });
    expect(mockedUnbind).toHaveBeenCalledWith(7, "dev-1");
  });

  it("throws UNAUTHORIZED for unbind without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.devices.unbind({ deviceId: "dev-1" }),
    ).rejects.toThrow();
    expect(mockedUnbind).not.toHaveBeenCalled();
  });

  it("rejects an oversized deviceId for current", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.devices.current({ deviceId: "x".repeat(129) }),
    ).rejects.toThrow();
    expect(mockedBinding).not.toHaveBeenCalled();
  });
});
