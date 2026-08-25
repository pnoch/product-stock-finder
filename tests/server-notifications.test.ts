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
import type { AppSettings } from "../lib/types";

vi.mock("../lib/storage", () => ({
  getPendingHealthEvents: vi.fn().mockResolvedValue([]),
  clearPendingHealthEvents: vi.fn(),
  getAlerts: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getDisplayedEventIds: vi.fn().mockResolvedValue([]),
  recordDisplayedEventId: vi.fn().mockResolvedValue(undefined),
  recordNotificationEvent: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "daily",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
    digestFrequency: "off",
  }),
}));

function makeSettings(
  overrides: Partial<AppSettings> = {},
): AppSettings {
  return {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "daily",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
    digestFrequency: "off",
    ...overrides,
  };
}

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

describe("uploadNotificationConfig timeout semantics", () => {
  it("returns false when the mutate does not settle before the timeout", async () => {
    vi.useFakeTimers();
    try {
      mockClient({
        uploadConfig: () => new Promise(() => {}),
      });
      const promise = uploadNotificationConfig("dev-1", {
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      });
      const assertion = expect(promise).resolves.toBe(false);
      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("syncServerNotifications respects notification settings", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const storage = await import("../lib/storage");
    vi.mocked(storage.getSettings).mockResolvedValue(makeSettings());
    vi.mocked(storage.getPendingHealthEvents).mockResolvedValue([]);
  });

  function pendingHealthEvent() {
    return {
      distributorId: "winncom",
      distributorName: "Winncom",
      status: "blocked" as const,
      title: "🟠 Distributor Blocked",
      body: "Winncom has been blocked",
      createdAt: 1234,
    };
  }

  it("uploads an empty config and skips pull when the master toggle is off", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    const query = vi.fn().mockResolvedValue({ events: [] });
    mockClient({ uploadConfig: mutate, pull: query });

    const storage = await import("../lib/storage");
    vi.mocked(storage.getSettings).mockResolvedValue(
      makeSettings({ notificationsEnabled: false }),
    );

    await syncServerNotifications();

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      }),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("drops buffered health events without uploading when disabled", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    mockClient({ uploadConfig: mutate, pull: vi.fn() });

    const storage = await import("../lib/storage");
    vi.mocked(storage.getSettings).mockResolvedValue(
      makeSettings({ notificationsEnabled: false }),
    );
    vi.mocked(storage.getPendingHealthEvents).mockResolvedValue([
      pendingHealthEvent(),
    ]);

    await syncServerNotifications();

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ healthEvents: undefined }),
    );
    expect(storage.clearPendingHealthEvents).toHaveBeenCalled();
  });

  it("keeps buffered health events when the upload fails", async () => {
    mockClient({
      uploadConfig: vi.fn().mockRejectedValue(new Error("network")),
      pull: vi.fn().mockResolvedValue({ events: [] }),
    });

    const storage = await import("../lib/storage");
    vi.mocked(storage.getPendingHealthEvents).mockResolvedValue([
      pendingHealthEvent(),
    ]);

    await syncServerNotifications();

    expect(storage.clearPendingHealthEvents).not.toHaveBeenCalled();
  });

  it("keeps buffered health events when the upload times out", async () => {
    vi.useFakeTimers();
    try {
      mockClient({
        uploadConfig: () => new Promise(() => {}),
        pull: vi.fn().mockResolvedValue({ events: [] }),
      });

      const storage = await import("../lib/storage");
      vi.mocked(storage.getPendingHealthEvents).mockResolvedValue([
        pendingHealthEvent(),
      ]);

      const sync = syncServerNotifications();
      await vi.advanceTimersByTimeAsync(5000);
      await sync;

      expect(storage.clearPendingHealthEvents).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("filters uploads by category flags", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    mockClient({ uploadConfig: mutate, pull: vi.fn().mockResolvedValue({ events: [] }) });

    const storage = await import("../lib/storage");
    vi.mocked(storage.getSettings).mockResolvedValue(
      makeSettings({ priceAlerts: false, healthAlerts: false }),
    );
    vi.mocked(storage.getAlerts).mockResolvedValue([
      {
        id: "a1",
        productId: "p1",
        targetPrice: 100,
        currency: "USD",
        isActive: true,
        createdAt: "2026-01-01",
      },
    ] as never);
    vi.mocked(storage.getStockWatches).mockResolvedValue([
      {
        id: "w1",
        productId: "p1",
        distributorId: "d1",
        lastKnownStatus: "out_of_stock",
      },
    ] as never);
    vi.mocked(storage.getPendingHealthEvents).mockResolvedValue([
      pendingHealthEvent(),
    ]);

    await syncServerNotifications();

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: [],
        stockWatches: [expect.objectContaining({ id: "w1" })],
        healthEvents: undefined,
      }),
    );
    expect(storage.clearPendingHealthEvents).toHaveBeenCalled();
  });
});
