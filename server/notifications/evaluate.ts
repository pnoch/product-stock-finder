import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  notificationEvents,
  notificationEventDeliveries,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { sendPushForDevice, sendPushForUser } from "../push-notifications";
import type { NotificationConfig, NotificationEvent } from "./types";
import {
  deliveryCount,
  memoryConfigs,
  memoryDeliveries,
  memoryEvents,
} from "./memory-store";
import { draftToEvent, rowToConfig } from "./mappers";
import { buildEvents, dedupKeyFor } from "./build-events";
import {
  buildDigestDraft,
  holdForDigest,
  scopeKeyForDevice,
  scopeKeyForUser,
  takeDigestHeld,
} from "./digest";

function isDuplicateKeyError(error: unknown): boolean {
  const err = error as { code?: string; errno?: number; message?: string };
  return (
    err?.code === "ER_DUP_ENTRY" ||
    err?.errno === 1062 ||
    /Duplicate entry/i.test(err?.message ?? "")
  );
}

// Once an event has been delivered everywhere its dedup key would otherwise
// be released, and a persisting condition (price still below target, past-due
// reminder) would re-fire on every warmer tick. Keep the key blocked for a
// cooldown window after creation; legitimate re-fires (e.g. a second restock)
// resume afterwards.
const EVENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function evaluateNotifications(now: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    await evaluateMemory(now);
    return;
  }
  // Paged: device rows are unbounded while a tick must stay short. New rows
  // inserted mid-tick order after the cursor and are picked up next tick.
  const PAGE_SIZE = 500;
  let offset = 0;
  for (;;) {
    const rows = await db
      .select()
      .from(deviceNotificationConfigs)
      .orderBy(asc(deviceNotificationConfigs.deviceId))
      .limit(PAGE_SIZE)
      .offset(offset);
    if (rows.length === 0) break;
    await evaluateConfigPage(db, rows, now);
    if (rows.length < PAGE_SIZE) break;
    offset += rows.length;
  }
}

async function evaluateConfigPage(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  rows: Array<{
    deviceId: string;
    userId: number | null;
    alerts: unknown;
    stockWatches: unknown;
    dateReminders: unknown;
    quietHours?: unknown;
  }>,
  now: number,
): Promise<void> {
  const anonDevices: Array<{ deviceId: string; config: NotificationConfig }> =
    [];
  const userDevices = new Map<
    number,
    Array<{ deviceId: string; config: NotificationConfig }>
  >();
  for (const row of rows) {
    const config = rowToConfig(row);
    if (row.userId) {
      const list = userDevices.get(row.userId) ?? [];
      list.push({ deviceId: row.deviceId, config });
      userDevices.set(row.userId, list);
    } else {
      anonDevices.push({ deviceId: row.deviceId, config });
    }
  }
  for (const { deviceId, config } of anonDevices) {
    await evaluateConfigDb(db, deviceId, config, now);
  }
  for (const [userId, devices] of userDevices) {
    await evaluateUserDb(db, userId, devices, now);
  }
}

async function evaluateMemory(now: number): Promise<void> {
  const anonDevices: Array<{ deviceId: string; config: NotificationConfig }> =
    [];
  const userDevices = new Map<
    number,
    Array<{ deviceId: string; config: NotificationConfig }>
  >();
  for (const [deviceId, entry] of memoryConfigs) {
    if (entry.userId) {
      const list = userDevices.get(entry.userId) ?? [];
      list.push({ deviceId, config: entry.config });
      userDevices.set(entry.userId, list);
    } else {
      anonDevices.push({ deviceId, config: entry.config });
    }
  }
  for (const { deviceId, config } of anonDevices) {
    await evaluateAnonMemory(deviceId, config, now);
  }
  for (const [userId, devices] of userDevices) {
    await evaluateUserMemory(userId, devices, now);
  }
}

async function evaluateAnonMemory(
  deviceId: string,
  config: NotificationConfig,
  now: number,
): Promise<void> {
  const delivered = memoryDeliveries.get(deviceId) ?? new Set<string>();
  const blocked = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.deviceId === deviceId)
      .filter(
        (e) =>
          !delivered.has(e.id) || now - e.createdAt < EVENT_COOLDOWN_MS,
      )
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const scopeKey = scopeKeyForDevice(deviceId);
  if (holdForDigest(scopeKey, [config], drafts, now)) return;
  const held = takeDigestHeld(scopeKey);
  let toDeliver = drafts;
  if (held.length > 0) {
    const digest = buildDigestDraft([...held, ...drafts], scopeKey, now);
    toDeliver =
      digest && !blocked.has(digest.dedupKey)
        ? [digest]
        : [...held, ...drafts];
  }
  const added: NotificationEvent[] = [];
  const seen = new Set<string>();
  for (const draft of toDeliver) {
    if (blocked.has(draft.dedupKey) || seen.has(draft.dedupKey)) continue;
    seen.add(draft.dedupKey);
    const event = { ...draftToEvent(draft), userId: null, deviceId };
    memoryEvents.set(event.id, event);
    added.push(event);
  }
  if (added.length > 0) void sendPushForDevice(deviceId, added);
}

async function evaluateUserMemory(
  userId: number,
  devices: Array<{ deviceId: string; config: NotificationConfig }>,
  now: number,
): Promise<void> {
  const boundCount = devices.length;
  const config = aggregateConfigs(devices.map((d) => d.config));
  const blocked = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.userId === userId)
      .filter(
        (e) =>
          deliveryCount(e.id) < boundCount ||
          now - e.createdAt < EVENT_COOLDOWN_MS,
      )
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const scopeKey = scopeKeyForUser(userId);
  if (
    holdForDigest(
      scopeKey,
      devices.map((d) => d.config),
      drafts,
      now,
    )
  )
    return;
  const held = takeDigestHeld(scopeKey);
  let toDeliver = drafts;
  if (held.length > 0) {
    const digest = buildDigestDraft([...held, ...drafts], scopeKey, now);
    toDeliver =
      digest && !blocked.has(digest.dedupKey)
        ? [digest]
        : [...held, ...drafts];
  }
  const added: NotificationEvent[] = [];
  const seen = new Set<string>();
  for (const draft of toDeliver) {
    if (blocked.has(draft.dedupKey) || seen.has(draft.dedupKey)) continue;
    seen.add(draft.dedupKey);
    const event = { ...draftToEvent(draft), userId, deviceId: null };
    memoryEvents.set(event.id, event);
    added.push(event);
  }
  if (added.length > 0) void sendPushForUser(userId, added);
}

function aggregateConfigs(configs: NotificationConfig[]): NotificationConfig {
  const alerts = new Map<string, NotificationConfig["alerts"][number]>();
  const stockWatches = new Map<
    string,
    NotificationConfig["stockWatches"][number]
  >();
  const dateReminders = new Map<
    string,
    NotificationConfig["dateReminders"][number]
  >();
  for (const config of configs) {
    for (const alert of config.alerts) {
      if (!alerts.has(alert.id)) alerts.set(alert.id, alert);
    }
    for (const watch of config.stockWatches) {
      if (!stockWatches.has(watch.id)) stockWatches.set(watch.id, watch);
    }
    for (const reminder of config.dateReminders) {
      if (!dateReminders.has(reminder.id))
        dateReminders.set(reminder.id, reminder);
    }
  }
  return {
    alerts: [...alerts.values()],
    stockWatches: [...stockWatches.values()],
    dateReminders: [...dateReminders.values()],
  };
}

async function evaluateConfigDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  deviceId: string,
  config: NotificationConfig,
  now: number,
): Promise<void> {
  const existing = await db
    .select({
      id: notificationEvents.id,
      dedupKey: notificationEvents.dedupKey,
      createdAt: notificationEvents.createdAt,
    })
    .from(notificationEvents)
    .where(eq(notificationEvents.deviceId, deviceId));
  const delivered = await db
    .select({ eventId: notificationEventDeliveries.eventId })
    .from(notificationEventDeliveries)
    .where(eq(notificationEventDeliveries.deviceId, deviceId));
  const deliveredSet = new Set(delivered.map((d) => d.eventId));
  const blocked = new Set(
    existing
      .filter(
        (e) =>
          !deliveredSet.has(e.id) || now - e.createdAt < EVENT_COOLDOWN_MS,
      )
      .map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now);
  const scopeKey = scopeKeyForDevice(deviceId);
  if (holdForDigest(scopeKey, [config], drafts, now)) return;
  const held = takeDigestHeld(scopeKey);
  let combined = drafts;
  if (held.length > 0) {
    const digest = buildDigestDraft([...held, ...drafts], scopeKey, now);
    combined =
      digest && !blocked.has(digest.dedupKey)
        ? [digest]
        : [...held, ...drafts];
  }
  const filtered = combined.filter((d) => !blocked.has(d.dedupKey));
  const deduped = [...new Map(filtered.map((d) => [d.dedupKey, d])).values()];
  const toInsert = deduped.map((d) => ({ ...d, deviceId, userId: null }));
  if (toInsert.length > 0) {
    try {
      await db
        .insert(notificationEvents)
        .values(toInsert)
        .onDuplicateKeyUpdate({ set: { id: sql`id` } });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    void sendPushForDevice(deviceId, toInsert);
  }
}

async function evaluateUserDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  devices: Array<{ deviceId: string; config: NotificationConfig }>,
  now: number,
): Promise<void> {
  const boundCount = devices.length;
  const config = aggregateConfigs(devices.map((d) => d.config));
  const existing = await db
    .select({
      id: notificationEvents.id,
      dedupKey: notificationEvents.dedupKey,
      createdAt: notificationEvents.createdAt,
    })
    .from(notificationEvents)
    .where(eq(notificationEvents.userId, userId));
  const eventIds = existing.map((e) => e.id);
  const deliveryCounts = new Map<string, number>();
  if (eventIds.length > 0) {
    const deliveries = await db
      .select({ eventId: notificationEventDeliveries.eventId })
      .from(notificationEventDeliveries)
      .where(inArray(notificationEventDeliveries.eventId, eventIds));
    for (const d of deliveries as any[]) {
      deliveryCounts.set((d as any).eventId, (deliveryCounts.get((d as any).eventId) ?? 0) + 1);
    }
  }
  const pending = new Set(
    existing
      .filter(
        (e) =>
          (deliveryCounts.get(e.id) ?? 0) < boundCount ||
          now - e.createdAt < EVENT_COOLDOWN_MS,
      )
      .map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now);
  const scopeKey = scopeKeyForUser(userId);
  if (
    holdForDigest(
      scopeKey,
      devices.map((d) => d.config),
      drafts,
      now,
    )
  )
    return;
  const held = takeDigestHeld(scopeKey);
  let combined = drafts;
  if (held.length > 0) {
    const digest = buildDigestDraft([...held, ...drafts], scopeKey, now);
    combined =
      digest && !pending.has(digest.dedupKey)
        ? [digest]
        : [...held, ...drafts];
  }
  const filtered = combined.filter((d) => !pending.has(d.dedupKey));
  const deduped = [...new Map(filtered.map((d) => [d.dedupKey, d])).values()];
  const toInsert = deduped.map((d) => ({ ...d, userId, deviceId: null }));
  if (toInsert.length > 0) {
    try {
      await db
        .insert(notificationEvents)
        .values(toInsert)
        .onDuplicateKeyUpdate({ set: { id: sql`id` } });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    void sendPushForUser(userId, toInsert);
  }
}
