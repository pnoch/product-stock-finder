import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  recorded: [] as string[],
  receivedHandler: null as null | ((notification: unknown) => void),
  responseHandler: null as null | ((response: unknown) => void),
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
  addNotificationReceivedListener: vi.fn(
    (handler: (notification: unknown) => void) => {
      state.receivedHandler = handler;
      return { remove: vi.fn() };
    },
  ),
  addNotificationResponseReceivedListener: vi.fn(
    (handler: (response: unknown) => void) => {
      state.responseHandler = handler;
      return { remove: vi.fn() };
    },
  ),
  getLastNotificationResponseAsync: vi.fn(async () => state.lastResponse),
}));

vi.mock("../lib/storage", () => ({
  recordDisplayedEventId: vi.fn(async (id: string) => {
    state.recorded.push(id);
  }),
}));

import { setupPushEventTracking } from "../lib/notifications";

describe("setupPushEventTracking", () => {
  beforeEach(() => {
    state.platform = "ios";
    state.recorded.length = 0;
    state.receivedHandler = null;
    state.responseHandler = null;
    state.lastResponse = null;
  });

  it("records the eventId of a received push notification", () => {
    state.platform = "ios";
    const stop = setupPushEventTracking();
    state.receivedHandler?.({
      request: { content: { data: { eventId: "e1" } } },
    });
    expect(state.recorded).toEqual(["e1"]);
    stop();
  });

  it("records the eventId of a notification the user tapped", () => {
    state.platform = "ios";
    const stop = setupPushEventTracking();
    state.responseHandler?.({
      notification: { request: { content: { data: { eventId: "e2" } } } },
    });
    expect(state.recorded).toEqual(["e2"]);
    stop();
  });

  it("records the eventId of the notification that launched the app", async () => {
    state.platform = "ios";
    state.lastResponse = {
      notification: { request: { content: { data: { eventId: "e3" } } } },
    };
    setupPushEventTracking();
    await vi.waitFor(() => expect(state.recorded).toEqual(["e3"]));
  });

  it("ignores notifications without an eventId", () => {
    state.platform = "ios";
    const stop = setupPushEventTracking();
    state.receivedHandler?.({ request: { content: { data: {} } } });
    expect(state.recorded).toEqual([]);
    stop();
  });

  it("is a no-op on web and does not register listeners", () => {
    state.platform = "web";
    const stop = setupPushEventTracking();
    expect(state.receivedHandler).toBeNull();
    expect(state.recorded).toEqual([]);
    stop();
  });
});
