import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import {
  uploadNotificationConfig,
  pullNotificationEvents,
  syncServerNotifications,
} from "../lib/server-notifications";

vi.mock("../lib/storage", () => ({
  getPendingHealthEvents: vi.fn(),
  clearPendingHealthEvents: vi.fn(),
  getAlerts: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getDisplayedEventIds: vi.fn().mockResolvedValue([]),
  recordDisplayedEventId: vi.fn().mockResolvedValue(undefined),
  recordNotificationEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn().mockResolvedValue("test-device"),
}));

vi.mock("../lib/notifications", () => ({
  scheduleServerEventNotification: vi.fn().mockResolvedValue(undefined),
}));

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockClient(handlers: {
  uploadConfig?: () => Promise<{ accepted: boolean }>;
  pull?: () => Promise<{ events: unknown[] }>;
}) {
  mockedCreateClient.mockReturnValue({
    notifications: {
      uploadConfig: { mutate: handlers.uploadConfig },
      pull: { query: handlers.pull },
    },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("uploadNotificationConfig", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads the config and returns true", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    mockClient({ uploadConfig: mutate });
    const ok = await uploadNotificationConfig("dev-1", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(ok).toBe(true);
    expect(mutate).toHaveBeenCalledWith({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
  });

  it("returns false when the mutate rejects", async () => {
    mockClient({
      uploadConfig: vi.fn().mockRejectedValue(new Error("network")),
    });
    const ok = await uploadNotificationConfig("dev-1", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(ok).toBe(false);
  });
});

describe("pullNotificationEvents", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("returns events from the server", async () => {
    const query = vi.fn().mockResolvedValue({ events: [{ id: "e1" }] });
    mockClient({ pull: query });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([{ id: "e1" }]);
    expect(query).toHaveBeenCalledWith({ deviceId: "dev-1" });
  });

  it("returns an empty array when the query rejects", async () => {
    mockClient({ pull: vi.fn().mockRejectedValue(new Error("network")) });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([]);
  });

  it("returns an empty array when the query times out", async () => {
    mockClient({
      pull: vi
        .fn()
        .mockImplementation(
          () =>
            new Promise<{ events: unknown[] }>((resolve) =>
              setTimeout(() => resolve({ events: [] }), 10_000),
            ),
        ),
    });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([]);
  });
});

describe("syncServerNotifications includes health events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes pending health events in uploadConfig call", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    const query = vi.fn().mockResolvedValue({ events: [] });
    mockClient({ uploadConfig: mutate, pull: query });

    const storage = await import("../lib/storage");
    vi.mocked(storage.getPendingHealthEvents).mockResolvedValue([
      {
        distributorId: "winncom",
        distributorName: "Winncom",
        status: "blocked",
        title: "🟠 Distributor Blocked",
        body: "Winncom has been blocked",
        createdAt: 1234,
      },
    ]);
    vi.mocked(storage.clearPendingHealthEvents).mockResolvedValue(undefined);

    await syncServerNotifications();

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        healthEvents: expect.arrayContaining([
          expect.objectContaining({ distributorId: "winncom" }),
        ]),
      }),
    );
    expect(storage.clearPendingHealthEvents).toHaveBeenCalled();
  });
});

describe("uploadNotificationConfig with healthEvents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes healthEvents in the mutate call", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    mockClient({ uploadConfig: mutate });
    const ok = await uploadNotificationConfig(
      "dev-1",
      {
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      },
      [
        {
          id: "health-winncom-blocked-1234",
          distributorId: "winncom",
          distributorName: "Winncom",
          status: "blocked",
          title: "🟠 Distributor Blocked",
          body: "Winncom has been blocked for 3 consecutive probes",
          createdAt: 1234,
        },
      ],
    );
    expect(ok).toBe(true);
    expect(mutate).toHaveBeenCalledWith({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [],
      dateReminders: [],
      healthEvents: [
        {
          id: "health-winncom-blocked-1234",
          distributorId: "winncom",
          distributorName: "Winncom",
          status: "blocked",
          title: "🟠 Distributor Blocked",
          body: "Winncom has been blocked for 3 consecutive probes",
          createdAt: 1234,
        },
      ],
    });
  });
});
