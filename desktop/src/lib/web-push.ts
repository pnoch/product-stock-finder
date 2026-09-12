import { createTRPCClient } from "./trpc";
import { withTimeout } from "../../../lib/with-timeout";

export const PENDING_UNREGISTER_KEY = "pending_push_unregister";

const UNREGISTER_TIMEOUT_MS = 5000;

export async function unregisterServerToken(): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await withTimeout(
      client.notifications.unregisterPushToken.mutate(),
      UNREGISTER_TIMEOUT_MS,
    );
    return result !== null;
  } catch {
    return false;
  }
}

export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof window.Notification !== "undefined"
  );
}

function vapidKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";
}

export function hasVapidKey(): boolean {
  return vapidKey().length > 0;
}

export async function getPushStatus(): Promise<"on" | "off"> {
  if (!isPushSupported()) return "off";
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? "on" : "off";
  } catch (e) {
    console.error("[web-push] status check failed", e);
    return "off";
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensurePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const key = vapidKey();
  if (!key) return false;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    const registration = existing ?? (await navigator.serviceWorker.register("/sw.js"));
    if (!registration) return false;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
    const client = createTRPCClient();
    await client.notifications.registerPushToken.mutate({
      token: JSON.stringify(subscription),
      platform: "web",
    });
    return true;
  } catch (e) {
    console.error("[web-push] subscribe failed", e);
    return false;
  }
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (e) {
    console.error("[web-push] unsubscribe failed", e);
  }
  const ok = await unregisterServerToken();
  localStorage.removeItem(PENDING_UNREGISTER_KEY);
  if (!ok) localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
}
