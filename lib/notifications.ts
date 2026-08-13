import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { recordDisplayedEventId } from "./storage";

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

// ─── Schedule a stock-available notification ──────────────────────────────────
export async function scheduleStockAlert(
  productName: string,
  distributorName: string,
  price: number,
  currency: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🟢 Back In Stock!",
        body: `${productName} is now available at ${distributorName} for ${currency} ${price.toFixed(2)}`,
        data: { type: "stock_alert", productName, distributorName },
        sound: "default",
      },
      trigger: null, // immediate
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Schedule a price-drop notification ──────────────────────────────────────
export async function schedulePriceAlert(
  productName: string,
  targetPrice: number,
  currency: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💰 Price Alert Set",
        body: `You'll be notified when ${productName} drops below ${currency} ${targetPrice.toFixed(2)}`,
        data: { type: "price_alert", productName, targetPrice, currency },
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
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📦 Back-Order Reminder",
        body: `Check ${distributorName} for ${productName} — your reminder date is here!`,
        data: { type: "back_order_reminder", productName, distributorName },
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
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
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
): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
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
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) recordEventId(response.notification.request.content.data);
    });
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
