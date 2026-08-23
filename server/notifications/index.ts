import { and, eq, isNull } from "drizzle-orm";
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

async function processHealthEvents(
  deviceId: string,
  config: NotificationConfig,
  userId: number | null,
): Promise<void> {
  const healthEvents = config.healthEvents;
  if (!healthEvents || healthEvents.length === 0) return;

  const db = await getDb();
  const toInsert: Array<Record<string, unknown>> = [];

  for (const event of healthEvents) {
    const dedupKey = dedupKeyForHealth(event);
    if (db) {
      if (userId == null) continue;
      const existing = await db
        .select({ id: notificationEvents.id })
        .from(notificationEvents)
        .where(
          and(
            eq(notificationEvents.userId, userId),
            eq(notificationEvents.dedupKey, dedupKey),
          ),
        );
      if (existing.length > 0) continue;
    } else {
      const exists = [...memoryEvents.values()].some(
        (e) => e.userId === userId && e.dedupKey === dedupKey,
      );
      if (exists) continue;
    }

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

    if (db) {
      await db.insert(notificationEvents).values(dbEvent);
    } else {
      memoryEvents.set(event.id, dbEvent as MemoryEvent);
    }
    toInsert.push(dbEvent);
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
  if (userId !== null) set.userId = userId;
  await db
    .insert(deviceNotificationConfigs)
    .values({
      deviceId,
      userId,
      alerts: config.alerts,
      stockWatches: config.stockWatches,
      dateReminders: config.dateReminders,
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
    await db.insert(notificationEventDeliveries).values(
      rows.map((r) => ({
        deviceId,
        eventId: r.id,
        deliveredAt: Date.now(),
      })),
    );
  }
  return rows.map(rowToEvent);
}
