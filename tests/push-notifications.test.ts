import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

const sent = vi.hoisted(() => [] as unknown[]);

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken = (value: unknown) =>
      typeof value === "string" && value.startsWith("ExponentPushToken");
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    async sendPushNotificationsAsync(chunk: unknown) {
      sent.push(chunk);
    }
  },
}));

import { upsertPushToken, sendPushForDevice, clearPushTokensForTests } from "../server/push-notifications";

const event = { id: "evt-1", title: "💸 Price Drop Alert!", body: "CRS804 is now $480.00!" };

describe("push-notifications", () => {
  beforeEach(() => {
    clearPushTokensForTests();
    sent.length = 0;
  });

  it("pushes events for a device that registered a token", async () => {
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      {
        to: "ExponentPushToken[abc123]",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        data: { eventId: "evt-1" },
      },
    ]);
  });

  it("no-ops when the device has no registered token", async () => {
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });

  it("no-ops when the stored token is not a valid Expo push token", async () => {
    await upsertPushToken("dev-1", "not-an-expo-token", "android");
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });

  it("no-ops when there are no events", async () => {
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    await sendPushForDevice("dev-1", []);
    expect(sent).toHaveLength(0);
  });
});
