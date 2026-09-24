// Desktop notification-permission check. Shared by the product-detail and
// compare alert/watch flows so every path that creates a notification-backed
// record gates on permission (mobile's ensureNotificationPermission does).
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      const result = await Notification.requestPermission();
      return result === "granted";
    }
  } catch {
    // fall through to granted for Tauri
  }
  return true;
}
