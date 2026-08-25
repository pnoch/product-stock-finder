import { Platform } from "react-native";
import { getSettings, saveSettings, recordDisplayedEventId } from "./storage";
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

async function syncPushSubscription(enabled: boolean): Promise<void> {
  const { subscribeWebPush, unsubscribeWebPush } = await import("./web-push");
  if (enabled) {
    await subscribeWebPush();
  } else {
    await unsubscribeWebPush();
  }
}

let messageListener: ((event: MessageEvent) => void) | null = null;

function startPushDedupListener(): void {
  if (messageListener) return;
  messageListener = (event: MessageEvent) => {
    const data = event.data as { type?: string; eventId?: string } | null;
    if (data?.type === "web-push-shown" && data.eventId) {
      void recordDisplayedEventId(data.eventId);
    }
  };
  navigator.serviceWorker?.addEventListener("message", messageListener);
}

function stopPushDedupListener(): void {
  if (messageListener) {
    navigator.serviceWorker?.removeEventListener("message", messageListener);
    messageListener = null;
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let focusListener: (() => void) | null = null;

async function isAuthenticatedClient(): Promise<boolean> {
  try {
    const { getUserInfo } = await import("./_core/auth");
    return Boolean(await getUserInfo());
  } catch {
    return false;
  }
}

async function pollTick(): Promise<void> {
  if (!(await isAuthenticatedClient())) return;
  void syncServerNotifications();
}

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void pollTick();
  }, POLL_INTERVAL_MS);
  focusListener = () => {
    void pollTick();
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
  startPushDedupListener();
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
    stopPushDedupListener();
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
      await syncPushSubscription(true);
      startPolling();
    }
    return permission;
  }
  const settings = await getSettings();
  await saveSettings({ ...settings, webNotificationsEnabled: false });
  await syncPushSubscription(false);
  stopPolling();
  return "denied";
}
