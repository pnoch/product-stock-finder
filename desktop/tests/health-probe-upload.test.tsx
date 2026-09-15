import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  pending: [] as Array<Record<string, unknown>>,
  mutateInput: null as Record<string, unknown> | null,
  mutateCalls: 0,
  pullCalls: 0,
  shouldFail: false,
  hang: false,
  clearCalls: 0,
  notificationsEnabled: true,
  deferMutate: false,
  deferredPromise: null as Promise<unknown> | null,
}));

vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({
    notifications: {
      uploadConfig: {
        mutate: async (input: unknown) => {
          state.mutateCalls += 1;
          state.mutateInput = input as Record<string, unknown>;
          if (state.shouldFail) throw new Error("down");
          if (state.hang) return new Promise(() => {});
          if (state.deferMutate && state.deferredPromise)
            return state.deferredPromise;
          return { accepted: true };
        },
      },
      pull: {
        query: async () => {
          state.pullCalls += 1;
          return { events: [] };
        },
      },
    },
  }),
}));

vi.mock("../src/storage", () => ({
  storage: {
    getSettings: async () => ({
      notificationsEnabled: state.notificationsEnabled,
      priceAlerts: true,
      stockAlerts: true,
      healthAlerts: true,
    }),
    getAlerts: async () => [],
    getStockWatches: async () => [],
    getBackOrderReminders: async () => [],
    getPendingHealthEvents: async () => [...state.pending],
    savePendingHealthEvents: async () => {},
    clearPendingHealthEvents: async () => {
      state.clearCalls += 1;
    },
    deactivateAlert: async () => {},
    removeStockWatch: async () => {},
    removeBackOrderReminder: async () => {},
  },
}));

vi.mock("../src/notifications", () => ({
  sendDesktopNotification: vi.fn(),
}));

import { syncDesktopNotifications } from "../src/server-notifications";

describe("health-probe upload", () => {
  beforeEach(() => {
    state.pending = [];
    state.mutateInput = null;
    state.mutateCalls = 0;
    state.pullCalls = 0;
    state.shouldFail = false;
    state.hang = false;
    state.clearCalls = 0;
    state.notificationsEnabled = true;
    state.deferMutate = false;
    state.deferredPromise = null;
    vi.useRealTimers();
  });

  it("includes pending health events in upload and clears on success", async () => {
    state.pending = [
      {
        distributorId: "d1",
        distributorName: "D1",
        status: "blocked",
        title: "t",
        body: "b",
        createdAt: 1,
      },
    ];
    await syncDesktopNotifications();
    expect(state.mutateInput).toMatchObject({
      healthEvents: [
        {
          id: "health-d1-blocked-1",
          distributorId: "d1",
          distributorName: "D1",
          status: "blocked",
          title: "t",
          body: "b",
          createdAt: 1,
        },
      ],
    });
    expect(state.clearCalls).toBe(1);
  });

  it("passes through entries that already carry an id", async () => {
    state.pending = [
      {
        id: "custom-id",
        distributorId: "d1",
        distributorName: "D1",
        status: "error",
        title: "t",
        body: "b",
        createdAt: 2,
      },
    ];
    await syncDesktopNotifications();
    expect(state.mutateInput).toMatchObject({
      healthEvents: [
        {
          id: "custom-id",
          distributorId: "d1",
          distributorName: "D1",
          status: "error",
          title: "t",
          body: "b",
          createdAt: 2,
        },
      ],
    });
    expect(state.clearCalls).toBe(1);
  });

  it("retains the queue when upload fails", async () => {
    state.pending = [
      {
        distributorId: "d1",
        distributorName: "D1",
        status: "blocked",
        title: "t",
        body: "b",
        createdAt: 1,
      },
    ];
    state.shouldFail = true;
    await syncDesktopNotifications();
    expect(state.clearCalls).toBe(0);
  });

  it("retains the queue when upload times out", async () => {
    state.pending = [
      {
        distributorId: "d1",
        distributorName: "D1",
        status: "blocked",
        title: "t",
        body: "b",
        createdAt: 1,
      },
    ];
    state.hang = true;
    vi.useFakeTimers();
    try {
      const pending = syncDesktopNotifications();
      await vi.advanceTimersByTimeAsync(4100);
      await pending;
      expect(state.clearCalls).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shares one upload across overlapping syncs", async () => {
    let resolveMutate!: (value: unknown) => void;
    state.deferredPromise = new Promise((resolve) => {
      resolveMutate = resolve;
    });
    state.deferMutate = true;
    const first = syncDesktopNotifications();
    const second = syncDesktopNotifications();
    resolveMutate({ accepted: true });
    await Promise.all([first, second]);
    expect(state.mutateCalls).toBe(1);
  });

  it("retracts config and skips pull when the master switch is off", async () => {
    state.notificationsEnabled = false;
    state.pending = [
      {
        distributorId: "d1",
        distributorName: "D1",
        status: "blocked",
        title: "t",
        body: "b",
        createdAt: 1,
      },
    ];
    await syncDesktopNotifications();
    expect(state.mutateInput).toMatchObject({
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(state.mutateInput).not.toHaveProperty("healthEvents");
    expect(state.clearCalls).toBe(1);
    expect(state.pullCalls).toBe(0);
  });
});
