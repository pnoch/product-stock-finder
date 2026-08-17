// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "web",
  permission: "default" as NotificationPermission,
  requestResult: "granted" as NotificationPermission,
  displayed: [] as Array<{ title: string; body: string }>,
  syncCalls: 0,
  webNotificationsEnabled: false,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("../lib/storage", () => ({
  getSettings: vi.fn(async () => ({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    webNotificationsEnabled: state.webNotificationsEnabled,
  })),
  saveSettings: vi.fn(async (settings: Record<string, unknown>) => {
    state.webNotificationsEnabled = Boolean(settings.webNotificationsEnabled);
  }),
}));

vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {
    state.syncCalls += 1;
  }),
}));

import {
  displayWebNotification,
  isWebNotificationsSupported,
  requestWebNotificationPermission,
  setWebNotificationsEnabled,
  setupWebNotifications,
} from "../lib/web-notifications";

class MockNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(
    async (): Promise<NotificationPermission> => state.requestResult,
  );
  title: string;
  body: string;
  onclick: (() => void) | null = null;
  close = vi.fn();
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.body = options?.body ?? "";
    state.displayed.push({ title: this.title, body: this.body });
  }
}

describe("web notifications", () => {
  beforeEach(async () => {
    state.platform = "web";
    state.permission = "default";
    state.requestResult = "granted";
    state.displayed = [];
    state.syncCalls = 0;
    state.webNotificationsEnabled = false;
    window.isSecureContext = true;
    MockNotification.permission = state.permission;
    MockNotification.requestPermission.mockClear();
    // @ts-expect-error jsdom has no Notification
    window.Notification = MockNotification;
    // Reset module-level poll timer between tests
    await setWebNotificationsEnabled(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isWebNotificationsSupported is true on web with Notification", () => {
    expect(isWebNotificationsSupported()).toBe(true);
  });

  it("isWebNotificationsSupported is false when Notification is missing", () => {
    // @ts-expect-error remove Notification
    delete window.Notification;
    expect(isWebNotificationsSupported()).toBe(false);
  });

  it("isWebNotificationsSupported is false on native", () => {
    state.platform = "ios";
    expect(isWebNotificationsSupported()).toBe(false);
  });

  it("requestWebNotificationPermission returns the permission result", async () => {
    state.requestResult = "denied";
    const result = await requestWebNotificationPermission();
    expect(result).toBe("denied");
    expect(MockNotification.requestPermission).toHaveBeenCalled();
  });

  it("displayWebNotification constructs a Notification when granted", () => {
    state.permission = "granted";
    MockNotification.permission = "granted";
    displayWebNotification("Price drop!", "CRS804 is $89");
    expect(state.displayed).toEqual([
      { title: "Price drop!", body: "CRS804 is $89" },
    ]);
  });

  it("displayWebNotification no-ops when permission is not granted", () => {
    state.permission = "denied";
    MockNotification.permission = "denied";
    displayWebNotification("Price drop!", "CRS804 is $89");
    expect(state.displayed).toEqual([]);
  });

  it("setWebNotificationsEnabled(true) persists and starts polling when granted", async () => {
    vi.useFakeTimers();
    const result = await setWebNotificationsEnabled(true);
    expect(result).toBe("granted");
    expect(state.webNotificationsEnabled).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBeGreaterThan(0);
  });

  it("setWebNotificationsEnabled(true) does not persist when denied", async () => {
    state.requestResult = "denied";
    const result = await setWebNotificationsEnabled(true);
    expect(result).toBe("denied");
    expect(state.webNotificationsEnabled).toBe(false);
  });

  it("setWebNotificationsEnabled(false) persists off and stops polling", async () => {
    vi.useFakeTimers();
    await setWebNotificationsEnabled(true);
    expect(state.syncCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBeGreaterThan(0);
    await setWebNotificationsEnabled(false);
    expect(state.webNotificationsEnabled).toBe(false);
    const callsAfterDisable = state.syncCalls;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(state.syncCalls).toBe(callsAfterDisable);
  });

  it("setupWebNotifications starts polling when enabled and granted", async () => {
    state.webNotificationsEnabled = true;
    state.permission = "granted";
    MockNotification.permission = "granted";
    vi.useFakeTimers();
    const cleanup = setupWebNotifications();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBeGreaterThan(0);
    cleanup();
  });

  it("setupWebNotifications does not poll when disabled", async () => {
    state.webNotificationsEnabled = false;
    vi.useFakeTimers();
    const cleanup = setupWebNotifications();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.syncCalls).toBe(0);
    cleanup();
  });
});