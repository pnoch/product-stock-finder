import { useCallback, useEffect, useState } from "react";
import { log } from "@shared/log";
import { storage } from "../storage";
import { syncDesktopNotifications } from "../server-notifications";
import type { NotificationHistoryEntry } from "../../../lib/types";

export function useNotificationsData({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [notifications, setNotifications] = useState<NotificationHistoryEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    setNotifError(null);
    try {
      const [history, unread] = await Promise.all([
        storage.getNotificationHistory(),
        storage.getUnreadNotificationCount(),
      ]);
      setNotifications(history);
      setUnreadCount(unread);
    } catch {
      log.error("[Alerts] Failed to load notifications");
      setNotifError("Couldn't load notifications.");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadNotifications();
    });
  }, [loadNotifications]);

  const handleRefreshNotifications = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDesktopNotifications();
    } finally {
      await loadNotifications();
      setRefreshing(false);
    }
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await (storage.markAllNotificationsRead as unknown as () => Promise<void>)?.();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      log.error("[Alerts] Failed to update notification read state");
      showToast("Couldn't update notification. Try again.");
    }
  };

  const handleNotificationOpen = async (n: NotificationHistoryEntry) => {
    if (n.read) return;
    try {
      await storage.markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      log.error("[Alerts] Failed to update notification read state");
      showToast("Couldn't update notification. Try again.");
    }
  };

  return {
    notifications,
    unreadCount,
    notifError,
    refreshing,
    loadNotifications,
    handleRefreshNotifications,
    handleMarkAllRead,
    handleNotificationOpen,
  };
}
