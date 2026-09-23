import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  getAlerts,
  getBackOrderReminders,
  getStockWatches,
} from "@/lib/storage";
import { countActiveAlerts } from "@/lib/alert-state";

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
        // Guard the whole read: a rejected Promise.all was an unhandled
        // rejection and silently stopped the badge from updating.
        const [alerts, reminders, watches] = await Promise.all([
          getAlerts().catch(() => []),
          getBackOrderReminders().catch(() => []),
          getStockWatches().catch(() => []),
        ]);
        // Shared predicate so the badge, the Home stat card, and the in-screen
        // "N alerts" count always agree.
        const activeAlerts = countActiveAlerts(alerts);
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
