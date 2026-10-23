import { eq } from "drizzle-orm";
import { Expo } from "expo-server-sdk";
import {
  deviceLabels,
  deviceNotificationConfigs,
  devicePushTokens,
  type InsertDevicePushTokenRow,
} from "../drizzle/schema";
import { getDb } from "./db";
import { sendWebPush, type WebPushSubscription } from "./web-push";

export interface PushableEvent {
  id: string;
  title: string;
  body: string;
  type?: string;
  productId?: string;
  distributorId?: string;
}

export interface PushOutcome {
  status: "ok" | "error";
  error: string | null;
  sentAt: number;
  eventCount: number;
  ticketId: string | null;
}

const memoryOutcomes = new Map<string, PushOutcome>();

export async function recordPushOutcome(
  deviceId: string,
  outcome: PushOutcome,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      memoryOutcomes.set(deviceId, outcome);
      return;
    }
    const { pushDeliveryLog } = await import("../drizzle/schema");
    await db
      .insert(pushDeliveryLog)
      .values({
        deviceId,
        status: outcome.status,
        error: outcome.error,
        sentAt: outcome.sentAt,
        eventCount: outcome.eventCount,
        ticketId: outcome.ticketId,
      })
      .onDuplicateKeyUpdate({
        set: {
          status: outcome.status,
          error: outcome.error,
          sentAt: outcome.sentAt,
          eventCount: outcome.eventCount,
          ticketId: outcome.ticketId,
        },
      });
  } catch (error) {
    console.warn(`[Push] Failed to record outcome for device ${deviceId}:`, error);
  }
}

export async function getPushOutcome(deviceId: string): Promise<PushOutcome | null> {
  try {
    const db = await getDb();
    if (!db) return memoryOutcomes.get(deviceId) ?? null;
    const { pushDeliveryLog } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(pushDeliveryLog)
      .where(eq(pushDeliveryLog.deviceId, deviceId));
    const row = rows[0];
    if (!row) return null;
    return {
      status: row.status as "ok" | "error",
      error: row.error,
      sentAt: row.sentAt,
      eventCount: row.eventCount,
      ticketId: row.ticketId,
    };
  } catch (error) {
    console.warn(`[Push] Failed to read outcome for device ${deviceId}:`, error);
    return null;
  }
}

// Batched variant for the diagnostics screen: one query for every device
// instead of one per device.
export async function getPushOutcomes(
  deviceIds: string[],
): Promise<Map<string, PushOutcome>> {
  const out = new Map<string, PushOutcome>();
  if (deviceIds.length === 0) return out;
  try {
    const db = await getDb();
    if (!db) {
      for (const id of deviceIds) {
        const outcome = memoryOutcomes.get(id);
        if (outcome) out.set(id, outcome);
      }
      return out;
    }
    const { pushDeliveryLog } = await import("../drizzle/schema");
    const { inArray } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(pushDeliveryLog)
      .where(inArray(pushDeliveryLog.deviceId, deviceIds));
    for (const row of rows) {
      out.set(row.deviceId, {
        status: row.status as "ok" | "error",
        error: row.error,
        sentAt: row.sentAt,
        eventCount: row.eventCount,
        ticketId: row.ticketId,
      });
    }
  } catch (error) {
    console.warn("[Push] Failed to read outcomes:", error);
  }
  return out;
}

export function clearPushOutcomesForTests(): void {
  memoryOutcomes.clear();
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
      // Routing data: without productId/type the client cannot deep-link a
      // background push (it falls back to Home).
      data: {
        eventId: e.id,
        type: e.type,
        productId: e.productId || undefined,
        distributorId: e.distributorId,
      },
    }));
    const ticketIds: string[] = [];
    let hasNotRegistered = false;
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const t of tickets) {
        if (t.status === "ok") {
          ticketIds.push(t.id);
        } else if (t.details?.error === "DeviceNotRegistered") {
          hasNotRegistered = true;
        }
      }
    }
    if (hasNotRegistered) {
      await pruneDeviceToken(deviceId);
    }
    // Receipts take ~15s to exist; recording them must not block the request
    // path (the test-push endpoint awaited this and hung for 15s).
    void recordReceiptOutcome(expo, deviceId, ticketIds, events.length);
  } catch (error) {
    console.warn(`[Push] Failed to send push for device ${deviceId}:`, error);
  }
}

async function recordReceiptOutcome(
  expo: Expo,
  deviceId: string,
  ticketIds: string[],
  eventCount: number,
): Promise<void> {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  if (ticketIds.length === 0) return;
  try {
    // Expo needs time to attempt delivery before receipts exist.
    await new Promise((r) => setTimeout(r, 15_000));
    const receipts = await expo.getPushNotificationReceiptsAsync(ticketIds);
    let status: "ok" | "error" = "ok";
    let error: string | null = null;
    let ticketId: string | null = ticketIds[0] ?? null;
    for (const [id, receipt] of Object.entries(receipts)) {
      if (receipt.status === "error") {
        status = "error";
        error = receipt.details?.error ?? "Unknown";
        ticketId = id;
        break;
      }
    }
    await recordPushOutcome(deviceId, {
      status,
      error,
      sentAt: Date.now(),
      eventCount,
      ticketId,
    });
  } catch (e) {
    console.warn(`[Push] Receipt check failed for device ${deviceId}:`, e);
  }
}

export async function sendPushForUser(
  userId: number,
  events: PushableEvent[],
  excludeDeviceId?: string,
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
      deviceIds = rows.map((r: any) => r.deviceId);
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
    if (deviceId === excludeDeviceId) continue;
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
      // A token-only device can still carry a label. With the token gone the
      // label has no binding left and would outlive the account, leaking to
      // whoever binds that deviceId next. Drop it only when no notification
      // config keeps the device bound.
      const stillBound = await db
        .select({ deviceId: deviceNotificationConfigs.deviceId })
        .from(deviceNotificationConfigs)
        .where(eq(deviceNotificationConfigs.deviceId, deviceId));
      if (stillBound.length === 0) {
        await db
          .delete(deviceLabels)
          .where(eq(deviceLabels.deviceId, deviceId));
      }
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
  memoryOutcomes.clear();
}

export function listMemoryTokenDevices(): {
  deviceId: string;
  userId: number | null;
  platform: string | null;
}[] {
  return [...memoryTokens.entries()].map(([deviceId, token]) => ({
    deviceId,
    userId: token.userId,
    platform: token.platform,
  }));
}

export function removeMemoryToken(deviceId: string): void {
  memoryTokens.delete(deviceId);
}
