import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  notificationEvents,
  notificationEventDeliveries,
  type InsertDeviceNotificationConfigRow,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { sendPushForUser } from "../push-notifications";
import { dedupKeyForHealth } from "./build-events";
import type {
  MemoryEvent,
  NotificationConfig,
  NotificationEvent,
} from "./types";
import { memoryConfigs, memoryDeliveries, memoryEvents, stripScope } from "./memory-store";
import { rowToEvent } from "./mappers";

export type { NotificationConfig, NotificationEvent } from "./types";
export {
  clearNotificationsForTests,
  listMemoryConfigDevices,
  removeMemoryDevice,
} from "./memory-store";
export { evaluateNotifications } from "./evaluate";

function isDuplicateKeyError(error: unknown): boolean {
  const err = error as { code?: string; errno?: number; message?: string };
  return (
    err?.code === "ER_DUP_ENTRY" ||
    err?.errno === 1062 ||
    /Duplicate entry/i.test(err?.message ?? "")
  );
}

async function processHealthEvents(
  deviceId: string,
  config: NotificationConfig,
  userId: number | null,
): Promise<void> {
  const healthEvents = config.healthEvents;
  if (!healthEvents || healthEvents.length === 0) return;

  const db = await getDb();
  const toInsert: Array<Record<string, unknown>> = [];

  if (db) {
    if (userId == null) return;
    const dedupKeys = healthEvents.map((e) => dedupKeyForHealth(e));
    const uniqueKeys = [...new Set(dedupKeys)];
    const existingRows =
      uniqueKeys.length > 0
        ? await db
            .select({ dedupKey: notificationEvents.dedupKey })
            .from(notificationEvents)
            .where(
              and(
                eq(notificationEvents.userId, userId),
                inArray(notificationEvents.dedupKey, uniqueKeys),
              ),
            )
        : [];
    const existingSet = new Set(existingRows.map((r: any) => r.dedupKey));
    const seen = new Set<string>();
    for (const event of healthEvents) {
      const dedupKey = dedupKeyForHealth(event);
      if (existingSet.has(dedupKey) || seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const dbEvent = {
        id: event.id,
        type: "health",
        title: event.title,
        body: event.body,
        distributorId: event.distributorId,
        productId: "",
        payload: {
          distributorId: event.distributorId,
          distributorName: event.distributorName,
          healthStatus: event.status,
        },
        createdAt: event.createdAt,
        deviceId: null,
        userId,
        dedupKey,
      };
      try {
        await db.insert(notificationEvents).values(dbEvent);
      } catch (error) {
        if (isDuplicateKeyError(error)) continue;
        throw error;
      }
      toInsert.push(dbEvent);
    }
  } else {
    const existingSet = new Set(
      [...memoryEvents.values()]
        .filter((e) => e.userId === userId)
        .map((e) => e.dedupKey),
    );
    const seen = new Set<string>();
    for (const event of healthEvents) {
      const dedupKey = dedupKeyForHealth(event);
      if (existingSet.has(dedupKey) || seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const dbEvent = {
        id: event.id,
        type: "health",
        title: event.title,
        body: event.body,
        distributorId: event.distributorId,
        productId: "",
        payload: {
          distributorId: event.distributorId,
          distributorName: event.distributorName,
          healthStatus: event.status,
        },
        createdAt: event.createdAt,
        deviceId: null,
        userId,
        dedupKey,
      };
      memoryEvents.set(event.id, dbEvent as MemoryEvent);
      toInsert.push(dbEvent);
    }
  }

  if (toInsert.length > 0 && userId !== null) {
    const pushable = toInsert.map((e) => ({
      id: e.id as string,
      title: e.title as string,
      body: e.body as string,
    }));
    void sendPushForUser(userId, pushable, deviceId);
  }
}

export async function upsertDeviceConfig(
  deviceId: string,
  config: NotificationConfig,
  userId: number | null = null,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const existing = memoryConfigs.get(deviceId);
    const effectiveUserId = userId ?? existing?.userId ?? null;
    memoryConfigs.set(deviceId, { config, userId: effectiveUserId });
    await processHealthEvents(deviceId, config, effectiveUserId);
    return;
  }
  const set: Partial<InsertDeviceNotificationConfigRow> = {
    alerts: config.alerts,
    stockWatches: config.stockWatches,
    dateReminders: config.dateReminders,
    updatedAt: Date.now(),
  };
  // Only overwrite prefs when the client sent them; older clients that never
  // upload quiet hours must not wipe a newer client's setting.
  if (config.quietHours !== undefined) set.quietHours = config.quietHours;
  if (userId !== null) set.userId = userId;
  await db
    .insert(deviceNotificationConfigs)
    .values({
      deviceId,
      userId,
      alerts: config.alerts,
      stockWatches: config.stockWatches,
      dateReminders: config.dateReminders,
      ...(config.quietHours !== undefined
        ? { quietHours: config.quietHours }
        : {}),
      updatedAt: Date.now(),
    })
    .onDuplicateKeyUpdate({ set });
  await processHealthEvents(deviceId, config, userId);
}

export async function pullPendingEvents(
  deviceId: string,
  userId?: number,
): Promise<NotificationEvent[]> {
  const db = await getDb();
  if (!db) {
    const delivered = memoryDeliveries.get(deviceId) ?? new Set<string>();
    const list = [...memoryEvents.values()].filter((e) =>
      userId ? e.userId === userId : e.deviceId === deviceId,
    );
    const pending = list.filter((e) => !delivered.has(e.id));
    for (const e of pending) delivered.add(e.id);
    memoryDeliveries.set(deviceId, delivered);
    return pending.map((e) => stripScope(e));
  }
  const rows = await db
    .select({
      id: notificationEvents.id,
      type: notificationEvents.type,
      title: notificationEvents.title,
      body: notificationEvents.body,
      payload: notificationEvents.payload,
      createdAt: notificationEvents.createdAt,
    })
    .from(notificationEvents)
    .leftJoin(
      notificationEventDeliveries,
      and(
        eq(notificationEventDeliveries.eventId, notificationEvents.id),
        eq(notificationEventDeliveries.deviceId, deviceId),
      ),
    )
    .where(
      and(
        userId
          ? eq(notificationEvents.userId, userId)
          : eq(notificationEvents.deviceId, deviceId),
        isNull(notificationEventDeliveries.eventId),
      ),
    );
  if (rows.length > 0) {
    await db
      .insert(notificationEventDeliveries)
      .values(
        rows.map((r: any) => ({
          deviceId,
          eventId: r.id,
          deliveredAt: Date.now(),
        })),
      )
      .onDuplicateKeyUpdate({ set: { deliveredAt: sql`deliveredAt` } });
  }
  return rows.map(rowToEvent);
}

// Notification events and their delivery receipts accumulate forever otherwise:
// they are only removed when a device is unbound. Batched like
// purgeOldHistory so a large table never holds a long lock; the remainder
// drains on later warmer ticks.
const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const EVENT_PURGE_BATCH_SIZE = 1000;
const EVENT_PURGE_MAX_BATCHES_PER_TICK = 10;

export async function purgeOldNotificationEvents(now: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    const cutoff = now - EVENT_RETENTION_MS;
    for (const [id, event] of memoryEvents) {
      if (event.createdAt < cutoff) memoryEvents.delete(id);
    }
    return;
  }
  const cutoff = now - EVENT_RETENTION_MS;
  for (let batch = 0; batch < EVENT_PURGE_MAX_BATCHES_PER_TICK; batch++) {
    // Deliveries cascade from notification_events (FK onDelete cascade), so
    // deleting the event row is sufficient.
    const result = await db
      .delete(notificationEvents)
      .where(lt(notificationEvents.createdAt, cutoff))
      .limit(EVENT_PURGE_BATCH_SIZE);
    const affected = Number(
      (result as { affectedRows?: unknown }).affectedRows ?? 0,
    );
    if (!Number.isFinite(affected) || affected < EVENT_PURGE_BATCH_SIZE) break;
  }
}
