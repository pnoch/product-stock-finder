import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Notification Handler ─────────────────────────────────────────────────────
// Must be called at module level (outside any component) so it's set before
// any notification arrives, including when the app is in the foreground.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export {
  NOTIFICATION_CHANNELS,
  channelIdFor,
  immediateTrigger,
  setupAndroidNotificationChannel,
  requestNotificationPermissions,
  ensureNotificationPermission,
  notificationsMuted,
} from "./notifications/channels";

export {
  scheduleStockAlert,
  scheduleStockWatchConfirmation,
  scheduleHealthAlert,
  scheduleHealthRecovery,
  schedulePriceAlert,
  sendTestNotification,
  scheduleBackOrderReminder,
  cancelNotification,
  cancelAllNotifications,
} from "./notifications/scheduling";

export { sendPriceDigestNotification } from "./notifications/digest";

export {
  scheduleServerEventNotification,
  setupPushEventTracking,
} from "./notifications/server-events";
