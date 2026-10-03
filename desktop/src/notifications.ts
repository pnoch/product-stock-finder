import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { log } from "@shared/log";
import { storage } from "./storage";
import { displayWebNotification } from "../../lib/web-notifications";

export async function sendDesktopNotification(
  title: string,
  body: string,
  route?: string,
): Promise<boolean> {
  try {
    await invoke("send_notification", { title, body, sound: true, route: route ?? null });
    return true;
  } catch (e) {
    log.error("[notifications] Tauri send failed, trying web display", e);
  }
  try {
    const settings = await storage.getSettings();
    if (!settings?.webNotificationsEnabled) return false;
    // Report whether the browser actually displayed it. Returning `true`
    // unconditionally made callers treat an ungranted-permission send as
    // delivered, so they consumed state (basket threshold, digest snapshot,
    // restock watch) for a notification the user never saw.
    return displayWebNotification(title, body);
  } catch (e) {
    log.error("Failed to send notification:", e);
    return false;
  }
}

export function onNotificationActivated(callback: (route: string) => void): Promise<UnlistenFn> {
  return listen("notification-activated", (event) => {
    const route = (event.payload as { route?: unknown }).route;
    callback(typeof route === "string" && route.startsWith("/") ? route : "/");
  });
}
