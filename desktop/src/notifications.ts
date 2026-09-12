import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { storage } from "./storage";
import { displayWebNotification } from "../../lib/web-notifications";

export async function sendDesktopNotification(
  title: string,
  body: string,
  route?: string,
): Promise<void> {
  try {
    await invoke("send_notification", { title, body, sound: true, route: route ?? null });
    return;
  } catch (e) {
    console.error("[notifications] Tauri send failed, trying web display", e);
  }
  try {
    const settings = await storage.getSettings();
    if (!settings?.webNotificationsEnabled) return;
    displayWebNotification(title, body);
  } catch (e) {
    console.error("Failed to send notification:", e);
  }
}

export function onNotificationActivated(callback: (route: string) => void): Promise<UnlistenFn> {
  return listen("notification-activated", (event) => {
    const route = (event.payload as { route?: unknown }).route;
    callback(typeof route === "string" && route.startsWith("/") ? route : "/");
  });
}
