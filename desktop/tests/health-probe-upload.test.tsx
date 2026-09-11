import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  pending: [] as Array<Record<string, unknown>>,
  mutateInput: null as Record<string, unknown> | null,
  shouldFail: false,
  clearCalls: 0,
}));

vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({
    notifications: {
      uploadConfig: {
        mutate: async (input: unknown) => {
          state.mutateInput = input as Record<string, unknown>;
          if (state.shouldFail) throw new Error("down");
          return { accepted: true };
        },
      },
      pull: {
        query: async () => ({ events: [] }),
      },
    },
  }),
}));

vi.mock("../src/storage", () => ({
  storage: {
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
    state.shouldFail = false;
    state.clearCalls = 0;
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
});
