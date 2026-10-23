import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { recordDisplayedEventId } from "../storage";
import { ensureNotificationPermission, immediateTrigger } from "./channels";

// Returns whether a notification was actually shown, so the caller can avoid
// marking an undelivered event as displayed (which would drop it forever).
export async function scheduleServerEventNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("../web-notifications");
      return displayWebNotification(title, body);
    } catch {
      return false;
    }
  }
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "server_event", ...(data ?? {}) },
        sound: "default",
      },
      trigger: immediateTrigger("price"),
    });
    return true;
  } catch {
    return false;
  }
}

// Records the eventIds of push notifications the app receives or the user
// taps, so the launch pull sync can skip re-rendering them locally.
export function setupPushEventTracking(): () => void {
  if (Platform.OS === "web") return () => {};
  const subscriptions: { remove: () => void }[] = [];
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
