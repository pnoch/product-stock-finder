import { isDuplicateKeyError } from "../db-errors";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  notificationEvents,
  notificationEventDeliveries,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { sendPushForDevice, sendPushForUser } from "../push-notifications";
import { deliverEmailForEvent } from "./email-alerts";
import { deliverWebhookForEvent } from "./webhook-alerts";
import type { NotificationConfig } from "./types";
import { draftToEvent } from "./mappers";
import {
  buildEvents,
  type HistoryLookup,
  type PriceLookup,
} from "./build-events";
import {
  buildDigestDraft,
  holdForDigest,
  scopeKeyForDevice,
  scopeKeyForUser,
  takeDigestHeld,
} from "./digest";
import { aggregateConfigs } from "./aggregate-configs";
import { DELIVERY_GRACE_MS, isEventBlocking } from "./event-blocking";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function evaluateConfigDb(
  db: Db,
  deviceId: string,
  config: NotificationConfig,
  now: number,
  getPrice: PriceLookup,
  getHistory: HistoryLookup,
): Promise<void> {
  const existing = await db
    .select({
      id: notificationEvents.id,
      dedupKey: notificationEvents.dedupKey,
      createdAt: notificationEvents.createdAt,
    })
    .from(notificationEvents)
    .where(
      and(
        eq(notificationEvents.deviceId, deviceId),
        gt(notificationEvents.createdAt, now - DELIVERY_GRACE_MS),
      ),
    );
  const delivered = await db
    .select({ eventId: notificationEventDeliveries.eventId })
    .from(notificationEventDeliveries)
    .where(eq(notificationEventDeliveries.deviceId, deviceId));
  const deliveredSet = new Set(delivered.map((d) => d.eventId));
  const blocked = new Set(
    existing
      .filter((e) =>
        isEventBlocking(e.createdAt, deliveredSet.has(e.id) ? 1 : 0, 1, now),
      )
      .map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now, getPrice, getHistory);
  const scopeKey = scopeKeyForDevice(deviceId);
  const holdable = drafts.filter((d) => !blocked.has(d.dedupKey));
  if (holdForDigest(scopeKey, [config], holdable, now)) return;
  const held = takeDigestHeld(scopeKey);
  let combined = drafts;
  if (held.length > 0) {
    const heldDrafts = [
      ...new Map([...held, ...drafts].map((d) => [d.dedupKey, d])).values(),
    ];
    const digest = buildDigestDraft(
      heldDrafts,
      scopeKey,
      now,
      config.quietHours?.utcOffsetMinutes,
    );
    combined =
      digest && !blocked.has(digest.dedupKey) ? [digest] : [...held, ...drafts];
  }
  const filtered = combined.filter((d) => !blocked.has(d.dedupKey));
  const deduped = [...new Map(filtered.map((d) => [d.dedupKey, d])).values()];
  const toInsert = deduped.map((d) => ({ ...d, deviceId, userId: null }));
  if (toInsert.length > 0) {
    const keys = toInsert.map((d) => d.dedupKey);
    try {
      await db
        .delete(notificationEvents)
        .where(
          and(
            eq(notificationEvents.deviceId, deviceId),
            inArray(notificationEvents.dedupKey, keys),
          ),
        );
      await db.insert(notificationEvents).values(toInsert);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    void sendPushForDevice(
      deviceId,
      toInsert.map((d) => ({ ...draftToEvent(d), userId: null, deviceId })),
    );
  }
}

export async function evaluateUserDb(
  db: Db,
  userId: number,
  devices: { deviceId: string; config: NotificationConfig }[],
  now: number,
  getPrice: PriceLookup,
  getHistory: HistoryLookup,
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
    .where(
      and(
        eq(notificationEvents.userId, userId),
        gt(notificationEvents.createdAt, now - DELIVERY_GRACE_MS),
      ),
    );
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
      .filter((e) =>
        isEventBlocking(
          e.createdAt,
          deliveryCounts.get(e.id) ?? 0,
          boundCount,
          now,
        ),
      )
      .map((e) => e.dedupKey),
  );
  const drafts = await buildEvents(config, now, getPrice, getHistory);
  const scopeKey = scopeKeyForUser(userId);
  const holdable = drafts.filter((d) => !pending.has(d.dedupKey));
  if (
    holdForDigest(
      scopeKey,
      devices.map((d) => d.config),
      holdable,
      now,
    )
  )
    return;
  const held = takeDigestHeld(scopeKey);
  let combined = drafts;
  if (held.length > 0) {
    const heldDrafts = [
      ...new Map([...held, ...drafts].map((d) => [d.dedupKey, d])).values(),
    ];
    const digest = buildDigestDraft(
      heldDrafts,
      scopeKey,
      now,
      config.quietHours?.utcOffsetMinutes,
    );
    combined =
      digest && !pending.has(digest.dedupKey) ? [digest] : [...held, ...drafts];
  }
  const filtered = combined.filter((d) => !pending.has(d.dedupKey));
  const deduped = [...new Map(filtered.map((d) => [d.dedupKey, d])).values()];
  const toInsert = deduped.map((d) => ({ ...d, userId, deviceId: null }));
  if (toInsert.length > 0) {
    const keys = toInsert.map((d) => d.dedupKey);
    try {
      await db
        .delete(notificationEvents)
        .where(
          and(
            eq(notificationEvents.userId, userId),
            inArray(notificationEvents.dedupKey, keys),
          ),
        );
      await db.insert(notificationEvents).values(toInsert);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    void sendPushForUser(
      userId,
      toInsert.map((d) => ({ ...draftToEvent(d), userId, deviceId: null })),
    );
    void (async () => {
      for (const event of toInsert) {
        const payload =
          event.payload && typeof event.payload === "object"
            ? (event.payload as { productId?: unknown })
            : null;
        const productId =
          typeof payload?.productId === "string" ? payload.productId : null;
        await deliverEmailForEvent(userId, {
          dedupKey: event.dedupKey,
          title: event.title,
          body: event.body,
          productId,
        });
      }
    })().catch(() => {});
    void (async () => {
      for (const event of toInsert) {
        const payload =
          event.payload && typeof event.payload === "object"
            ? (event.payload as { productId?: unknown })
            : null;
        const productId =
          typeof payload?.productId === "string" ? payload.productId : null;
        await deliverWebhookForEvent(userId, {
          dedupKey: event.dedupKey,
          title: event.title,
          body: event.body,
          productId,
        });
      }
    })().catch(() => {});
  }
}
