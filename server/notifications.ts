import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  notificationEvents,
  notificationEventDeliveries,
  type InsertDeviceNotificationConfigRow,
  type InsertNotificationEventRow,
} from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../lib/catalog";
import { getDistributorById } from "../lib/distributors";
import { getAllParserIds } from "../lib/scrapers/registry";
import { getCachedPrice } from "./price-cache";
import { getDb } from "./db";
import { convertPrice, formatPrice } from "../lib/currency";
import { sendPushForDevice, sendPushForUser } from "./push-notifications";

export interface NotificationConfig {
  alerts: Array<{
    id: string;
    productId: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
  }>;
  stockWatches: Array<{
    id: string;
    productId: string;
    distributorId: string;
    lastKnownStatus?: string;
  }>;
  dateReminders: Array<{
    id: string;
    productId: string;
    distributorId: string;
    reminderDate: string;
  }>;
}

export interface NotificationEvent {
  id: string;
  type: "price_drop" | "restock" | "reminder";
  title: string;
  body: string;
  alertId?: string;
  watchId?: string;
  reminderId?: string;
  productId: string;
  distributorId?: string;
  targetPrice?: number;
  currency?: string;
  triggeredPrice?: number;
  createdAt: number;
}

interface MemoryEvent extends NotificationEvent {
  userId: number | null;
  deviceId: string | null;
}

const memoryConfigs = new Map<
  string,
  { config: NotificationConfig; userId: number | null }
>();
const memoryEvents = new Map<string, MemoryEvent>();
const memoryDeliveries = new Map<string, Set<string>>();

interface EventDraft extends Omit<
  InsertNotificationEventRow,
  "deviceId" | "userId"
> {
  dedupKey: string;
}

function newEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
}

export async function evaluateNotifications(now: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    await evaluateMemory(now);
    return;
  }
  const rows = await db.select().from(deviceNotificationConfigs);
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
  const undelivered = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.deviceId === deviceId)
      .filter((e) => !delivered.has(e.id))
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const added: NotificationEvent[] = [];
  for (const draft of drafts) {
    if (undelivered.has(draft.dedupKey)) continue;
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
  const pending = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.userId === userId)
      .filter((e) => deliveryCount(e.id) < boundCount)
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const added: NotificationEvent[] = [];
  for (const draft of drafts) {
    if (pending.has(draft.dedupKey)) continue;
    const event = { ...draftToEvent(draft), userId, deviceId: null };
    memoryEvents.set(event.id, event);
    added.push(event);
  }
  if (added.length > 0) void sendPushForUser(userId, added);
}

function deliveryCount(eventId: string): number {
  let count = 0;
  for (const delivered of memoryDeliveries.values()) {
    if (delivered.has(eventId)) count += 1;
  }
  return count;
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
    })
    .from(notificationEvents)
    .where(eq(notificationEvents.deviceId, deviceId));
  const delivered = await db
    .select({ eventId: notificationEventDeliveries.eventId })
    .from(notificationEventDeliveries)
    .where(eq(notificationEventDeliveries.deviceId, deviceId));
  const deliveredSet = new Set(delivered.map((d) => d.eventId));
  const undelivered = new Set(
    existing.filter((e) => !deliveredSet.has(e.id)).map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now);
  const toInsert = drafts
    .filter((d) => !undelivered.has(d.dedupKey))
    .map((d) => ({ ...d, deviceId, userId: null }));
  if (toInsert.length > 0) {
    await db.insert(notificationEvents).values(toInsert);
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
    for (const d of deliveries) {
      deliveryCounts.set(d.eventId, (deliveryCounts.get(d.eventId) ?? 0) + 1);
    }
  }
  const pending = new Set(
    existing
      .filter((e) => (deliveryCounts.get(e.id) ?? 0) < boundCount)
      .map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now);
  const toInsert = drafts
    .filter((d) => !pending.has(d.dedupKey))
    .map((d) => ({ ...d, userId, deviceId: null }));
  if (toInsert.length > 0) {
    await db.insert(notificationEvents).values(toInsert);
    void sendPushForUser(userId, toInsert);
  }
}

function dedupKeyFor(event: NotificationEvent): string {
  if (event.type === "price_drop") return `price_drop:${event.alertId}`;
  if (event.type === "restock")
    return `restock:${event.productId}:${event.distributorId}`;
  return `reminder:${event.reminderId}`;
}

async function buildEvents(
  config: NotificationConfig,
  now: number,
): Promise<EventDraft[]> {
  const events: EventDraft[] = [];

  for (const alert of config.alerts) {
    const product = PRODUCT_CATALOG.find((p) => p.id === alert.productId);
    if (!product) continue;
    const distributorIds = alert.distributorId
      ? [alert.distributorId]
      : getAllParserIds();
    let bestPrice: number | null = null;
    let bestDistributor: string | null = null;
    for (const distributorId of distributorIds) {
      const snapshot = await getCachedPrice(distributorId, product.modelNumber);
      if (!snapshot || snapshot.stockStatus !== "in_stock") continue;
      const converted = convertPrice(
        snapshot.price,
        snapshot.currency,
        alert.currency,
      );
      if (bestPrice === null || converted < bestPrice) {
        bestPrice = converted;
        bestDistributor = distributorId;
      }
    }
    if (bestPrice === null || bestPrice > alert.targetPrice) continue;
    events.push({
      id: newEventId(),
      type: "price_drop",
      dedupKey: `price_drop:${alert.id}`,
      title: "💸 Price Drop Alert!",
      body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — below your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
      payload: {
        alertId: alert.id,
        productId: alert.productId,
        distributorId: bestDistributor,
        targetPrice: alert.targetPrice,
        currency: alert.currency,
        triggeredPrice: bestPrice,
      },
      createdAt: now,
    });
  }

  for (const watch of config.stockWatches) {
    const product = PRODUCT_CATALOG.find((p) => p.id === watch.productId);
    if (!product) continue;
    if (watch.lastKnownStatus === "in_stock") continue;
    const snapshot = await getCachedPrice(
      watch.distributorId,
      product.modelNumber,
    );
    if (!snapshot || snapshot.stockStatus !== "in_stock") continue;
    const distributorName =
      getDistributorById(watch.distributorId)?.name ?? watch.distributorId;
    events.push({
      id: newEventId(),
      type: "restock",
      dedupKey: `restock:${watch.productId}:${watch.distributorId}`,
      title: "🟢 Back In Stock!",
      body: `${product.name} is now available at ${distributorName}.`,
      payload: {
        watchId: watch.id,
        productId: watch.productId,
        distributorId: watch.distributorId,
      },
      createdAt: now,
    });
  }

  for (const reminder of config.dateReminders) {
    const product = PRODUCT_CATALOG.find((p) => p.id === reminder.productId);
    if (!product) continue;
    if (now < new Date(reminder.reminderDate).getTime()) continue;
    const distributorName =
      getDistributorById(reminder.distributorId)?.name ??
      reminder.distributorId;
    events.push({
      id: newEventId(),
      type: "reminder",
      dedupKey: `reminder:${reminder.id}`,
      title: "📦 Back-Order Reminder",
      body: `Check ${distributorName} for ${product.name} — your reminder date is here!`,
      payload: {
        reminderId: reminder.id,
        productId: reminder.productId,
        distributorId: reminder.distributorId,
      },
      createdAt: now,
    });
  }

  return events;
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

export function clearNotificationsForTests(): void {
  memoryConfigs.clear();
  memoryEvents.clear();
  memoryDeliveries.clear();
}

function stripScope(event: MemoryEvent): NotificationEvent {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    body: event.body,
    alertId: event.alertId,
    watchId: event.watchId,
    reminderId: event.reminderId,
    productId: event.productId,
    distributorId: event.distributorId,
    targetPrice: event.targetPrice,
    currency: event.currency,
    triggeredPrice: event.triggeredPrice,
    createdAt: event.createdAt,
  };
}

function rowToConfig(row: {
  alerts: unknown;
  stockWatches: unknown;
  dateReminders: unknown;
}): NotificationConfig {
  return {
    alerts: (row.alerts as NotificationConfig["alerts"]) ?? [],
    stockWatches:
      (row.stockWatches as NotificationConfig["stockWatches"]) ?? [],
    dateReminders:
      (row.dateReminders as NotificationConfig["dateReminders"]) ?? [],
  };
}

function draftToEvent(draft: EventDraft): NotificationEvent {
  const payload = (draft.payload ?? {}) as Record<string, unknown>;
  return {
    id: draft.id,
    type: draft.type as NotificationEvent["type"],
    title: draft.title,
    body: draft.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: draft.createdAt,
  };
}

function rowToEvent(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  createdAt: number;
}): NotificationEvent {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type as NotificationEvent["type"],
    title: row.title,
    body: row.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: row.createdAt,
  };
}
