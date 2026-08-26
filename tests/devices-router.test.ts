import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/devices", () => ({
  listDevicesForUser: vi.fn(),
  getDeviceBinding: vi.fn(),
  renameDevice: vi.fn(),
  signOutDevice: vi.fn(),
  cleanupStaleDevices: vi.fn(),
  isDeviceRevoked: vi.fn(),
  STALE_DEVICE_MS: 30 * 24 * 60 * 60 * 1000,
}));

import {
  listDevicesForUser,
  getDeviceBinding,
  renameDevice,
  signOutDevice,
  cleanupStaleDevices,
} from "../server/devices";

const mockedList = vi.mocked(listDevicesForUser);
const mockedBinding = vi.mocked(getDeviceBinding);
const mockedRename = vi.mocked(renameDevice);
const mockedSignOut = vi.mocked(signOutDevice);
const mockedCleanup = vi.mocked(cleanupStaleDevices);

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

  it("returns the current device binding for the owner", async () => {
    mockedBinding.mockResolvedValue({ userId: 7 });
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.current({ deviceId: "dev-1" });
    expect(result).toEqual({ deviceId: "dev-1", userId: 7 });
    expect(mockedBinding).toHaveBeenCalledWith("dev-1");
  });

  it("throws FORBIDDEN when querying another user's device", async () => {
    mockedBinding.mockResolvedValue({ userId: 99 });
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(caller.devices.current({ deviceId: "dev-1" })).rejects.toThrow(
      /FORBIDDEN|Access denied/,
    );
    expect(mockedBinding).toHaveBeenCalledWith("dev-1");
  });

  it("throws UNAUTHORIZED for current without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.devices.current({ deviceId: "dev-1" })).rejects.toThrow();
    expect(mockedBinding).not.toHaveBeenCalled();
  });

  it("rejects an oversized deviceId for current", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(
      caller.devices.current({ deviceId: "x".repeat(129) }),
    ).rejects.toThrow();
    expect(mockedBinding).not.toHaveBeenCalled();
  });

  it("renames a device for the signed-in user", async () => {
    mockedRename.mockResolvedValue(true);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.rename({
      deviceId: "dev-1",
      label: "Living Room",
    });
    expect(result).toEqual({ renamed: true });
    expect(mockedRename).toHaveBeenCalledWith(7, "dev-1", "Living Room");
  });

  it("throws UNAUTHORIZED for rename without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.devices.rename({ deviceId: "dev-1", label: "x" }),
    ).rejects.toThrow();
    expect(mockedRename).not.toHaveBeenCalled();
  });

  it("rejects an oversized label for rename", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(
      caller.devices.rename({
        deviceId: "dev-1",
        label: "x".repeat(65),
      }),
    ).rejects.toThrow();
    expect(mockedRename).not.toHaveBeenCalled();
  });

  it("rejects an oversized deviceId for rename", async () => {
    const caller = appRouter.createCaller(createAuthedContext(7));
    await expect(
      caller.devices.rename({
        deviceId: "x".repeat(129),
        label: "x",
      }),
    ).rejects.toThrow();
    expect(mockedRename).not.toHaveBeenCalled();
  });

  it("signs out a device for the signed-in user", async () => {
    mockedSignOut.mockResolvedValue(true);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.signOut({ deviceId: "dev-1" });
    expect(result).toEqual({ signedOut: true });
    expect(mockedSignOut).toHaveBeenCalledWith(7, "dev-1");
  });

  it("throws UNAUTHORIZED for signOut without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.devices.signOut({ deviceId: "dev-1" }),
    ).rejects.toThrow();
    expect(mockedSignOut).not.toHaveBeenCalled();
  });

  it("cleans up stale devices for the signed-in user", async () => {
    mockedCleanup.mockResolvedValue(2);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.cleanupStale();
    expect(result).toEqual({ removed: 2 });
    expect(mockedCleanup).toHaveBeenCalledWith(7, expect.any(Number), null);
  });

  it("excludes the caller's deviceId when cleaning up stale devices", async () => {
    mockedCleanup.mockResolvedValue(1);
    const ctx = createAuthedContext(7);
    ctx.deviceId = "dev-current";
    const caller = appRouter.createCaller(ctx);
    const result = await caller.devices.cleanupStale();
    expect(result).toEqual({ removed: 1 });
    expect(mockedCleanup).toHaveBeenCalledWith(
      7,
      expect.any(Number),
      "dev-current",
    );
  });

  it("throws UNAUTHORIZED for cleanupStale without a user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.devices.cleanupStale()).rejects.toThrow();
    expect(mockedCleanup).not.toHaveBeenCalled();
  });
});
