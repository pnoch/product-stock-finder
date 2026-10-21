import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "../currency";
import {
  ensureNotificationPermission,
  immediateTrigger,
} from "../notifications";
import { getWatchlist, updateSettings } from "../storage";
import { activeProducts } from "../acquired";
import { isAutomaticProduct } from "../marketplace";
import type { AppSettings } from "../types";

/** Fires the basket-value alert once per set threshold, then auto-disables. */
export async function checkBasketAlert(
  settings: AppSettings,
): Promise<void> {
  if (!settings.notificationsEnabled || !settings.basketAlertThreshold) return;

  const fresh = activeProducts(await getWatchlist()).filter(
    isAutomaticProduct,
  );
  // The threshold is entered in the user's display currency (the sheet says
  // so), so the total must be computed in that currency too — hardcoding USD
  // compared a USD total against a EUR/GBP/etc threshold.
  const basketCurrency = settings.displayCurrency ?? "USD";
  const total = fresh.reduce(
    (sum, p) =>
      sum + (getBestPrice(p.listings ?? [], basketCurrency)?.price ?? 0),
    0,
  );
  const threshold = settings.basketAlertThreshold;
  if (!(total > 0 && total <= threshold)) return;

  // ensureNotificationPermission (not requestNotificationPermissions, which
  // always returns false on web) so web users can receive basket alerts.
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  try {
    const title = "Basket Alert";
    const body = `Watchlist value ${formatPrice(
      total,
      basketCurrency,
    )} dropped below your ${formatPrice(
      threshold,
      basketCurrency,
    )} threshold.`;
    if (Platform.OS === "web") {
      // expo-notifications is a no-op on web; use the Notification API.
      const { displayWebNotification } = await import("../web-notifications");
      if (!displayWebNotification(title, body)) {
        throw new Error("web notification not displayed");
      }
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "digest" },
          sound: true,
        },
        trigger: immediateTrigger("digest"),
      });
    }
    // Record in the in-app history, like the price-drop/restock paths —
    // otherwise the Notification Center only shows server events and the
    // counts diverge from what was delivered. Best-effort: a history write
    // failure must not block clearing the threshold below.
    try {
      const { recordNotificationEvent } = await import("../storage");
      await recordNotificationEvent({
        id: `local-basket-${new Date().toISOString().slice(0, 10)}`,
        type: "digest",
        title,
        body,
        createdAt: Date.now(),
      });
    } catch {
      // best-effort
    }
    // Only clear the threshold once the alert actually fired; clearing it when
    // permission is denied (or scheduling throws) silently loses the alert
    // forever. Use the serialized patch so a concurrent settings change isn't
    // clobbered by this stale snapshot.
    await updateSettings({ basketAlertThreshold: null });
  } catch {
    // Leave the threshold set so the next run retries.
  }
}
