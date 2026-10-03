import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios",
  scheduled: [] as { content: { title: string; body: string } }[],
  recorded: [] as Record<string, unknown>[],
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
import { displayWebNotification } from "../lib/web-notifications";

// The web branch now bails when nothing was shown, so the success-path tests
// need the mock to report a shown notification.
beforeEach(() => {
  vi.mocked(displayWebNotification).mockReturnValue(true);
});

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

  it("displays a web notification and records history on web", async () => {
    state.platform = "web";
    await scheduleHealthRecovery("Winncom", "error");
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0].healthStatus).toBe("recovered");
  });
});

describe("scheduleHealthAlert records displayedEventId", () => {
  it("records the event id as displayed after scheduling", async () => {
    state.platform = "ios";
    state.scheduled.length = 0;
    state.recorded.length = 0;
    await scheduleHealthAlert("Winncom", "blocked");
    const recorded = state.recorded[0] as Record<string, unknown>;
    expect(recorded.id).toMatch(/^health-winncom-blocked-\d+$/);
  });
});

describe("health notifications on web", () => {
  beforeEach(() => {
    state.platform = "web";
    state.scheduled.length = 0;
    state.recorded.length = 0;
  });

  it("does not record a delivery when the web notification cannot be shown", async () => {
    const { displayWebNotification } = await import("../lib/web-notifications");
    vi.mocked(displayWebNotification).mockReturnValue(false);
    // The caller records the event as delivered (and the server dedups on it),
    // so a failed display must return null rather than consume the alert.
    expect(await scheduleHealthAlert("Winncom", "blocked")).toBeNull();
    expect(state.recorded).toHaveLength(0);
  });

  it("records the delivery when the web notification is shown", async () => {
    const { displayWebNotification } = await import("../lib/web-notifications");
    vi.mocked(displayWebNotification).mockReturnValue(true);
    const result = await scheduleHealthAlert("Winncom", "blocked");
    expect(result?.eventId).toContain("health-winncom-blocked");
    expect(state.recorded).toHaveLength(1);
  });

  it("does not record a recovery when the web notification cannot be shown", async () => {
    const { displayWebNotification } = await import("../lib/web-notifications");
    vi.mocked(displayWebNotification).mockReturnValue(false);
    expect(await scheduleHealthRecovery("Winncom", "blocked")).toBeNull();
    expect(state.recorded).toHaveLength(0);
  });
});
