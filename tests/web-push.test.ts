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

  it("urlBase64ToUint8Array falls back to Buffer without atob", () => {
    const original = window.atob;
    (window as unknown as { atob?: unknown }).atob = undefined;
    try {
      const bytes = urlBase64ToUint8Array("AQID");
      expect(Array.from(bytes)).toEqual([1, 2, 3]);
    } finally {
      (window as unknown as { atob?: unknown }).atob = original;
    }
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

  it("registerWebPushServiceWorker returns null when registration fails", async () => {
    (
      navigator.serviceWorker.register as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("blocked"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await registerWebPushServiceWorker()).toBeNull();
    warn.mockRestore();
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

  it("subscribeWebPush registers a service worker when none exists", async () => {
    (
      navigator.serviceWorker.getRegistration as unknown as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce(null);
    expect(await subscribeWebPush()).toBe(true);
    expect(state.registered).toBe(true);
  });

  it("subscribeWebPush returns false when no registration can be obtained", async () => {
    (
      navigator.serviceWorker.getRegistration as unknown as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce(null);
    (
      navigator.serviceWorker.register as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(null);
    expect(await subscribeWebPush()).toBe(false);
  });

  it("subscribeWebPush returns false when the push manager rejects", async () => {
    (
      navigator.serviceWorker.getRegistration as unknown as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce({
      pushManager: {
        subscribe: vi.fn(async () => {
          throw new Error("permission denied");
        }),
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await subscribeWebPush()).toBe(false);
    warn.mockRestore();
  });

  it("unsubscribeWebPush unsubscribes the active subscription", async () => {
    const sub = { unsubscribe: vi.fn(async () => true) };
    state.subscription = sub;
    await unsubscribeWebPush();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("unsubscribeWebPush swallows registration errors", async () => {
    (
      navigator.serviceWorker.getRegistration as unknown as ReturnType<
        typeof vi.fn
      >
    ).mockRejectedValueOnce(new Error("no service worker"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(unsubscribeWebPush()).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe("web-push base64url parity", () => {
  it("mobile and desktop use the same base64url decode", async () => {
    // The two implementations are duplicated (mobile uses Platform.OS, desktop
    // uses vite env), so a divergence would break push on one platform only.
    // Compared as source (importing desktop/src into the root tsc pulls in
    // import.meta.env without its types).
    const { readFile } = await import("node:fs/promises");
    const mobile = await readFile("lib/web-push.ts", "utf8");
    const desktop = await readFile("desktop/src/lib/web-push.ts", "utf8");
    for (const src of [mobile, desktop]) {
      expect(src).toContain('replace(/-/g, "+")');
      expect(src).toContain('replace(/_/g, "/")');
      expect(src).toContain('"=".repeat((4 - (');
    }
  });
});
