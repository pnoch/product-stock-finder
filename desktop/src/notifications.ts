import { invoke } from "@tauri-apps/api/core";

export async function sendDesktopNotification(
  title: string,
  body: string,
): Promise<void> {
  try {
    await invoke("send_notification", { title, body, sound: true });
  } catch (e) {
    console.error("Failed to send notification:", e);
  }
}
