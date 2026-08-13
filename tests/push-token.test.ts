import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  isDevice: true,
  projectId: "proj-123",
  token: "ExponentPushToken[mobile]",
  mutateCalls: [] as unknown[],
}));

vi.mock("react-native", () => ({
  Platform: { get OS() { return state.platform; } },
}));

vi.mock("expo-device", () => ({
  get isDevice() { return state.isDevice; },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      get extra() { return { expoProjectId: state.projectId }; },
    },
  },
}));

vi.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: vi.fn(async () => ({ data: state.token })),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => "dev-1"),
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      registerPushToken: {
        mutate: vi.fn(async (input: unknown) => {
          state.mutateCalls.push(input);
        }),
      },
    },
  })),
}));

import { registerPushToken } from "../lib/push-token";

describe("registerPushToken", () => {
  beforeEach(() => {
    state.platform = "ios";
    state.isDevice = true;
    state.projectId = "proj-123";
    state.mutateCalls.length = 0;
  });

  it("registers the push token on a physical device", async () => {
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(1);
    expect(state.mutateCalls[0]).toEqual({
      deviceId: "dev-1",
      token: "ExponentPushToken[mobile]",
      platform: "ios",
    });
  });

  it("skips on web", async () => {
    state.platform = "web";
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(0);
  });

  it("skips on a simulator/emulator", async () => {
    state.isDevice = false;
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(0);
  });

  it("skips when no project id is configured", async () => {
    state.projectId = undefined as unknown as string;
    await registerPushToken();
    expect(state.mutateCalls).toHaveLength(0);
  });

  it("never throws on failure", async () => {
    state.projectId = undefined as unknown as string;
    await expect(registerPushToken()).resolves.toBeUndefined();
  });
});
