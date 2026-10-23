import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { getSettings } from "../storage";

// The Settings "Enable Notifications" toggle must gate every scheduled or
// confirmational notification, not just the price-check path. Only an explicit
// `false` mutes (the default settings set it true); a settings read failure
// proceeds, matching the previous best-effort behavior.
export async function notificationsMuted(): Promise<boolean> {
  try {
    return (await getSettings()).notificationsEnabled === false;
  } catch {
    return false;
  }
}

// ─── Android Channel Setup ────────────────────────────────────────────────────
export const NOTIFICATION_CHANNELS = {
  stock: "stock-alerts",
  price: "price-alerts",
  digest: "digest",
} as const;

// Android ignores per-notification importance/sound/vibration unless the
// notification names a channel; without this every alert landed on the default
// channel and the configured HIGH importance was never applied.
export function channelIdFor(
  kind: keyof typeof NOTIFICATION_CHANNELS,
): string | undefined {
  return Platform.OS === "android" ? NOTIFICATION_CHANNELS[kind] : undefined;
}

// Android selects the notification channel from the TRIGGER, not from
// `content` — and expo-notifications ignores `content.channelId` entirely when
// `trigger: null`, logging "Couldn't get channel for the notifications" and
// falling back to a default channel (so the configured HIGH importance, sound,
// and vibration were never applied to immediate notifications). A 1-second
// time-interval trigger carries the channelId and still fires immediately.
export function immediateTrigger(
  kind: keyof typeof NOTIFICATION_CHANNELS,
): Notifications.NotificationTriggerInput {
  const channelId = channelIdFor(kind);
  if (Platform.OS !== "android" || !channelId) return null;
  return {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 1,
    channelId,
  };
}

export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("stock-alerts", {
    name: "Stock Alerts",
    description: "Notifications when tracked products come back in stock",
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1E6FD9",
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("price-alerts", {
    name: "Price Alerts",
    description: "Alerts when a watched part restocks or drops below your target price.",
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#10B981",
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("digest", {
    name: "Price Digest",
    description: "Daily or weekly price digest summary",
    importance: AndroidImportance.DEFAULT,
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
    const { requestWebNotificationPermission } = await import("../web-notifications");
    return (await requestWebNotificationPermission()) === "granted";
  }
  return requestNotificationPermissions();
}
