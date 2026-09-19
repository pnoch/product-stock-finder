import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
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
  getSettings,
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
  const [displayCurrency, setDisplayCurrency] = useState("USD");

  const [rescheduleTarget, setRescheduleTarget] =
    useState<BackOrderReminder | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGen = useRef(0);

  const loadData = useCallback(async () => {
    const gen = ++loadGen.current;
    try {
      const [a, p, r, w, n, s] = await Promise.all([
        getAlerts(),
        getWatchlist(),
        getBackOrderReminders(),
        getStockWatches(),
        getUnreadNotificationCount(),
        getSettings(),
      ]);
      if (gen !== loadGen.current) return;
      setAlerts(a);
      setProducts(p);
      setReminders(r);
      setStockWatches(w);
      setUnreadNotifications(n);
      setDisplayCurrency(s.displayCurrency ?? "USD");
      setLoadError(null);
    } catch {
      if (gen !== loadGen.current) return;
      setLoadError("Failed to load alerts. Pull to retry.");
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggle = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await toggleAlert(alertId);
        await loadData();
      } catch {
        showAlert("Update failed", "We couldn't update that alert. Please try again.");
      }
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
            try {
              await removeAlert(alertId);
              await loadData();
            } catch {
              showAlert("Delete failed", "We couldn't delete that alert. Please try again.");
            }
          },
        },
      ]);
    },
    [loadData],
  );

  const handleSnoozeAlert = useCallback(
    (alertId: string) => {
      const apply = async (days: number) => {
        try {
          await snoozeAlert(alertId, days);
          await loadData();
        } catch (e) {
          console.error("[Alerts] snooze failed", e);
          showAlert("Snooze failed", "We couldn't snooze that alert. Please try again.");
        }
      };
      if (Platform.OS === "web") {
        const input = window.prompt(
          "Snooze Alert\nPause notifications for how many days? (0 to wake now)",
          "7",
        );
        if (input === null) return;
        const trimmed = input.trim();
        if (trimmed === "") {
          showAlert("Invalid input", "Please enter a number of days.");
          return;
        }
        const days = Number(trimmed);
        if (!Number.isFinite(days) || !Number.isInteger(days) || days < 0) {
          showAlert("Invalid input", "Please enter a non-negative integer.");
          return;
        }
        void apply(days);
        return;
      }
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
              try {
                if (reminder.notificationId) {
                  await cancelNotification(reminder.notificationId);
                }
                await removeBackOrderReminder(reminder.id);
                await loadData();
              } catch (e) {
                console.error("[Alerts] cancel reminder failed", e);
                showAlert("Cancel failed", "We couldn't cancel that reminder. Please try again.");
              }
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
              try {
                await removeStockWatch(watch.id);
                await loadData();
              } catch (e) {
                console.error("[Alerts] remove watch failed", e);
                showAlert("Remove failed", "We couldn't remove that watch. Please try again.");
              }
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleReschedule = useCallback(async () => {
    if (!rescheduleTarget) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (rescheduleDate.getTime() < startOfToday.getTime()) {
      showAlert("Invalid Date", "Please select today or a future date.");
      return;
    }
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Schedule the new notification BEFORE cancelling the old one: cancelling
    // first meant a scheduling failure left the user with no reminder at all.
    let notifId: string | null = null;
    try {
      notifId = await scheduleBackOrderReminder(
        rescheduleTarget.productName,
        rescheduleTarget.distributorName,
        rescheduleDate,
        rescheduleTarget.productId,
      );
    } catch (e) {
      console.error("[Alerts] reschedule notification failed", e);
      notifId = null;
    }
    const notificationFailed = !notifId && Platform.OS !== "web";
    // Storage writes can reject (quota/IDB error). Without this guard the
    // rejection was unhandled and the modal stayed open with no error.
    try {
      if (!notificationFailed && rescheduleTarget.notificationId) {
        await cancelNotification(rescheduleTarget.notificationId);
      }
      await addBackOrderReminder({
        ...rescheduleTarget,
        reminderDate: rescheduleDate.toISOString(),
        // Keep the old notification id when the new schedule failed, so the
        // still-scheduled notification stays cancellable (otherwise it fires on
        // the old date and can never be cancelled).
        notificationId: notificationFailed
          ? rescheduleTarget.notificationId
          : (notifId ?? undefined),
      });
    } catch (e) {
      console.error("[Alerts] reschedule save failed", e);
      showAlert("Reschedule failed", "We couldn't save the new date. Please try again.");
      return;
    }
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRescheduleTarget(null);
    setShowReschedulePicker(false);
    await loadData();
    if (notificationFailed) {
      showAlert(
        "Reminder Saved",
        "Reminder rescheduled, but notifications are disabled. Enable notifications in your device settings to receive the alert.",
      );
    } else {
      showAlert(
        "Reminder Rescheduled ✅",
        `You'll be reminded on ${rescheduleDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`,
      );
    }
  }, [rescheduleTarget, rescheduleDate, loadData]);

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? "Unknown Product";

  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

  const totalSaved = triggeredAlerts.reduce((sum, a) => {
    if (a.triggeredPrice != null) {
      const delta =
        a.direction === "rise"
          ? a.triggeredPrice - a.targetPrice
          : a.targetPrice - a.triggeredPrice;
      const saved = convertPrice(Math.max(0, delta), a.currency, displayCurrency);
      if (saved === null) return sum;
      return sum + saved;
    }
    return sum;
  }, 0);

  const handleRearmAlert = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await rearmAlert(alertId);
        await loadData();
      } catch (e) {
        console.error("[Alerts] re-arm failed", e);
        showAlert("Re-arm failed", "We couldn't re-arm that alert. Please try again.");
        return;
      }
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [loadData],
  );

  const tabCount = {
    alerts: alerts.filter((a) => a.isActive && !a.triggeredAt && (!a.snoozedUntil || new Date(a.snoozedUntil).getTime() <= Date.now())).length,
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
    loadError,
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
    displayCurrency,
    tabCount,
    rescheduleTarget,
    setRescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    showReschedulePicker,
    setShowReschedulePicker,
  };
}
