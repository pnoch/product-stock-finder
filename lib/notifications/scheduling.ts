import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { HEALTH_ALERT_THRESHOLD, HealthStatus } from "../scrapers/health";
import { recordDisplayedEventId, recordNotificationEvent, getSettings } from "../storage";
import { getDistributorById } from "@shared/distributors";
import { isInQuietHours } from "../quiet-hours";
import { LOG_ERROR } from "@shared/log";
import {
  channelIdFor,
  ensureNotificationPermission,
  immediateTrigger,
  notificationsMuted,
  requestNotificationPermissions,
} from "./channels";

export async function scheduleStockAlert(
  productName: string,
  distributorName: string,
  price: number,
  currency: string,
  productId?: string,
  distributorId?: string,
  url?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Back In Stock!",
        body: `${productName} is now available at ${distributorName} for ${currency} ${price.toFixed(2)}`,
        data: { type: "stock_alert", productName, distributorName, productId, distributorId, url },
        sound: "default",
      },
      trigger: immediateTrigger("stock"),
    });
    return id;
  } catch {
    return null;
  }
}

// Distinct from scheduleStockAlert (the real "back in stock" alert): enabling a
// watch must NOT fire a restock notification, or the user is told the item is
// available the moment they set the watch.
export async function scheduleStockWatchConfirmation(
  productName: string,
  distributorName: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (await notificationsMuted()) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Restock watch set",
        body: `We'll notify you when ${productName} is back in stock at ${distributorName}.`,
        data: { type: "stock_watch_set" },
        sound: "default",
      },
      trigger: immediateTrigger("stock"),
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleHealthAlert(
  distributorId: string,
  status: HealthStatus,
  reason?: string,
): Promise<{ notificationId: string | null; eventId: string } | null> {
  try {
    const settings = await getSettings();
    if (isInQuietHours(settings)) return null;
  } catch (e) {
    LOG_ERROR("[Notifications] settings read failed, sending anyway", e);
  }
  const displayName = getDistributorById(distributorId)?.name ?? distributorId;
  const title = status === "blocked" ? "Distributor Blocked" : "Distributor Down";
  const body = `${displayName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`;
  let id: string | null = null;
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("../web-notifications");
      if (!displayWebNotification(title, body)) return null;
    } catch {
      return null;
    }
  } else {
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "health_alert", distributorName: displayName, status },
          sound: "default",
        },
        trigger: immediateTrigger("stock"),
      });
    } catch {
      return null;
    }
  }
  const eventId = `health-${distributorId.toLowerCase()}-${status}-${Date.now()}`;
  await recordNotificationEvent({
    id: eventId,
    type: "health",
    title,
    body,
    distributorId,
    healthStatus: status as "blocked" | "error",
    createdAt: Date.now(),
  });
  await recordDisplayedEventId(eventId);
  return { notificationId: id, eventId };
}

export async function scheduleHealthRecovery(
  distributorId: string,
  status: HealthStatus,
): Promise<{ notificationId: string | null; eventId: string } | null> {
  try {
    const settings = await getSettings();
    if (isInQuietHours(settings)) return null;
  } catch (e) {
    LOG_ERROR("[Notifications] settings read failed, sending anyway", e);
  }
  const displayName = getDistributorById(distributorId)?.name ?? distributorId;
  const title = "Distributor Recovered";
  const body = `${displayName} is back online after being ${status}`;
  let id: string | null = null;
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("../web-notifications");
      if (!displayWebNotification(title, body)) return null;
    } catch {
      return null;
    }
  } else {
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "health_recovery", distributorName: displayName, status },
          sound: "default",
        },
        trigger: immediateTrigger("stock"),
      });
    } catch {
      return null;
    }
  }
  const recoveryEventId = `health-${distributorId.toLowerCase()}-${status}-${Date.now()}`;
  await recordNotificationEvent({
    id: recoveryEventId,
    type: "health",
    title,
    body,
    distributorId,
    healthStatus: "recovered",
    createdAt: Date.now(),
  });
  await recordDisplayedEventId(recoveryEventId);
  return { notificationId: id, eventId: recoveryEventId };
}

export async function schedulePriceAlert(
  productName: string,
  targetPrice: number,
  currency: string,
  productId?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Price Alert Set",
        body: `You'll be notified when ${productName} drops below ${currency} ${targetPrice.toFixed(2)}`,
        data: { type: "price_alert", productName, targetPrice, currency, productId },
        sound: "default",
      },
      trigger: immediateTrigger("price"),
    });
    return id;
  } catch {
    return null;
  }
}

export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === "web") {
    const granted = await ensureNotificationPermission();
    if (!granted) return false;
    const { displayWebNotification } = await import("../web-notifications");
    return displayWebNotification(
      "Notifications Working!",
      "OmniShop will alert you when prices drop or items come back in stock.",
    );
  }
  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Notifications Working!",
        body: "OmniShop will alert you when prices drop or items come back in stock.",
        data: { type: "test" },
        sound: "default",
      },
      trigger: immediateTrigger("price"),
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleBackOrderReminder(
  productName: string,
  distributorName: string,
  reminderDate: Date,
  productId?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (await notificationsMuted()) return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Back-Order Reminder",
        body: `Check ${distributorName} for ${productName} — your reminder date is here!`,
        data: { type: "back_order_reminder", productName, distributorName, productId },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        ...(channelIdFor("stock") ? { channelId: channelIdFor("stock") } : {}),
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}

// Cancels every scheduled notification. Used when a data wipe removes all
// reminders/watches, whose notifications would otherwise still fire.
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
