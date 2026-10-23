// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackOrderReminder } from "../lib/types";

const state = vi.hoisted(() => ({
  reminders: [] as BackOrderReminder[],
  watches: [] as BackOrderReminder[],
  loadRejects: false,
  removeRejects: false,
  confirm: true,
  removedReminders: [] as string[],
  removedWatches: [] as string[],
}));

vi.mock("../desktop/src/storage", () => ({
  storage: {
    getBackOrderReminders: vi.fn(async () => {
      if (state.loadRejects) throw new Error("storage unavailable");
      return state.reminders;
    }),
    getStockWatches: vi.fn(async () => state.watches),
    removeBackOrderReminder: vi.fn(async (id: string) => {
      if (state.removeRejects) throw new Error("quota");
      state.removedReminders.push(id);
    }),
    removeStockWatch: vi.fn(async (id: string) => {
      if (state.removeRejects) throw new Error("quota");
      state.removedWatches.push(id);
    }),
  },
}));

vi.mock("../desktop/src/lib/confirm", () => ({
  confirmAction: vi.fn(async () => state.confirm),
}));

import { useRemindersData } from "../desktop/src/hooks/use-reminders-data";

const reminder: BackOrderReminder = {
  id: "r1",
  productId: "p1",
  productName: "Test",
  distributorId: "d1",
  distributorName: "Dist",
  reminderDate: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const watch: BackOrderReminder = {
  ...reminder,
  id: "w1",
  reminderType: "back_in_stock",
};

describe("useRemindersData", () => {
  beforeEach(() => {
    state.reminders = [reminder];
    state.watches = [watch];
    state.loadRejects = false;
    state.removeRejects = false;
    state.confirm = true;
    state.removedReminders = [];
    state.removedWatches = [];
  });

  it("loads reminders and watches", async () => {
    const { result } = renderHook(() =>
      useRemindersData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.remindersLoading).toBe(false));
    expect(result.current.reminders).toHaveLength(1);
    expect(result.current.watches).toHaveLength(1);
  });

  it("surfaces a load failure", async () => {
    state.loadRejects = true;
    const { result } = renderHook(() =>
      useRemindersData({ showToast: vi.fn() }),
    );
    await waitFor(() =>
      expect(result.current.remindersError).toBe("storage unavailable"),
    );
  });

  it("deletes a reminder after confirmation", async () => {
    const { result } = renderHook(() =>
      useRemindersData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.remindersLoading).toBe(false));
    await act(async () => {
      await result.current.handleDeleteReminder("r1");
    });
    expect(state.removedReminders).toEqual(["r1"]);
    expect(result.current.reminders).toHaveLength(0);
  });

  it("keeps the reminder when the confirm is dismissed", async () => {
    state.confirm = false;
    const { result } = renderHook(() =>
      useRemindersData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.remindersLoading).toBe(false));
    await act(async () => {
      await result.current.handleDeleteReminder("r1");
    });
    expect(state.removedReminders).toHaveLength(0);
    expect(result.current.reminders).toHaveLength(1);
  });

  it("deletes a stock watch after confirmation", async () => {
    const { result } = renderHook(() =>
      useRemindersData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.remindersLoading).toBe(false));
    await act(async () => {
      await result.current.handleDeleteWatch("w1");
    });
    expect(state.removedWatches).toEqual(["w1"]);
    expect(result.current.watches).toHaveLength(0);
  });

  it("reports a delete failure", async () => {
    state.removeRejects = true;
    const showToast = vi.fn();
    const { result } = renderHook(() => useRemindersData({ showToast }));
    await waitFor(() => expect(result.current.remindersLoading).toBe(false));
    await act(async () => {
      await result.current.handleDeleteReminder("r1");
    });
    expect(showToast).toHaveBeenCalledWith(
      "Couldn't cancel that reminder. Please try again.",
    );
    expect(result.current.reminders).toHaveLength(1);
  });
});
