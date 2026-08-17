import { Platform } from "react-native";
import { getSettings, saveSettings } from "./storage";
import { syncServerNotifications } from "./server-notifications";

const POLL_INTERVAL_MS = 60 * 1000;

function isWeb(): boolean {
  return Platform.OS === "web";
}

export function isWebNotificationsSupported(): boolean {
  if (!isWeb()) return false;
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.Notification !== "undefined"
  );
}

export async function requestWebNotificationPermission(): Promise<
  "granted" | "denied" | "default"
> {
  if (!isWebNotificationsSupported()) return "denied";
  try {
    return await window.Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function displayWebNotification(title: string, body: string): void {
  if (!isWebNotificationsSupported()) return;
  if (window.Notification.permission !== "granted") return;
  try {
    const notification = new window.Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.warn("[web-notifications] display failed", err);
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let focusListener: (() => void) | null = null;

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void syncServerNotifications();
  }, POLL_INTERVAL_MS);
  focusListener = () => {
    void syncServerNotifications();
  };
  window.addEventListener("focus", focusListener);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (focusListener) {
    window.removeEventListener("focus", focusListener);
    focusListener = null;
  }
}

export function setupWebNotifications(): () => void {
  if (!isWeb()) return () => {};
  let disposed = false;
  void getSettings().then((settings) => {
    if (disposed) return;
    if (
      settings.webNotificationsEnabled &&
      window.Notification?.permission === "granted"
    ) {
      startPolling();
    }
  });
  return () => {
    disposed = true;
    stopPolling();
  };
}

export async function setWebNotificationsEnabled(
  enabled: boolean,
): Promise<"granted" | "denied" | "default"> {
  if (!isWeb()) return "denied";
  if (enabled) {
    const permission = await requestWebNotificationPermission();
    if (permission === "granted") {
      const settings = await getSettings();
      await saveSettings({ ...settings, webNotificationsEnabled: true });
      startPolling();
    }
    return permission;
  }
  const settings = await getSettings();
  await saveSettings({ ...settings, webNotificationsEnabled: false });
  stopPolling();
  return "denied";
}
