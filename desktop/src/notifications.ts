import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export async function sendDesktopNotification(
  title: string,
  body: string,
  route?: string,
): Promise<void> {
  try {
    await invoke("send_notification", { title, body, sound: true, route: route ?? null });
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
