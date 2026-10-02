import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  getAlerts,
  getBackOrderReminders,
  getStockWatches,
  subscribeToStorageChanges,
} from "@/lib/storage";
import { countOpenAlerts } from "@/lib/alert-state";

/**
 * Returns the total count of items the Alerts tab lists, so the badge matches
 * the cards shown (armed + snoozed + paused):
 * - Every non-triggered price alert
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
    // `countOpenAlerts` (not `countActiveAlerts`): the Alerts tab renders every
    // non-triggered alert as a card, so the badge must match those cards. The
    // Home "Active Alerts" stat keeps the stricter armed predicate.
    const openAlerts = countOpenAlerts(alerts);
    const reminderCount = reminders.length;
    const watchCount = watches.length;
    if (mountedRef.current) {
      setCount(openAlerts + reminderCount + watchCount);
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
