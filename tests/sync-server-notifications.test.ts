import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  deviceId: "dev-1",
  alerts: [] as Record<string, unknown>[],
  stockWatches: [] as Record<string, unknown>[],
  dateReminders: [] as Record<string, unknown>[],
  pulledEvents: [] as Record<string, unknown>[],
  displayed: [] as string[],
  recorded: [] as string[],
  historyRecorded: [] as Record<string, unknown>[],
  rendered: [] as Record<string, unknown>[],
  renderData: [] as ({ productId?: string; type?: string } | undefined)[],
  deactivated: [] as Record<string, unknown>[],
  pendingHealth: [] as Record<string, unknown>[],
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(() => ({
    notifications: {
      uploadConfig: { mutate: vi.fn(async () => ({ accepted: true })) },
      pull: { query: vi.fn(async () => ({ events: state.pulledEvents })) },
    },
  })),
}));

vi.mock("../lib/device-id", () => ({
  getDeviceId: vi.fn(async () => state.deviceId),
}));

vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn(async () => state.alerts),
  getStockWatches: vi.fn(async () => state.stockWatches),
  getBackOrderReminders: vi.fn(async () => state.dateReminders),
  getDisplayedEventIds: vi.fn(async () => state.displayed),
  recordDisplayedEventId: vi.fn(async (id: string) => {
    state.recorded.push(id);
  }),
  recordNotificationEvent: vi.fn(async (event: Record<string, unknown>) => {
    state.historyRecorded.push(event);
  }),
  deactivateAlert: vi.fn(async (alertId: string, price: number) => {
    state.deactivated.push({ alertId, price });
  }),
  removeStockWatch: vi.fn(async () => {}),
  removeBackOrderReminder: vi.fn(async () => {}),
  getPendingHealthEvents: vi.fn(async () => state.pendingHealth),
  savePendingHealthEvents: vi.fn(async (events: unknown[]) => {
    state.pendingHealth = events as never;
  }),
  clearPendingHealthEvents: vi.fn(async () => {}),
  getSettings: vi.fn(async () => ({
    notificationsEnabled: true,
    priceAlerts: true,
    stockAlerts: true,
    healthAlerts: true,
  })),
}));

vi.mock("../lib/notifications", () => ({
  scheduleServerEventNotification: vi.fn(
    async (
      title: string,
      body: string,
      data?: { productId?: string; type?: string },
    ) => {
      state.rendered.push({ title, body });
      state.renderData.push(data);
      // Return true so the caller records the event as displayed.
      return true;
    },
  ),
}));

import { syncServerNotifications } from "../lib/server-notifications";

const priceDropEvent = {
  id: "evt-1",
  type: "price_drop",
  alertId: "a1",
  triggeredPrice: 480,
  title: "Price dropped",
  body: "CRS804 below $500",
  createdAt: 1,
};

const activeAlert = {
  id: "a1",
  productId: "p1",
  targetPrice: 500,
  currency: "USD",
  isActive: true,
  createdAt: "2026-01-01",
};

beforeEach(() => {
  state.alerts = [activeAlert];
  state.stockWatches = [];
  state.dateReminders = [];
  state.pulledEvents = [];
  state.displayed = [];
  state.recorded = [];
  state.historyRecorded = [];
  state.rendered = [];
  state.renderData = [];
  state.deactivated = [];
  state.pendingHealth = [];
});

describe("syncServerNotifications dedup", () => {
  it("renders and records a new event", async () => {
    state.pulledEvents = [priceDropEvent];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(1);
    expect(state.recorded).toEqual(["evt-1"]);
    expect(state.historyRecorded).toHaveLength(1);
    expect(state.historyRecorded[0]!.id).toBe("evt-1");
    expect(state.deactivated).toEqual([{ alertId: "a1", price: 480 }]);
  });

  it("keeps health events that arrive while the upload is in flight", async () => {
    // A health sweep appends during the network upload; clearing the whole key
    // discarded those un-uploaded events (other devices never received them).
    state.pendingHealth = [
      { id: "h1", distributorId: "d1", distributorName: "D1", status: "blocked", title: "t", body: "b", createdAt: 1 },
    ];
    const storage = await import("../lib/storage");
    vi.mocked(storage.getPendingHealthEvents)
      .mockResolvedValueOnce([
        { id: "h1", distributorId: "d1", distributorName: "D1", status: "blocked", title: "t", body: "b", createdAt: 1 },
      ] as never)
      .mockResolvedValueOnce([
        { id: "h1", distributorId: "d1", distributorName: "D1", status: "blocked", title: "t", body: "b", createdAt: 1 },
        { id: "h2", distributorId: "d2", distributorName: "D2", status: "blocked", title: "t2", body: "b2", createdAt: 2 },
      ] as never);
    await syncServerNotifications();
    expect(vi.mocked(storage.savePendingHealthEvents)).toHaveBeenCalledWith([
      expect.objectContaining({ id: "h2" }),
    ]);
  });

  it("does not record a stale event the client already handled locally", async () => {
    // The local check fired and deactivated the alert; the server's copy has a
    // different id, so recording it too put two unread entries (and a doubled
    // badge) in the Notification Center for one price drop.
    state.pulledEvents = [priceDropEvent];
    state.alerts = []; // alert already deactivated locally
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(0);
    expect(state.historyRecorded).toHaveLength(0);
  });

  it("passes the event type through so tap routing reaches /stats and /health", async () => {
    // Without the type, the locally-shown copy is tagged "server_event" and
    // notificationRouteFor cannot map a digest/health tap.
    state.pulledEvents = [
      {
        id: "evt-health",
        type: "health",
        alertId: null,
        title: "Distributor down",
        body: "Winncom has been blocked",
        createdAt: 2,
      },
    ];
    await syncServerNotifications();
    expect(state.renderData.at(-1)).toMatchObject({ type: "health" });
  });

  it("suppresses a restock event for a watch the client already removed", async () => {
    state.stockWatches = [];
    state.pulledEvents = [
      {
        id: "evt-restock",
        type: "restock",
        watchId: "w-gone",
        title: "Back in stock",
        body: "CRS804 is available",
        createdAt: 3,
      },
    ];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(0);
    expect(state.recorded).toEqual([]);
  });

  it("still renders a restock event for a watch the client still holds", async () => {
    state.stockWatches = [{ id: "w-live" }];
    state.pulledEvents = [
      {
        id: "evt-restock-2",
        type: "restock",
        watchId: "w-live",
        title: "Back in stock",
        body: "CRS804 is available",
        createdAt: 3,
      },
    ];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(1);
  });

  it("skips rendering AND reconciling an already-displayed event", async () => {
    // A replayed event must not re-run reconciliation: stock-watch ids are
    // deterministic, so re-reconciling would delete a watch the user
    // re-created after the first delivery.
    state.displayed = ["evt-1"];
    state.pulledEvents = [priceDropEvent];
    await syncServerNotifications();
    expect(state.rendered).toHaveLength(0);
    expect(state.recorded).toEqual([]);
    expect(state.historyRecorded).toHaveLength(1);
    expect(state.deactivated).toEqual([]);
  });
});
