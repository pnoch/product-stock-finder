import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { HEALTH_ALERT_THRESHOLD, HealthStatus } from "./scrapers/health";
import { recordDisplayedEventId, recordNotificationEvent, getSettings } from "./storage";
import { getDistributorById } from "@shared/distributors";
import { isInQuietHours } from "./quiet-hours";
import { LOG_ERROR } from "@shared/log";

// ─── Notification Handler ─────────────────────────────────────────────────────
// Must be called at module level (outside any component) so it's set before
// any notification arrives, including when the app is in the foreground.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Android Channel Setup ────────────────────────────────────────────────────
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("stock-alerts", {
    name: "Stock Alerts",
    description: "Notifications when tracked products come back in stock",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1E6FD9",
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("price-alerts", {
    name: "Price Alerts",
    description: "Notifications when a product drops below your target price",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#10B981",
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("digest", {
    name: "Price Digest",
    description: "Daily or weekly price digest summary",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: "#6366F1",
    sound: "default",
  });
}

// ─── Permission Request ───────────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Cross-platform entry point for alert/watch/reminder flows: native uses
// expo-notifications, web uses the Notification API + push subscription path.
// Callers must not use requestNotificationPermissions() directly — it always
// returns false on web, stranding web users at "Permission Denied".
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    const { requestWebNotificationPermission } = await import(
      "./web-notifications"
    );
    return (await requestWebNotificationPermission()) === "granted";
  }
  return requestNotificationPermissions();
}

// ─── Schedule a stock-available notification ──────────────────────────────────
export async function scheduleStockAlert(
  productName: string,
  distributorName: string,
  price: number,
  currency: string,
  productId?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🟢 Back In Stock!",
        body: `${productName} is now available at ${distributorName} for ${currency} ${price.toFixed(2)}`,
        data: { type: "stock_alert", productName, distributorName, productId },
        sound: "default",
      },
      trigger: null, // immediate
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Confirm a restock watch was set ──────────────────────────────────────────
// Distinct from scheduleStockAlert (the real "back in stock" alert): enabling a
// watch must NOT fire a restock notification, or the user is told the item is
// available the moment they set the watch.
export async function scheduleStockWatchConfirmation(
  productName: string,
  distributorName: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Restock watch set",
        body: `We'll notify you when ${productName} is back in stock at ${distributorName}.`,
        data: { type: "stock_watch_set" },
        sound: "default",
      },
      trigger: null, // immediate
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Schedule a distributor health alert ─────────────────────────────────────
export async function scheduleHealthAlert(
  distributorId: string,
  status: HealthStatus,
  reason?: string,
): Promise<string | null> {
  try {
    const settings = await getSettings();
    if (isInQuietHours(settings)) return null;
  } catch (e) {
    LOG_ERROR("[Notifications] settings read failed, sending anyway", e);
  }
  const displayName = getDistributorById(distributorId)?.name ?? distributorId;
  const title =
    status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down";
  const body = `${displayName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`;
  let id: string | null = null;
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("./web-notifications");
      displayWebNotification(title, body);
    } catch {
      // web display failures are non-fatal
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
        trigger: null, // immediate
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
  return id;
}

// ─── Schedule a distributor recovery notification ────────────────────────────
export async function scheduleHealthRecovery(
  distributorId: string,
  status: HealthStatus,
): Promise<string | null> {
  try {
    const settings = await getSettings();
    if (isInQuietHours(settings)) return null;
  } catch (e) {
    LOG_ERROR("[Notifications] settings read failed, sending anyway", e);
  }
  const displayName = getDistributorById(distributorId)?.name ?? distributorId;
  const title = "🟢 Distributor Recovered";
  const body = `${displayName} is back online after being ${status}`;
  let id: string | null = null;
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("./web-notifications");
      displayWebNotification(title, body);
    } catch {
      // web display failures are non-fatal
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
        trigger: null, // immediate
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
  return id;
}

// ─── Schedule a price-drop notification ──────────────────────────────────────
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
        title: "💰 Price Alert Set",
        body: `You'll be notified when ${productName} drops below ${currency} ${targetPrice.toFixed(2)}`,
        data: { type: "price_alert", productName, targetPrice, currency, productId },
        sound: "default",
      },
      trigger: null, // immediate confirmation notification
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Send a test notification ─────────────────────────────────────────────────
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Notifications Working!",
        body: "Product Stock Finder will alert you when prices drop or items come back in stock.",
        data: { type: "test" },
        sound: "default",
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Schedule a back-order reminder notification ──────────────────────────────
export async function scheduleBackOrderReminder(
  productName: string,
  distributorName: string,
  reminderDate: Date,
  productId?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📦 Back-Order Reminder",
        body: `Check ${distributorName} for ${productName} — your reminder date is here!`,
        data: { type: "back_order_reminder", productName, distributorName, productId },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Cancel a scheduled notification ─────────────────────────────────────────
export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}

// ─── Send a price digest notification ────────────────────────────────────────
export async function sendPriceDigestNotification(
  title: string,
  body: string,
): Promise<void> {
  try {
    const settings = await getSettings();
    if (isInQuietHours(settings)) return;
  } catch (e) {
    LOG_ERROR("[Notifications] settings read failed, sending anyway", e);
  }
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "digest" },
        sound: "default",
      },
      trigger: null, // immediate
    });
  } catch {
    // digest failures are non-fatal
  }
}

// ─── Show a server-queued notification event locally ─────────────────────────
export async function scheduleServerEventNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("./web-notifications");
      displayWebNotification(title, body);
    } catch {
      // server event failures are non-fatal
    }
    return;
  }
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "server_event", ...(data ?? {}) },
        sound: "default",
      },
      trigger: null, // immediate
    });
  } catch {
    // server event failures are non-fatal
  }
}

// ─── Push Event Tracking (dedup) ──────────────────────────────────────────────
// Records the eventIds of push notifications the app receives or the user
// taps, so the launch pull sync can skip re-rendering them locally.
export function setupPushEventTracking(): () => void {
  if (Platform.OS === "web") return () => {};
  const subscriptions: Array<{ remove: () => void }> = [];
  const recordEventId = (data: unknown): void => {
    const eventId = (data as { eventId?: unknown } | undefined)?.eventId;
    if (typeof eventId === "string" && eventId) {
      void recordDisplayedEventId(eventId);
    }
  };
  try {
    // addNotificationReceivedListener only fires in the foreground on iOS; a
    // background push that's never tapped isn't observed here, so the launch
    // pull may still re-render it (accepted best-effort gap — pull is the
    // correctness guarantee).
    subscriptions.push(
      Notifications.addNotificationReceivedListener((notification) => {
        recordEventId(notification.request.content.data);
      }),
    );
    subscriptions.push(
      Notifications.addNotificationResponseReceivedListener((response) => {
        recordEventId(response.notification.request.content.data);
      }),
    );
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) recordEventId(response.notification.request.content.data);
      })
      .catch(() => {});
  } catch {
    // push event tracking is best-effort
  }
  return () => {
    for (const sub of subscriptions) {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    }
  };
}
