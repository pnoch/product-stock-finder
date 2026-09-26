import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  getAlerts,
  getBackOrderReminders,
  getStockWatches,
  subscribeToStorageChanges,
} from "@/lib/storage";
import { countActiveAlerts } from "@/lib/alert-state";

/**
 * Returns the total count of active items for the Alerts tab badge:
 * - Active, non-triggered price alerts
 * - Scheduled back-order date reminders
 * - Active back-in-stock watches
 *
 * Refreshes on tab focus and on any local storage change: this hook runs from
 * the (tabs) layout, whose focus effect only fires when the parent route is
 * entered, so an in-place delete/toggle on the Alerts tab would otherwise
 * leave the badge stale until the user navigates to a pushed screen.
 */
export function useAlertBadge(): number {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
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
    if (mountedRef.current) {
      setCount(activeAlerts + activeReminders + activeWatches);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToStorageChanges(() => {
      void load();
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return count;
}
