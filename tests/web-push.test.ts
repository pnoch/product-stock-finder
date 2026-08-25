// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "web",
  registered: false,
  subscription: null as unknown,
  mutateCalls: [] as Array<{
    deviceId: string;
    token: string;
    platform: string;
  }>,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      registerPushToken: {
        mutate: vi.fn(
          async (input: {
            deviceId: string;
            token: string;
            platform: string;
          }) => {
            state.mutateCalls.push(input);
          },
        ),
      },
    },
  })),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => "web-dev-1"),
}));

import {
  isPushSupported,
  urlBase64ToUint8Array,
  registerWebPushServiceWorker,
  subscribeWebPush,
  unsubscribeWebPush,
} from "../lib/web-push";

class MockServiceWorkerRegistration {
  pushManager = {
    subscribe: vi.fn(async () => state.subscription),
    getSubscription: vi.fn(async () => state.subscription),
  };
}

describe("web push client", () => {
  beforeEach(() => {
    state.platform = "web";
    state.registered = false;
    state.mutateCalls = [];
    state.subscription = {
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    };
    process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY = "AQID";
    // @ts-expect-error jsdom lacks serviceWorker
    navigator.serviceWorker = {
      register: vi.fn(async () => {
        state.registered = true;
        return new MockServiceWorkerRegistration();
      }),
      getRegistration: vi.fn(async () => new MockServiceWorkerRegistration()),
    };
    // @ts-expect-error jsdom lacks PushManager
    window.PushManager = class {};
    // @ts-expect-error jsdom lacks Notification
    window.Notification = class {};
  });

  it("urlBase64ToUint8Array decodes base64url", () => {
    const bytes = urlBase64ToUint8Array("AQID");
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("urlBase64ToUint8Array handles base64url padding", () => {
    const bytes = urlBase64ToUint8Array("AQI");
    expect(Array.from(bytes)).toEqual([1, 2]);
  });

  it("isPushSupported is true on web with PushManager and Notification", () => {
    expect(isPushSupported()).toBe(true);
  });

  it("isPushSupported is false on native", () => {
    state.platform = "ios";
    expect(isPushSupported()).toBe(false);
  });

  it("isPushSupported is false without PushManager", () => {
    // @ts-expect-error remove PushManager
    delete window.PushManager;
    expect(isPushSupported()).toBe(false);
  });

  it("registerWebPushServiceWorker registers /sw.js", async () => {
    const reg = await registerWebPushServiceWorker();
    expect(reg).not.toBeNull();
    expect(state.registered).toBe(true);
  });

  it("subscribeWebPush registers the subscription with the server", async () => {
    const result = await subscribeWebPush();
    expect(result).toBe(true);
    expect(state.mutateCalls).toHaveLength(1);
    expect(state.mutateCalls[0]!.platform).toBe("web");
    expect(JSON.parse(state.mutateCalls[0]!.token)).toEqual(state.subscription);
  });

  it("subscribeWebPush returns false when the VAPID key is missing", async () => {
    delete process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    const result = await subscribeWebPush();
    expect(result).toBe(false);
  });

  it("unsubscribeWebPush unsubscribes the active subscription", async () => {
    const sub = { unsubscribe: vi.fn(async () => true) };
    state.subscription = sub;
    await unsubscribeWebPush();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});
