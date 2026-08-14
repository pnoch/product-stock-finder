import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { getDeviceId } from "./device-id";
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
    const deviceId = await getDeviceId();
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.registerPushToken.mutate({
        deviceId,
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
