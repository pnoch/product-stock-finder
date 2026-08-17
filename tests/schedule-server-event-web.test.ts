// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "web",
  displayed: [] as Array<{ title: string; body: string }>,
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
  scheduleNotificationAsync: vi.fn(),
}));

vi.mock("../lib/storage", () => ({
  recordDisplayedEventId: vi.fn(),
}));

vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn((title: string, body: string) => {
    state.displayed.push({ title, body });
  }),
}));

import { scheduleServerEventNotification } from "../lib/notifications";

describe("scheduleServerEventNotification on web", () => {
  beforeEach(() => {
    state.platform = "web";
    state.displayed = [];
  });

  it("delegates to displayWebNotification on web", async () => {
    await scheduleServerEventNotification("Price drop!", "CRS804 is $89");
    expect(state.displayed).toEqual([
      { title: "Price drop!", body: "CRS804 is $89" },
    ]);
  });
});