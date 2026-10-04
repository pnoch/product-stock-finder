import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios" as string,
  quiet: false,
  settings: {} as Record<string, unknown>,
  scheduled: [] as {
    content: { title: string; body: string; data?: unknown };
    trigger: unknown;
  }[],
  channels: [] as { id: string; opts: Record<string, unknown> }[],
  cancelled: [] as string[],
  allCancelled: 0,
  failSchedule: false,
  failCancel: false,
  perm: "granted" as string,
  existingPerm: "granted" as string,
  displayWeb: true,
  webPermission: "granted" as string,
  recorded: [] as Record<string, unknown>[],
  displayedIds: [] as string[],
  receivedListeners: [] as ((n: unknown) => void)[],
  responseListeners: [] as ((r: unknown) => void)[],
  lastResponse: null as unknown,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn(async (opts: (typeof state.scheduled)[number]) => {
    if (state.failSchedule) throw new Error("schedule failed");
    state.scheduled.push(opts);
    return "notif-id";
  }),
  getPermissionsAsync: vi.fn(async () => ({ status: state.existingPerm })),
  requestPermissionsAsync: vi.fn(async () => ({ status: state.perm })),
  cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
    if (state.failCancel) throw new Error("cancel failed");
    state.cancelled.push(id);
  }),
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {
    if (state.failCancel) throw new Error("cancel failed");
    state.allCancelled += 1;
  }),
  setNotificationChannelAsync: vi.fn(
    async (id: string, opts: Record<string, unknown>) => {
      state.channels.push({ id, opts });
    },
  ),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval", DATE: "date" },
  addNotificationReceivedListener: vi.fn((cb: (n: unknown) => void) => {
    state.receivedListeners.push(cb);
    return { remove: vi.fn() };
  }),
  addNotificationResponseReceivedListener: vi.fn((cb: (r: unknown) => void) => {
    state.responseListeners.push(cb);
    return { remove: vi.fn() };
  }),
  getLastNotificationResponseAsync: vi.fn(async () => state.lastResponse),
}));

vi.mock("../lib/storage", () => ({
  getSettings: vi.fn(async () => state.settings),
  recordNotificationEvent: vi.fn(async (e: Record<string, unknown>) => {
    state.recorded.push(e);
  }),
  recordDisplayedEventId: vi.fn(async (id: string) => {
    state.displayedIds.push(id);
  }),
}));

vi.mock("../lib/quiet-hours", () => ({
  isInQuietHours: () => state.quiet,
}));

vi.mock("@shared/distributors", () => ({
  getDistributorById: (id: string) => ({ name: "Distributor X", id }),
}));

vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn(() => state.displayWeb),
  requestWebNotificationPermission: vi.fn(async () => state.webPermission),
}));

vi.mock("@shared/log", () => ({ LOG_ERROR: vi.fn() }));

import {
  cancelAllNotifications,
  cancelNotification,
  channelIdFor,
  immediateTrigger,
  scheduleBackOrderReminder,
  schedulePriceAlert,
  scheduleServerEventNotification,
  scheduleStockAlert,
  scheduleStockWatchConfirmation,
  sendPriceDigestNotification,
  sendTestNotification,
  setupAndroidNotificationChannel,
  setupPushEventTracking,
} from "../lib/notifications";

beforeEach(() => {
  state.platform = "ios";
  state.quiet = false;
  state.settings = {};
  state.scheduled.length = 0;
  state.channels.length = 0;
  state.cancelled.length = 0;
  state.allCancelled = 0;
  state.failSchedule = false;
  state.failCancel = false;
  state.perm = "granted";
  state.existingPerm = "granted";
  state.displayWeb = true;
  state.webPermission = "granted";
  state.recorded.length = 0;
  state.displayedIds.length = 0;
  state.receivedListeners.length = 0;
  state.responseListeners.length = 0;
  state.lastResponse = null;
});

describe("channel helpers", () => {
  it("returns an Android channel id only on Android", () => {
    state.platform = "android";
    expect(channelIdFor("stock")).toBe("stock-alerts");
    state.platform = "ios";
    expect(channelIdFor("stock")).toBeUndefined();
  });

  it("carries the channel on the trigger only on Android", () => {
    state.platform = "android";
    expect(immediateTrigger("price")).toEqual({
      type: "timeInterval",
      seconds: 1,
      channelId: "price-alerts",
    });
    state.platform = "ios";
    expect(immediateTrigger("price")).toBeNull();
  });

  it("registers the three high-importance channels on Android", async () => {
    state.platform = "android";
    await setupAndroidNotificationChannel();
    expect(state.channels.map((c) => c.id)).toEqual([
      "stock-alerts",
      "price-alerts",
      "digest",
    ]);
    expect(state.channels[0]!.opts.importance).toBe(4);
  });

  it("is a no-op off Android", async () => {
    await setupAndroidNotificationChannel();
    expect(state.channels).toHaveLength(0);
  });
});

describe("native scheduling helpers", () => {
  it("schedules a stock alert with product details", async () => {
    const id = await scheduleStockAlert("CRS804", "Server2U", 480.5, "USD", "p1");
    expect(id).toBe("notif-id");
    expect(state.scheduled[0]!.content.title).toContain("Back In Stock");
    expect(state.scheduled[0]!.content.body).toContain("CRS804");
    expect(state.scheduled[0]!.content.data).toMatchObject({ productId: "p1" });
  });

  it("returns null for a stock alert when scheduling throws", async () => {
    state.failSchedule = true;
    expect(await scheduleStockAlert("CRS804", "Server2U", 480, "USD")).toBeNull();
  });

  it("returns null for a stock alert on web", async () => {
    state.platform = "web";
    expect(await scheduleStockAlert("CRS804", "Server2U", 480, "USD")).toBeNull();
  });

  it("schedules a restock-watch confirmation (not a restock alert)", async () => {
    const id = await scheduleStockWatchConfirmation("CRS804", "Server2U");
    expect(id).toBe("notif-id");
    expect(state.scheduled[0]!.content.title).toBe("Restock watch set");
  });

  it("schedules a price alert", async () => {
    const id = await schedulePriceAlert("CRS804", 450, "USD", "p1");
    expect(id).toBe("notif-id");
    expect(state.scheduled[0]!.content.body).toContain("450.00");
    state.platform = "web";
    expect(await schedulePriceAlert("CRS804", 450, "USD")).toBeNull();
  });
});

describe("sendTestNotification", () => {
  it("schedules on native when permission is granted", async () => {
    expect(await sendTestNotification()).toBe(true);
    expect(state.scheduled[0]!.content.title).toContain("Working");
  });

  it("returns false on native when permission is denied", async () => {
    state.perm = "denied";
    state.existingPerm = "denied";
    expect(await sendTestNotification()).toBe(false);
    expect(state.scheduled).toHaveLength(0);
  });

  it("returns false on native when scheduling throws", async () => {
    state.failSchedule = true;
    expect(await sendTestNotification()).toBe(false);
  });

  it("uses the Web Notification API on web", async () => {
    state.platform = "web";
    state.webPermission = "granted";
    state.displayWeb = true;
    expect(await sendTestNotification()).toBe(true);
  });

  it("returns false on web when permission is denied", async () => {
    state.platform = "web";
    state.webPermission = "denied";
    expect(await sendTestNotification()).toBe(false);
  });
});

describe("scheduleBackOrderReminder", () => {
  it("schedules a DATE trigger and adds the Android channel", async () => {
    state.platform = "android";
    const date = new Date("2026-11-01T10:00:00.000Z");
    const id = await scheduleBackOrderReminder("CRS804", "Server2U", date, "p1");
    expect(id).toBe("notif-id");
    expect(state.scheduled[0]!.trigger).toMatchObject({
      type: "date",
      date,
      channelId: "stock-alerts",
    });
  });

  it("returns null when permission is denied", async () => {
    state.perm = "denied";
    state.existingPerm = "denied";
    expect(
      await scheduleBackOrderReminder("CRS804", "Server2U", new Date()),
    ).toBeNull();
  });

  it("returns null on web", async () => {
    state.platform = "web";
    expect(
      await scheduleBackOrderReminder("CRS804", "Server2U", new Date()),
    ).toBeNull();
  });
});

describe("cancel helpers", () => {
  it("cancels a scheduled notification on native", async () => {
    await cancelNotification("n1");
    expect(state.cancelled).toEqual(["n1"]);
  });

  it("swallows a cancel failure", async () => {
    state.failCancel = true;
    await expect(cancelNotification("n1")).resolves.toBeUndefined();
  });

  it("cancels everything on native only", async () => {
    await cancelAllNotifications();
    expect(state.allCancelled).toBe(1);
    state.platform = "web";
    await cancelAllNotifications();
    expect(state.allCancelled).toBe(1);
  });
});

describe("sendPriceDigestNotification", () => {
  it("schedules and records the digest in history", async () => {
    expect(await sendPriceDigestNotification("Digest", "body")).toBe(true);
    expect(state.recorded[0]!.type).toBe("digest");
    expect(String(state.recorded[0]!.id)).toMatch(/^local-digest-\d{4}-\d{2}-\d{2}$/);
  });

  it("is suppressed during quiet hours", async () => {
    state.quiet = true;
    expect(await sendPriceDigestNotification("Digest", "body")).toBe(false);
    expect(state.scheduled).toHaveLength(0);
  });

  it("returns false when permission is denied", async () => {
    state.perm = "denied";
    state.existingPerm = "denied";
    expect(await sendPriceDigestNotification("Digest", "body")).toBe(false);
  });

  it("returns false on web", async () => {
    state.platform = "web";
    expect(await sendPriceDigestNotification("Digest", "body")).toBe(false);
  });

  it("returns false when scheduling throws", async () => {
    state.failSchedule = true;
    expect(await sendPriceDigestNotification("Digest", "body")).toBe(false);
  });
});

describe("scheduleServerEventNotification", () => {
  it("schedules on native with the server data merged in", async () => {
    expect(
      await scheduleServerEventNotification("Title", "Body", { eventId: "e1" }),
    ).toBe(true);
    expect(state.scheduled[0]!.content.data).toEqual({
      type: "server_event",
      eventId: "e1",
    });
  });

  it("returns false on native when permission is denied", async () => {
    state.perm = "denied";
    state.existingPerm = "denied";
    expect(await scheduleServerEventNotification("T", "B")).toBe(false);
  });

  it("returns false on native when scheduling throws", async () => {
    state.failSchedule = true;
    expect(await scheduleServerEventNotification("T", "B")).toBe(false);
  });

  it("delegates to the Web Notification API on web", async () => {
    state.platform = "web";
    state.displayWeb = false;
    expect(await scheduleServerEventNotification("T", "B")).toBe(false);
    expect(state.scheduled).toHaveLength(0);
  });
});

describe("setupPushEventTracking", () => {
  it("returns a no-op on web", () => {
    state.platform = "web";
    const cleanup = setupPushEventTracking();
    expect(state.receivedListeners).toHaveLength(0);
    expect(() => cleanup()).not.toThrow();
  });

  it("records event ids from received + tapped pushes and the last response", async () => {
    state.lastResponse = {
      notification: { request: { content: { data: { eventId: "startup" } } } },
    };
    const cleanup = setupPushEventTracking();
    expect(state.receivedListeners).toHaveLength(1);
    expect(state.responseListeners).toHaveLength(1);

    state.receivedListeners[0]!({
      request: { content: { data: { eventId: "foreground" } } },
    });
    state.responseListeners[0]!({
      notification: { request: { content: { data: { eventId: "tapped" } } } },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(state.displayedIds).toEqual(
      expect.arrayContaining(["foreground", "tapped", "startup"]),
    );
    cleanup();
  });

  it("ignores a non-string or empty event id", () => {
    setupPushEventTracking();
    state.receivedListeners[0]!({
      request: { content: { data: { eventId: 42 } } },
    });
    state.receivedListeners[0]!({ request: { content: { data: {} } } });
    expect(state.displayedIds).toHaveLength(0);
  });
});

describe("master notification switch", () => {
  it("does not schedule a back-order reminder when notifications are disabled", async () => {
    state.platform = "android";
    state.settings = { notificationsEnabled: false };
    expect(
      await scheduleBackOrderReminder("P", "D", new Date(Date.now() + 86_400_000), "p1"),
    ).toBeNull();
    expect(state.scheduled).toHaveLength(0);
  });

  it("does not schedule a restock-watch confirmation when notifications are disabled", async () => {
    state.platform = "android";
    state.settings = { notificationsEnabled: false };
    expect(await scheduleStockWatchConfirmation("P", "D")).toBeNull();
    expect(state.scheduled).toHaveLength(0);
  });
});
