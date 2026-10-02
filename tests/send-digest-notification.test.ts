// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  scheduled: [] as unknown[],
  recorded: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn(async (req: unknown) => {
    state.scheduled.push(req);
    return "notif-id";
  }),
  getPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
}));

vi.mock("../lib/storage", () => ({
  getSettings: vi.fn(async () => ({ notificationsEnabled: true })),
  recordNotificationEvent: vi.fn(async (e: Record<string, unknown>) => {
    state.recorded.push(e);
  }),
  recordDisplayedEventId: vi.fn(),
}));

vi.mock("../lib/quiet-hours", () => ({ isInQuietHours: () => false }));

import { sendPriceDigestNotification } from "../lib/notifications";

// QA round 293: the periodic digest was the only delivered notification not
// written to the in-app history, so the Notification Center's counts diverged
// from what was actually delivered (server-batched digests ARE recorded).
describe("sendPriceDigestNotification history", () => {
  beforeEach(() => {
    state.scheduled = [];
    state.recorded = [];
  });

  it("records the digest in the in-app history when delivered", async () => {
    await expect(
      sendPriceDigestNotification("Price Digest", "• CRS804 dropped"),
    ).resolves.toBe(true);
    expect(state.scheduled).toHaveLength(1);
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0]).toMatchObject({
      type: "digest",
      title: "Price Digest",
    });
    expect(String(state.recorded[0]!.id)).toMatch(/^local-digest-\d{4}-\d{2}-\d{2}$/);
  });

  it("does not record when the notification could not be scheduled", async () => {
    const notif = await import("expo-notifications");
    vi.mocked(notif.scheduleNotificationAsync).mockRejectedValueOnce(
      new Error("boom"),
    );
    await expect(sendPriceDigestNotification("t", "b")).resolves.toBe(false);
    expect(state.recorded).toHaveLength(0);
  });
});
