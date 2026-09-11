import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPushSupported, ensurePushSubscription, disablePush, hasVapidKey, getPushStatus } from "../src/lib/web-push";

const mockMutate = vi.hoisted(() => vi.fn());
const mockUnregisterMutate = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({
    notifications: {
      registerPushToken: { mutate: mockMutate },
      unregisterPushToken: { mutate: mockUnregisterMutate },
    },
  }),
}));

function setSupport(partial: Record<string, unknown>) {
  Object.assign(window, { PushManager: undefined, Notification: undefined });
  Object.assign(navigator, { serviceWorker: undefined });
  Object.assign(window, partial.sw ?? {});
  Object.assign(navigator, partial.nav ?? {});
}

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("desktop web push", () => {
  it("reports unsupported without serviceWorker/PushManager", () => {
    setSupport({});
    expect(isPushSupported()).toBe(false);
  });
  it("subscribes and uploads the subscription", async () => {
    const subscribe = vi.fn().mockResolvedValue({ endpoint: "https://push/x", toJSON: () => ({}) });
    const registration = { pushManager: { subscribe } };
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: { register: vi.fn().mockResolvedValue(registration), getRegistration: vi.fn().mockResolvedValue(registration) } });
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BMx-test-key");
    const ok = await ensurePushSubscription();
    expect(ok).toBe(true);
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ platform: "web" }));
  });
  it("refuses without a VAPID key", async () => {
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: {} });
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    await expect(ensurePushSubscription()).resolves.toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
  });
  it("disables by unsubscribing", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) } }) } });
    mockUnregisterMutate.mockResolvedValue({ accepted: true });
    await disablePush();
    expect(unsubscribe).toHaveBeenCalled();
  });
  it("unregisters the server token on disable", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) } }) } });
    mockUnregisterMutate.mockResolvedValue({ accepted: true });
    await disablePush();
    expect(mockUnregisterMutate).toHaveBeenCalledTimes(1);
    expect(mockUnregisterMutate.mock.calls[0][0]).toBeUndefined();
  });
  it("unregisters the server token on disable even with no local subscription", async () => {
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }) } });
    mockUnregisterMutate.mockResolvedValue({ accepted: true });
    await disablePush();
    expect(mockUnregisterMutate).toHaveBeenCalledTimes(1);
    expect(mockUnregisterMutate.mock.calls[0][0]).toBeUndefined();
  });
  it("does not throw when server unregister fails on disable", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) } }) } });
    mockUnregisterMutate.mockRejectedValue(new Error("401"));
    await expect(disablePush()).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalled();
  });
  it("reports a VAPID key when configured", () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BMx-test-key");
    expect(hasVapidKey()).toBe(true);
  });
  it("reports no VAPID key when unconfigured", () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    expect(hasVapidKey()).toBe(false);
  });
  it("reports push on with an active subscription", async () => {
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: "https://push/x" }) } }) } });
    await expect(getPushStatus()).resolves.toBe("on");
  });
  it("reports push off without a subscription", async () => {
    Object.assign(window, { PushManager: function () {}, Notification: function () {} });
    Object.assign(navigator, { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }) } });
    await expect(getPushStatus()).resolves.toBe("off");
  });
  it("reports push off when unsupported", async () => {
    setSupport({});
    await expect(getPushStatus()).resolves.toBe("off");
  });
});
