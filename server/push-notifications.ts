import { eq } from "drizzle-orm";
import { Expo } from "expo-server-sdk";
import { devicePushTokens } from "../drizzle/schema";
import { getDb } from "./db";

export interface PushableEvent {
  id: string;
  title: string;
  body: string;
}

const memoryTokens = new Map<string, { token: string; platform: string }>();

export async function upsertPushToken(
  deviceId: string,
  token: string,
  platform: "ios" | "android",
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryTokens.set(deviceId, { token, platform });
    return;
  }
  await db
    .insert(devicePushTokens)
    .values({ deviceId, token, platform, updatedAt: Date.now() })
    .onDuplicateKeyUpdate({
      set: { token, platform, updatedAt: Date.now() },
    });
}

export async function sendPushForDevice(
  deviceId: string,
  events: PushableEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const db = await getDb();
  let token: string | undefined;
  if (db) {
    const rows = await db
      .select({ token: devicePushTokens.token })
      .from(devicePushTokens)
      .where(eq(devicePushTokens.deviceId, deviceId));
    token = rows[0]?.token;
  } else {
    token = memoryTokens.get(deviceId)?.token;
  }
  if (!token || !Expo.isExpoPushToken(token)) return;
  try {
    const expo = new Expo({ accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN });
    const messages = events.map((e) => ({
      to: token,
      title: e.title,
      body: e.body,
      data: { eventId: e.id },
    }));
    for (const chunk of expo.chunkPushNotifications(messages)) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.warn(`[Push] Failed to send push for device ${deviceId}:`, error);
  }
}

export function clearPushTokensForTests(): void {
  memoryTokens.clear();
}
