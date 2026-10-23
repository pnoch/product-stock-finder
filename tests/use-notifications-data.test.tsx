// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationHistoryEntry } from "../lib/types";

const state = vi.hoisted(() => ({
  history: [] as NotificationHistoryEntry[],
  unread: 0,
  loadRejects: false,
  markRejects: false,
  markedRead: [] as string[],
  markedAll: 0,
  synced: 0,
}));

vi.mock("../desktop/src/storage", () => ({
  storage: {
    getNotificationHistory: vi.fn(async () => {
      if (state.loadRejects) throw new Error("storage unavailable");
      return state.history;
    }),
    getUnreadNotificationCount: vi.fn(async () => state.unread),
    markNotificationRead: vi.fn(async (id: string) => {
      if (state.markRejects) throw new Error("quota");
      state.markedRead.push(id);
    }),
    markAllNotificationsRead: vi.fn(async () => {
      if (state.markRejects) throw new Error("quota");
      state.markedAll += 1;
    }),
  },
}));

vi.mock("../desktop/src/server-notifications", () => ({
  syncDesktopNotifications: vi.fn(async () => {
    state.synced += 1;
  }),
}));

import { useNotificationsData } from "../desktop/src/hooks/use-notifications-data";

function notification(id: string, read = false): NotificationHistoryEntry {
  return {
    id,
    type: "price_drop",
    title: `Title ${id}`,
    body: "Body",
    read,
    createdAt: Date.now(),
  } as NotificationHistoryEntry;
}

describe("useNotificationsData", () => {
  beforeEach(() => {
    state.history = [notification("n1"), notification("n2", true)];
    state.unread = 1;
    state.loadRejects = false;
    state.markRejects = false;
    state.markedRead = [];
    state.markedAll = 0;
    state.synced = 0;
  });

  it("loads history and unread count", async () => {
    const { result } = renderHook(() =>
      useNotificationsData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current.unreadCount).toBe(1);
  });

  it("surfaces a load failure", async () => {
    state.loadRejects = true;
    const { result } = renderHook(() =>
      useNotificationsData({ showToast: vi.fn() }),
    );
    await waitFor(() =>
      expect(result.current.notifError).toBe("Couldn't load notifications."),
    );
  });

  it("marks a notification read and decrements unread", async () => {
    const { result } = renderHook(() =>
      useNotificationsData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    await act(async () => {
      await result.current.handleNotificationOpen(state.history[0]!);
    });
    expect(state.markedRead).toEqual(["n1"]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0]!.read).toBe(true);
  });

  it("does not re-mark an already-read notification", async () => {
    const { result } = renderHook(() =>
      useNotificationsData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    await act(async () => {
      await result.current.handleNotificationOpen(state.history[1]!);
    });
    expect(state.markedRead).toHaveLength(0);
    expect(result.current.unreadCount).toBe(1);
  });

  it("marks all read", async () => {
    const { result } = renderHook(() =>
      useNotificationsData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    await act(async () => {
      await result.current.handleMarkAllRead();
    });
    expect(state.markedAll).toBe(1);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it("reports a read-state failure", async () => {
    state.markRejects = true;
    const showToast = vi.fn();
    const { result } = renderHook(() => useNotificationsData({ showToast }));
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    await act(async () => {
      await result.current.handleNotificationOpen(state.history[0]!);
    });
    expect(showToast).toHaveBeenCalledWith(
      "Couldn't update notification. Try again.",
    );
    expect(result.current.unreadCount).toBe(1);
  });

  it("refreshes by syncing and reloading", async () => {
    const { result } = renderHook(() =>
      useNotificationsData({ showToast: vi.fn() }),
    );
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    await act(async () => {
      await result.current.handleRefreshNotifications();
    });
    expect(state.synced).toBe(1);
    expect(result.current.refreshing).toBe(false);
  });
});
