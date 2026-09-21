import { describe, expect, it, vi, beforeEach } from "vitest";

// Android selects the notification channel from the TRIGGER, not from
// `content`. expo-notifications ignores `content.channelId` when
// `trigger: null` and logs "Couldn't get channel for the notifications",
// falling back to a default channel — so the configured HIGH importance,
// sound, and vibration were never applied to immediate notifications.
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval", DATE: "date" },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(async () => "id"),
  getPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  setNotificationHandler: vi.fn(),
  addNotificationReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  getLastNotificationResponseAsync: vi.fn(async () => null),
  cancelScheduledNotificationAsync: vi.fn(),
}));

import { immediateTrigger, channelIdFor } from "../lib/notifications";

describe("immediateTrigger carries the Android channel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a time-interval trigger with the channelId on Android", () => {
    const trigger = immediateTrigger("price");
    expect(trigger).toMatchObject({
      type: "timeInterval",
      seconds: 1,
      channelId: channelIdFor("price"),
    });
  });

  it("uses the channel for each kind", () => {
    expect(immediateTrigger("stock")).toMatchObject({
      channelId: channelIdFor("stock"),
    });
    expect(immediateTrigger("digest")).toMatchObject({
      channelId: channelIdFor("digest"),
    });
  });

  it("never returns a bare null trigger on Android (which loses the channel)", () => {
    expect(immediateTrigger("price")).not.toBeNull();
  });
});
