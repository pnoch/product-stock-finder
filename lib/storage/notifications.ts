import type { NotificationHistoryEntry } from "../types";
import type { StorageContext } from "./context";

export type PendingHealthEvent = {
  // Shared with the locally-recorded notification event id, so the server
  // stores the same id and the pulled event dedupes against the local one.
  id?: string;
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  title: string;
  body: string;
  createdAt: number;
};

export function createNotificationsStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue, readList } = ctx;

  // ─── Displayed Event Ids (notification dedup) ──────────────────────────────

  async function getDisplayedEventIds(): Promise<string[]> {
    return readList<string>(KEYS.DISPLAYED_EVENT_IDS);
  }

  async function recordDisplayedEventId(id: string): Promise<void> {
    await enqueue(KEYS.DISPLAYED_EVENT_IDS, async () => {
      const ids = await getDisplayedEventIds();
      if (!ids.includes(id)) {
        ids.push(id);
        if (ids.length > 200) ids.splice(0, ids.length - 200);
        await adapter.setItem(KEYS.DISPLAYED_EVENT_IDS, JSON.stringify(ids));
      }
    });
  }

  // ─── Notification History ─────────────────────────────────────────────────

  async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
    return readList<NotificationHistoryEntry>(KEYS.NOTIFICATION_HISTORY);
  }

  async function recordNotificationEvent(
    event: Omit<NotificationHistoryEntry, "read">,
  ): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => e.id === event.id)) return;
      list.unshift({ ...event, read: false });
      if (list.length > 200) list.length = 200;
      await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
    });
  }

  async function markNotificationRead(id: string): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      const entry = list.find((e) => e.id === id);
      if (entry && !entry.read) {
        entry.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function markAllNotificationsRead(): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => !e.read)) {
        for (const e of list) e.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function getUnreadNotificationCount(): Promise<number> {
    const list = await getNotificationHistory();
    return list.filter((e) => !e.read).length;
  }

  // ─── Pending Health Events (server mirroring buffer) ─────────────────────

  async function getPendingHealthEvents(): Promise<PendingHealthEvent[]> {
    return readList(KEYS.PENDING_HEALTH_EVENTS);
  }

  async function savePendingHealthEvents(
    events: PendingHealthEvent[],
  ): Promise<void> {
    await enqueue(KEYS.PENDING_HEALTH_EVENTS, async () => {
      await adapter.setItem(KEYS.PENDING_HEALTH_EVENTS, JSON.stringify(events));
    });
  }

  async function clearPendingHealthEvents(): Promise<void> {
    await enqueue(KEYS.PENDING_HEALTH_EVENTS, async () => {
      await adapter.removeItem(KEYS.PENDING_HEALTH_EVENTS);
    });
  }

  return {
    getDisplayedEventIds,
    recordDisplayedEventId,
    getNotificationHistory,
    recordNotificationEvent,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,
    getPendingHealthEvents,
    savePendingHealthEvents,
    clearPendingHealthEvents,
  };
}
