import { Platform } from "react-native";
import { getDeviceId } from "./device-id";
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
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64Url);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerWebPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (error) {
    console.warn("[web-push] service worker registration failed", error);
    return null;
  }
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
    const deviceId = await getDeviceId();
    const client = createTRPCClient();
    await client.notifications.registerPushToken.mutate({
      deviceId,
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
