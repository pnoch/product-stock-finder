import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { recordNotificationEvent, getSettings } from "../storage";
import { isInQuietHours } from "../quiet-hours";
import { LOG_ERROR } from "@shared/log";
import { immediateTrigger, requestNotificationPermissions } from "./channels";

// Returns true only when a notification was actually scheduled, so the caller
// can avoid advancing the digest snapshot on a skipped/failed send.
export async function sendPriceDigestNotification(
  title: string,
  body: string,
): Promise<boolean> {
  try {
    const settings = await getSettings();
    if (isInQuietHours(settings)) return false;
  } catch (e) {
    LOG_ERROR("[Notifications] settings read failed, sending anyway", e);
  }
  if (Platform.OS === "web") return false;
  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "digest" },
        sound: "default",
      },
      trigger: immediateTrigger("digest"),
    });
    try {
      await recordNotificationEvent({
        id: `local-digest-${new Date().toISOString().slice(0, 10)}`,
        type: "digest",
        title,
        body,
        createdAt: Date.now(),
      });
    } catch {
      // best-effort
    }
    return true;
  } catch {
    return false;
  }
}
