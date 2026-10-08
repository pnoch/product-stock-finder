import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn(async () => "notif-id"),
}));

vi.mock("../lib/storage", () => ({
  getSettings: vi.fn(async () => ({})),
  recordNotificationEvent: vi.fn(async () => {}),
  recordDisplayedEventId: vi.fn(async () => {}),
}));

import * as Notifications from "expo-notifications";
import { scheduleStockAlert } from "../lib/notifications";

describe("scheduleStockAlert", () => {
  it("carries the store url and distributor id in the payload", async () => {
    await scheduleStockAlert(
      "CRS804",
      "Getic",
      209,
      "USD",
      "p1",
      "getic-gr",
      "https://getic.example/p/crs804",
    );
    const call = (
      Notifications.scheduleNotificationAsync as unknown as {
        mock: { calls: unknown[][] };
      }
    ).mock.calls[0]![0] as {
      content: { data: Record<string, unknown> };
    };
    expect(call.content.data).toMatchObject({
      type: "stock_alert",
      productId: "p1",
      distributorId: "getic-gr",
      url: "https://getic.example/p/crs804",
    });
  });
});
