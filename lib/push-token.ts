import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { createTRPCClient } from "./trpc";

const TIMEOUT_MS = 4000;

export async function registerPushToken(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    if (!Device.isDevice) return;
    const projectId = (
      Constants.expoConfig?.extra as { expoProjectId?: string } | undefined
    )?.expoProjectId;
    if (!projectId) return;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.registerPushToken.mutate({
        token: token.data,
        platform: Platform.OS as "ios" | "android",
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
  } catch {
    // push registration is best-effort
  }
}

// Called on sign-out. Without this the server keeps the device bound to the
// account and keeps pushing that account's alerts to a signed-out device.
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === "web") {
    // Web push uses a separate subscription; unsubscribe locally AND tell the
    // server to prune the token, or the signed-out browser keeps receiving the
    // account's alerts.
    try {
      const { unsubscribeWebPush } = await import("./web-push");
      await unsubscribeWebPush();
    } catch {
      // best effort
    }
    try {
      const client = createTRPCClient();
      await Promise.race([
        client.notifications.unregisterPushToken.mutate(),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), TIMEOUT_MS),
        ),
      ]);
    } catch {
      // best effort
    }
    return;
  }
  try {
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.unregisterPushToken.mutate(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
  } catch {
    // best-effort — the server also prunes on device cleanup
  }
}
