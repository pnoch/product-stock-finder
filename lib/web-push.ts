import { Platform } from "react-native";
import { createTRPCClient } from "./trpc";

const SW_PATH = "/sw.js";

function isWeb(): boolean {
  return Platform.OS === "web";
}

export function isPushSupported(): boolean {
  if (!isWeb()) return false;
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof window.Notification !== "undefined"
  );
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const input = base64.trim();
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  const base64Url = (input + padding).replace(/-/g, "+").replace(/_/g, "/");
  if (typeof window !== "undefined" && window.atob) {
    const rawData = window.atob(base64Url);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } else {
    const buf = Buffer.from(base64Url, "base64");
    return new Uint8Array(buf);
  }
}

// The offline shell / PWA install only needs a service worker, not PushManager.
// Registering on any SW-capable browser keeps offline working even where web
// push is unavailable (e.g. older iOS Safari), so this is not gated on push.
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWeb()) return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (error) {
    console.warn("[pwa] service worker registration failed", error);
    return null;
  }
}

export async function registerWebPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return registerServiceWorker();
}

export async function subscribeWebPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const applicationServerKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!applicationServerKey) return false;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    const registration = existing ?? (await registerWebPushServiceWorker());
    if (!registration) return false;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
    });
    const client = createTRPCClient();
    await client.notifications.registerPushToken.mutate({
      token: JSON.stringify(subscription),
      platform: "web",
    });
    return true;
  } catch (error) {
    console.warn("[web-push] subscribe failed", error);
    return false;
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.warn("[web-push] unsubscribe failed", error);
  }
}
