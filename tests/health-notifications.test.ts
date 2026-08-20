import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  scheduled: [] as Array<{ content: { title: string; body: string } }>,
  recorded: [] as Array<Record<string, unknown>>,
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
  scheduleNotificationAsync: vi.fn(
    async (opts: { content: { title: string; body: string } }) => {
      state.scheduled.push(opts);
      return "notif-id";
    },
  ),
}));

vi.mock("../lib/storage", () => ({
  recordDisplayedEventId: vi.fn(),
  recordNotificationEvent: vi.fn(async (event: Record<string, unknown>) => {
    state.recorded.push(event);
  }),
}));

vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn(),
}));

import { scheduleHealthAlert, scheduleHealthRecovery } from "../lib/notifications";

describe("scheduleHealthAlert history recording", () => {
  beforeEach(() => {
    state.platform = "ios";
    state.scheduled.length = 0;
    state.recorded.length = 0;
  });

  it("records a health entry with status blocked after scheduling", async () => {
    await scheduleHealthAlert("Winncom", "blocked", "blocked by site");
    expect(state.recorded).toHaveLength(1);
    const entry = state.recorded[0] as Record<string, unknown>;
    expect(entry.type).toBe("health");
    expect(entry.healthStatus).toBe("blocked");
    expect(entry.distributorId).toBe("Winncom");
    expect(entry.title).toContain("Blocked");
    expect(entry.body).toContain("Winncom");
  });

  it("records a health entry with status error", async () => {
    await scheduleHealthAlert("Winncom", "error");
    const entry = state.recorded[0] as Record<string, unknown>;
    expect(entry.healthStatus).toBe("error");
    expect(entry.title).toContain("Down");
  });

  it("displays a web notification and records history on web", async () => {
    state.platform = "web";
    await scheduleHealthAlert("Winncom", "blocked");
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0].healthStatus).toBe("blocked");
  });
});

describe("scheduleHealthRecovery history recording", () => {
  beforeEach(() => {
    state.platform = "ios";
    state.scheduled.length = 0;
    state.recorded.length = 0;
  });

  it("records a health entry with status recovered", async () => {
    await scheduleHealthRecovery("Winncom", "error");
    const entry = state.recorded[0] as Record<string, unknown>;
    expect(entry.type).toBe("health");
    expect(entry.healthStatus).toBe("recovered");
    expect(entry.distributorId).toBe("Winncom");
    expect(entry.title).toContain("Recovered");
  });

  it("does not record on web", async () => {
    state.platform = "web";
    await scheduleHealthRecovery("Winncom", "error");
    expect(state.recorded).toHaveLength(0);
  });
});
