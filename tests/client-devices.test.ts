import { describe, expect, it, vi, beforeEach } from "vitest";

const mockClient = vi.hoisted(() => ({
  devices: {
    list: { query: vi.fn() },
    current: { query: vi.fn() },
    rename: { mutate: vi.fn() },
    signOut: { mutate: vi.fn() },
    cleanupStale: { mutate: vi.fn() },
  },
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: () => mockClient,
}));
vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => "dev-1"),
}));

const binding = vi.hoisted(() => ({
  registerPushToken: vi.fn(async () => {}),
  syncServerNotifications: vi.fn(async () => {}),
}));
vi.mock("../lib/push-token", () => ({
  registerPushToken: (...a: unknown[]) => binding.registerPushToken(...(a as [])),
}));
vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: (...a: unknown[]) =>
    binding.syncServerNotifications(...(a as [])),
}));

import {
  bindCurrentDevice,
  cleanupStaleDevices,
  fetchCurrentDeviceBinding,
  fetchDevices,
  renameDevice,
  signOutDevice,
} from "../lib/devices";

describe("client device API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the device list, or null on failure", async () => {
    mockClient.devices.list.query.mockResolvedValueOnce({
      devices: [{ deviceId: "d1" }],
    });
    expect(await fetchDevices()).toEqual([{ deviceId: "d1" }]);

    mockClient.devices.list.query.mockRejectedValueOnce(new Error("offline"));
    // A failure must be a null (the UI shows an empty state), never a throw.
    expect(await fetchDevices()).toBeNull();
  });

  it("reads the current device binding", async () => {
    mockClient.devices.current.query.mockResolvedValueOnce({ userId: 7 });
    expect(await fetchCurrentDeviceBinding()).toEqual({ userId: 7 });
    expect(mockClient.devices.current.query).toHaveBeenCalledWith({
      deviceId: "dev-1",
    });

    mockClient.devices.current.query.mockRejectedValueOnce(new Error("x"));
    expect(await fetchCurrentDeviceBinding()).toBeNull();
  });

  it("reports rename/sign-out/cleanup results, defaulting to false/0 on failure", async () => {
    mockClient.devices.rename.mutate.mockResolvedValueOnce({ renamed: true });
    expect(await renameDevice("d1", "Desk")).toBe(true);
    mockClient.devices.rename.mutate.mockRejectedValueOnce(new Error("x"));
    expect(await renameDevice("d1", "Desk")).toBe(false);

    mockClient.devices.signOut.mutate.mockResolvedValueOnce({ signedOut: true });
    expect(await signOutDevice("d1")).toBe(true);
    mockClient.devices.signOut.mutate.mockRejectedValueOnce(new Error("x"));
    expect(await signOutDevice("d1")).toBe(false);

    mockClient.devices.cleanupStale.mutate.mockResolvedValueOnce({ removed: 3 });
    expect(await cleanupStaleDevices()).toBe(3);
    mockClient.devices.cleanupStale.mutate.mockRejectedValueOnce(new Error("x"));
    expect(await cleanupStaleDevices()).toBe(0);
  });
});

describe("bindCurrentDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    binding.registerPushToken.mockResolvedValue(undefined);
    binding.syncServerNotifications.mockResolvedValue(undefined);
  });

  it("registers the push token then syncs server notifications", async () => {
    await bindCurrentDevice();
    expect(binding.registerPushToken).toHaveBeenCalledTimes(1);
    expect(binding.syncServerNotifications).toHaveBeenCalledTimes(1);
    // Ordering matters: the token must be registered before the pull.
    expect(
      binding.registerPushToken.mock.invocationCallOrder[0]!,
    ).toBeLessThan(binding.syncServerNotifications.mock.invocationCallOrder[0]!);
  });

  it("never throws when push registration fails", async () => {
    binding.registerPushToken.mockRejectedValueOnce(new Error("no permission"));
    await expect(bindCurrentDevice()).resolves.toBeUndefined();
    expect(binding.syncServerNotifications).not.toHaveBeenCalled();
  });

  it("never throws when the notification sync fails", async () => {
    binding.syncServerNotifications.mockRejectedValueOnce(new Error("offline"));
    await expect(bindCurrentDevice()).resolves.toBeUndefined();
  });
});
