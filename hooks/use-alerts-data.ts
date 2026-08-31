import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { ActiveTab } from "@/components/alerts/tab-switcher";
import {
  getAlerts,
  removeAlert,
  snoozeAlert,
  updateAlert,
  toggleAlert,
  getWatchlist,
  getBackOrderReminders,
  removeBackOrderReminder,
  addBackOrderReminder,
  getStockWatches,
  removeStockWatch,
  rearmAlert,
  getUnreadNotificationCount,
} from "@/lib/storage";
import { PriceAlert, Product, BackOrderReminder } from "@/lib/types";
import { convertPrice } from "@/lib/currency";
import { showAlert } from "@/lib/alert";
import {
  cancelNotification,
  scheduleBackOrderReminder,
} from "@/lib/notifications";

export function useAlertsData() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("alerts");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [reminders, setReminders] = useState<BackOrderReminder[]>([]);
  const [stockWatches, setStockWatches] = useState<BackOrderReminder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [rescheduleTarget, setRescheduleTarget] =
    useState<BackOrderReminder | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [a, p, r, w, n] = await Promise.all([
        getAlerts(),
        getWatchlist(),
        getBackOrderReminders(),
        getStockWatches(),
        getUnreadNotificationCount(),
      ]);
      setAlerts(a);
      setProducts(p);
      setReminders(r);
      setStockWatches(w);
      setUnreadNotifications(n);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggle = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleAlert(alertId);
      await loadData();
    },
    [loadData],
  );

  const handleDeleteAlert = useCallback(
    async (alertId: string) => {
      showAlert("Delete Alert", "Remove this price alert? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web")
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await removeAlert(alertId);
            await loadData();
          },
        },
      ]);
    },
    [loadData],
  );

  const handleSnoozeAlert = useCallback(
    (alertId: string) => {
      const apply = async (days: number) => {
        await snoozeAlert(alertId, days);
        await loadData();
      };
      showAlert("Snooze Alert", "Pause notifications for this alert.", [
        { text: "1 day", onPress: () => void apply(1) },
        { text: "7 days", onPress: () => void apply(7) },
        { text: "30 days", onPress: () => void apply(30) },
        { text: "Wake now", onPress: () => void apply(0) },
        { text: "Cancel", style: "cancel" as const },
      ]);
    },
    [loadData],
  );

  const handleUpdateAlert = useCallback(
    async (
      alertId: string,
      patch: {
        targetPrice: number;
        currency: string;
        direction: "drop" | "rise";
        distributorId: string | null;
      },
    ) => {
      await updateAlert(alertId, patch);
      await loadData();
    },
    [loadData],
  );

  const handleDeleteReminder = useCallback(
    async (reminder: BackOrderReminder) => {
      showAlert(
        "Cancel Reminder",
        `Cancel the reminder for ${reminder.productName} at ${reminder.distributorName}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Reminder",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
              if (reminder.notificationId) {
                await cancelNotification(reminder.notificationId);
              }
              await removeBackOrderReminder(reminder.id);
              await loadData();
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleRemoveStockWatch = useCallback(
    async (watch: BackOrderReminder) => {
      showAlert(
        "Remove Watch",
        `Stop watching ${watch.distributorName} for ${watch.productName}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await removeStockWatch(watch.id);
              await loadData();
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleReschedule = useCallback(async () => {
    if (!rescheduleTarget) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (rescheduleTarget.notificationId) {
      await cancelNotification(rescheduleTarget.notificationId);
    }
    const notifId = await scheduleBackOrderReminder(
      rescheduleTarget.productName,
      rescheduleTarget.distributorName,
      rescheduleDate,
      rescheduleTarget.productId,
    );
    await addBackOrderReminder({
      ...rescheduleTarget,
      reminderDate: rescheduleDate.toISOString(),
      notificationId: notifId ?? undefined,
    });
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRescheduleTarget(null);
    setShowReschedulePicker(false);
    await loadData();
    showAlert(
      "Reminder Rescheduled ✅",
      `You'll be reminded on ${rescheduleDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`,
    );
  }, [rescheduleTarget, rescheduleDate, loadData]);

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? "Unknown Product";

  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

  const totalSaved = triggeredAlerts.reduce((sum, a) => {
    if (a.triggeredPrice != null) {
      const savedUsd = convertPrice(
        Math.max(0, a.targetPrice - a.triggeredPrice),
        a.currency,
        "USD",
      );
      if (savedUsd === null) return sum;
      return sum + savedUsd;
    }
    return sum;
  }, 0);

  const handleRearmAlert = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await rearmAlert(alertId);
      await loadData();
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [loadData],
  );

  const tabCount = {
    alerts: alerts.length,
    reminders: reminders.length + stockWatches.length,
    notifications: unreadNotifications,
  };

  return {
    activeTab,
    setActiveTab,
    alerts,
    reminders,
    stockWatches,
    products,
    refreshing,
    loading,
    onRefresh,
    unreadNotifications,
    setUnreadNotifications,
    handleToggle,
    handleDeleteAlert,
    handleSnoozeAlert,
    handleUpdateAlert,
    handleDeleteReminder,
    handleRemoveStockWatch,
    handleReschedule,
    handleRearmAlert,
    getProductName,
    triggeredAlerts,
    totalSaved,
    tabCount,
    rescheduleTarget,
    setRescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    showReschedulePicker,
    setShowReschedulePicker,
  };
}
