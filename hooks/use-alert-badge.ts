import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  getAlerts,
  getBackOrderReminders,
  getStockWatches,
} from "@/lib/storage";

/**
 * Returns the total count of active items for the Alerts tab badge:
 * - Active, non-triggered price alerts
 * - Scheduled back-order date reminders
 * - Active back-in-stock watches
 *
 * Refreshes every time the tab comes into focus.
 */
export function useAlertBadge(): number {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const [alerts, reminders, watches] = await Promise.all([
          getAlerts(),
          getBackOrderReminders(),
          getStockWatches(),
        ]);
        const activeAlerts = alerts.filter(
          (a) => a.isActive && !a.triggeredAt,
        ).length;
        const activeReminders = reminders.length;
        const activeWatches = watches.length;
        if (active) setCount(activeAlerts + activeReminders + activeWatches);
      }
      load();
      return () => {
        active = false;
      };
    }, []),
  );

  return count;
}
