import { and, eq, isNull } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  notificationEvents,
  type InsertNotificationEventRow,
} from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../lib/catalog";
import { getDistributorById } from "../lib/distributors";
import { getAllParserIds } from "../lib/scrapers/registry";
import { getCachedPrice } from "./price-cache";
import { getDb } from "./db";
import { convertPrice, formatPrice } from "../lib/currency";

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

const memoryConfigs = new Map<string, NotificationConfig>();
const memoryEvents = new Map<string, NotificationEvent[]>();

interface EventDraft extends Omit<InsertNotificationEventRow, "deviceId"> {
  dedupKey: string;
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function upsertDeviceConfig(
  deviceId: string,
  config: NotificationConfig,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryConfigs.set(deviceId, config);
    return;
  }
  await db
    .insert(deviceNotificationConfigs)
    .values({
      deviceId,
      alerts: config.alerts,
      stockWatches: config.stockWatches,
      dateReminders: config.dateReminders,
      updatedAt: Date.now(),
    })
    .onDuplicateKeyUpdate({
      set: {
        alerts: config.alerts,
        stockWatches: config.stockWatches,
        dateReminders: config.dateReminders,
        updatedAt: Date.now(),
      },
    });
}

export async function evaluateNotifications(now: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    for (const [deviceId, config] of memoryConfigs) {
      await evaluateConfig(deviceId, config, now);
    }
    return;
  }
  const rows = await db.select().from(deviceNotificationConfigs);
  for (const row of rows) {
    const config: NotificationConfig = {
      alerts: (row.alerts as NotificationConfig["alerts"]) ?? [],
      stockWatches: (row.stockWatches as NotificationConfig["stockWatches"]) ?? [],
      dateReminders: (row.dateReminders as NotificationConfig["dateReminders"]) ?? [],
    };
    const existing = await db
      .select({ dedupKey: notificationEvents.dedupKey })
      .from(notificationEvents)
      .where(
        and(
          eq(notificationEvents.deviceId, row.deviceId),
          isNull(notificationEvents.deliveredAt),
        ),
      );
    const undelivered = new Set(existing.map((e) => e.dedupKey));
    const drafts = await buildEvents(config, now);
    const toInsert = drafts
      .filter((d) => !undelivered.has(d.dedupKey))
      .map((d) => ({ ...d, deviceId: row.deviceId }));
    if (toInsert.length > 0) await db.insert(notificationEvents).values(toInsert);
  }
}

async function evaluateConfig(
  deviceId: string,
  config: NotificationConfig,
  now: number,
): Promise<void> {
  const undelivered = new Set(
    (memoryEvents.get(deviceId) ?? []).map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now);
  const list = memoryEvents.get(deviceId) ?? [];
  for (const draft of drafts) {
    if (undelivered.has(draft.dedupKey)) continue;
    list.push(draftToEvent(draft, deviceId));
  }
  memoryEvents.set(deviceId, list);
}

function dedupKeyFor(event: NotificationEvent): string {
  if (event.type === "price_drop") return `price_drop:${event.alertId}`;
  if (event.type === "restock") return `restock:${event.productId}:${event.distributorId}`;
  return `reminder:${event.reminderId}`;
}

async function buildEvents(config: NotificationConfig, now: number): Promise<EventDraft[]> {
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
      const converted = convertPrice(snapshot.price, snapshot.currency, alert.currency);
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
      deliveredAt: null,
    });
  }

  for (const watch of config.stockWatches) {
    const product = PRODUCT_CATALOG.find((p) => p.id === watch.productId);
    if (!product) continue;
    if (watch.lastKnownStatus === "in_stock") continue;
    const snapshot = await getCachedPrice(watch.distributorId, product.modelNumber);
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
      deliveredAt: null,
    });
  }

  for (const reminder of config.dateReminders) {
    const product = PRODUCT_CATALOG.find((p) => p.id === reminder.productId);
    if (!product) continue;
    if (now < new Date(reminder.reminderDate).getTime()) continue;
    const distributorName =
      getDistributorById(reminder.distributorId)?.name ?? reminder.distributorId;
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
      deliveredAt: null,
    });
  }

  return events;
}

export async function pullPendingEvents(
  deviceId: string,
): Promise<NotificationEvent[]> {
  const db = await getDb();
  if (!db) {
    const list = memoryEvents.get(deviceId) ?? [];
    memoryEvents.set(deviceId, []);
    return list;
  }
  const rows = await db
    .select()
    .from(notificationEvents)
    .where(
      and(
        eq(notificationEvents.deviceId, deviceId),
        isNull(notificationEvents.deliveredAt),
      ),
    );
  if (rows.length > 0) {
    await db
      .update(notificationEvents)
      .set({ deliveredAt: Date.now() })
      .where(
        and(
          eq(notificationEvents.deviceId, deviceId),
          isNull(notificationEvents.deliveredAt),
        ),
      );
  }
  return rows.map(rowToEvent);
}

export function clearNotificationsForTests(): void {
  memoryConfigs.clear();
  memoryEvents.clear();
}

function draftToEvent(draft: EventDraft, deviceId: string): NotificationEvent {
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