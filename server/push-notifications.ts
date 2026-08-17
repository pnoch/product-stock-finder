import { eq } from "drizzle-orm";
import { Expo } from "expo-server-sdk";
import {
  devicePushTokens,
  type InsertDevicePushTokenRow,
} from "../drizzle/schema";
import { getDb } from "./db";
import { sendWebPush, type WebPushSubscription } from "./web-push";

export interface PushableEvent {
  id: string;
  title: string;
  body: string;
}

const memoryTokens = new Map<
  string,
  { token: string; platform: string; userId: number | null }
>();

export async function upsertPushToken(
  deviceId: string,
  token: string,
  platform: "ios" | "android" | "web",
  userId: number | null = null,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const existing = memoryTokens.get(deviceId);
    const effectiveUserId = userId ?? existing?.userId ?? null;
    memoryTokens.set(deviceId, { token, platform, userId: effectiveUserId });
    return;
  }
  const set: Partial<InsertDevicePushTokenRow> = {
    token,
    platform,
    updatedAt: Date.now(),
  };
  if (userId !== null) set.userId = userId;
  await db
    .insert(devicePushTokens)
    .values({ deviceId, token, platform, userId, updatedAt: Date.now() })
    .onDuplicateKeyUpdate({ set });
}

export async function sendPushForDevice(
  deviceId: string,
  events: PushableEvent[],
): Promise<void> {
  if (events.length === 0) return;
  // Token lookup is best-effort: a failing read must not abort the caller's loop.
  let token: string | undefined;
  let platform: string | undefined;
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select({
          token: devicePushTokens.token,
          platform: devicePushTokens.platform,
        })
        .from(devicePushTokens)
        .where(eq(devicePushTokens.deviceId, deviceId));
      token = rows[0]?.token;
      platform = rows[0]?.platform;
    } else {
      const mem = memoryTokens.get(deviceId);
      token = mem?.token;
      platform = mem?.platform;
    }
  } catch (error) {
    console.warn(
      `[Push] Failed to read push token for device ${deviceId}:`,
      error,
    );
    return;
  }
  if (!token) return;
  if (platform === "web") {
    try {
      const subscription = JSON.parse(token) as WebPushSubscription;
      for (const event of events) {
        await sendWebPush(deviceId, subscription, event);
      }
    } catch (error) {
      console.warn(
        `[Push] Failed to send web push for device ${deviceId}:`,
        error,
      );
    }
    return;
  }
  if (!Expo.isExpoPushToken(token)) return;
  try {
    const expo = new Expo({ accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN });
    const messages = events.map((e) => ({
      to: token,
      title: e.title,
      body: e.body,
      data: { eventId: e.id },
    }));
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      if (
        tickets.some(
          (t) =>
            t.status === "error" && t.details?.error === "DeviceNotRegistered",
        )
      ) {
        await pruneDeviceToken(deviceId);
      }
    }
  } catch (error) {
    console.warn(`[Push] Failed to send push for device ${deviceId}:`, error);
  }
}

export async function sendPushForUser(
  userId: number,
  events: PushableEvent[],
): Promise<void> {
  if (events.length === 0) return;
  let deviceIds: string[] = [];
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select({ deviceId: devicePushTokens.deviceId })
        .from(devicePushTokens)
        .where(eq(devicePushTokens.userId, userId));
      deviceIds = rows.map((r) => r.deviceId);
    } else {
      deviceIds = [...memoryTokens.entries()]
        .filter(([, t]) => t.userId === userId)
        .map(([deviceId]) => deviceId);
    }
  } catch (error) {
    console.warn(
      `[Push] Failed to read push tokens for user ${userId}:`,
      error,
    );
    return;
  }
  for (const deviceId of deviceIds) {
    await sendPushForDevice(deviceId, events);
  }
}

export async function pruneDeviceToken(deviceId: string): Promise<void> {
  try {
    const db = await getDb();
    if (db) {
      await db
        .delete(devicePushTokens)
        .where(eq(devicePushTokens.deviceId, deviceId));
    } else {
      memoryTokens.delete(deviceId);
    }
  } catch (error) {
    console.warn(
      `[Push] Failed to prune push token for device ${deviceId}:`,
      error,
    );
  }
}

export function clearPushTokensForTests(): void {
  memoryTokens.clear();
}

export function listMemoryTokenDevices(): Array<{
  deviceId: string;
  userId: number | null;
  platform: string | null;
}> {
  return [...memoryTokens.entries()].map(([deviceId, token]) => ({
    deviceId,
    userId: token.userId,
    platform: token.platform,
  }));
}

export function removeMemoryToken(deviceId: string): void {
  memoryTokens.delete(deviceId);
}
