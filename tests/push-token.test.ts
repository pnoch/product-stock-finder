import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  isDevice: true,
  projectId: "proj-123" as string | undefined,
  token: "ExponentPushToken[mobile]",
  failToken: false,
  failUnregister: false,
  registerCalls: [] as unknown[],
  unregisterCalls: [] as unknown[],
  webUnsubscribed: false,
  failWebUnsub: false,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("expo-device", () => ({
  get isDevice() {
    return state.isDevice;
  },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      get extra() {
        return { expoProjectId: state.projectId };
      },
    },
  },
}));

vi.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: vi.fn(async () => {
    if (state.failToken) throw new Error("no permission");
    return { data: state.token };
  }),
}));

vi.mock("../lib/web-push", () => ({
  unsubscribeWebPush: vi.fn(async () => {
    if (state.failWebUnsub) throw new Error("no subscription");
    state.webUnsubscribed = true;
  }),
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      registerPushToken: {
        mutate: vi.fn(async (input: unknown) => {
          state.registerCalls.push(input);
        }),
      },
      unregisterPushToken: {
        mutate: vi.fn(async (input: unknown) => {
          if (state.failUnregister) throw new Error("server down");
          state.unregisterCalls.push(input);
        }),
      },
    },
  })),
}));

import { registerPushToken, unregisterPushToken } from "../lib/push-token";

beforeEach(() => {
  state.platform = "ios";
  state.isDevice = true;
  state.projectId = "proj-123";
  state.failToken = false;
  state.failUnregister = false;
  state.registerCalls.length = 0;
  state.unregisterCalls.length = 0;
  state.webUnsubscribed = false;
  state.failWebUnsub = false;
});

describe("registerPushToken", () => {
  it("registers the push token on a physical device", async () => {
    await registerPushToken();
    expect(state.registerCalls).toHaveLength(1);
    expect(state.registerCalls[0]).toEqual({
      token: "ExponentPushToken[mobile]",
      platform: "ios",
    });
  });

  it("skips on web", async () => {
    state.platform = "web";
    await registerPushToken();
    expect(state.registerCalls).toHaveLength(0);
  });

  it("skips on a simulator/emulator", async () => {
    state.isDevice = false;
    await registerPushToken();
    expect(state.registerCalls).toHaveLength(0);
  });

  it("skips when no project id is configured", async () => {
    state.projectId = undefined;
    await registerPushToken();
    expect(state.registerCalls).toHaveLength(0);
  });

  it("never throws when the token request fails", async () => {
    state.failToken = true;
    await expect(registerPushToken()).resolves.toBeUndefined();
    expect(state.registerCalls).toHaveLength(0);
  });

  it("never throws when the project id is absent", async () => {
    state.projectId = undefined;
    await expect(registerPushToken()).resolves.toBeUndefined();
  });
});

describe("unregisterPushToken", () => {
  it("unregisters on a native device", async () => {
    await unregisterPushToken();
    expect(state.unregisterCalls).toHaveLength(1);
    expect(state.webUnsubscribed).toBe(false);
  });

  it("unsubscribes web push and unregisters on web", async () => {
    state.platform = "web";
    await unregisterPushToken();
    expect(state.webUnsubscribed).toBe(true);
    // The signed-out browser must also prune the server-side token.
    expect(state.unregisterCalls).toHaveLength(1);
  });

  it("never throws when the server call fails (native)", async () => {
    state.failUnregister = true;
    await expect(unregisterPushToken()).resolves.toBeUndefined();
  });

  it("never throws when the server call fails (web)", async () => {
    state.platform = "web";
    state.failUnregister = true;
    await expect(unregisterPushToken()).resolves.toBeUndefined();
    // The local subscription is still dropped even if the server call fails.
    expect(state.webUnsubscribed).toBe(true);
  });

  it("still prunes the server token when the local web unsubscribe fails", async () => {
    state.platform = "web";
    state.failWebUnsub = true;
    await expect(unregisterPushToken()).resolves.toBeUndefined();
    expect(state.unregisterCalls).toHaveLength(1);
  });
});
