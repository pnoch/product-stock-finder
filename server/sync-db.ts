import { and, eq, gt, lt, or, sql, type SQLWrapper } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  appSettings,
  backOrderReminders,
  priceAlerts,
  watchlistItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { SyncItem } from "../lib/types";

const TOMBSTONE_PURGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * LWW admission decision. Ordering must compare like clocks: the incoming
 * item's `updatedAt` is a client-clock value, so it is judged against the
 * stored client-clock stamp when one exists. Rows written before client
 * stamping (null) fall back to the server-stamped comparison.
 */
export function shouldAcceptSyncWrite(
  existingClientUpdatedAtMs: number | null,
  existingServerUpdatedAtMs: number,
  incomingUpdatedAt: number,
): boolean {
  if (existingClientUpdatedAtMs === null) {
    return incomingUpdatedAt > existingServerUpdatedAtMs;
  }
  return incomingUpdatedAt > existingClientUpdatedAtMs;
}

/**
 * Returns all rows for the user whose updatedAtMs OR deletedAtMs is newer than
 * `since` (epoch ms). `since === null` means first sync (return everything).
 * Tombstoned rows carry `data: null` so the client only needs the deletion.
 */
export async function listChangedItems(
  userId: number,
  since: number | null,
): Promise<SyncItem[]> {
  const db = await getDb();
  if (!db) return [];
  const sinceMs = since ?? 0;
  const changed = (updatedAtMs: SQLWrapper, deletedAtMs: SQLWrapper) =>
    or(gt(updatedAtMs, sinceMs), gt(deletedAtMs, sinceMs));

  const [watchlist, alerts, reminders, settings] = await Promise.all([
    db
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, userId),
          changed(watchlistItems.updatedAtMs, watchlistItems.deletedAtMs),
        ),
      ),
    db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, userId),
          changed(priceAlerts.updatedAtMs, priceAlerts.deletedAtMs),
        ),
      ),
    db
      .select()
      .from(backOrderReminders)
      .where(
        and(
          eq(backOrderReminders.userId, userId),
          changed(
            backOrderReminders.updatedAtMs,
            backOrderReminders.deletedAtMs,
          ),
        ),
      ),
    db
      .select()
      .from(appSettings)
      .where(
        and(
          eq(appSettings.userId, userId),
          changed(appSettings.updatedAtMs, appSettings.deletedAtMs),
        ),
      ),
  ]);

  const items: SyncItem[] = [];
  for (const row of watchlist) {
    items.push({
      collection: "watchlist",
      id: row.productId,
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  for (const row of alerts) {
    items.push({
      collection: "alerts",
      id: row.alertId,
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  for (const row of reminders) {
    items.push({
      collection: "reminders",
      id: row.reminderId,
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  for (const row of settings) {
    items.push({
      collection: "settings",
      id: "settings",
      data: row.deletedAtMs === null ? row.data : null,
      updatedAt: row.updatedAtMs,
      deletedAt: row.deletedAtMs,
    });
  }
  return items;
}

/**
 * Last-write-wins upsert. Atomic via INSERT ... ON DUPLICATE KEY UPDATE with
 * conditional IF so concurrent pushes cannot interleave between SELECT and
 * INSERT (TOCTOU). Ordering compares the incoming clientUpdatedAtMs against
 * COALESCE(clientUpdatedAtMs, updatedAtMs) so client clock is authoritative.
 * Returns { accepted, updatedAt }: accepted is false when the incoming item
 * is not newer than the existing row; updatedAt is the server-stamped value
 * on acceptance (or the existing row's timestamp on rejection).
 */
export async function upsertSyncItem(
  userId: number,
  item: SyncItem,
): Promise<{ accepted: boolean; updatedAt: number }> {
  if (item.collection === "settings" && item.id !== "settings") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid settings id",
    });
  }
  const db = await getDb();
  if (!db) return { accepted: false, updatedAt: item.updatedAt };
  const stampedAt = Date.now();

  const conditionalSet = {
    data: sql`IF(IF(clientUpdatedAtMs IS NULL, VALUES(clientUpdatedAtMs) > updatedAtMs, VALUES(clientUpdatedAtMs) > COALESCE(clientUpdatedAtMs, updatedAtMs)), VALUES(data), data)`,
    updatedAtMs: sql`IF(IF(clientUpdatedAtMs IS NULL, VALUES(clientUpdatedAtMs) > updatedAtMs, VALUES(clientUpdatedAtMs) > COALESCE(clientUpdatedAtMs, updatedAtMs)), VALUES(updatedAtMs), updatedAtMs)`,
    clientUpdatedAtMs: sql`IF(IF(clientUpdatedAtMs IS NULL, VALUES(clientUpdatedAtMs) > updatedAtMs, VALUES(clientUpdatedAtMs) > COALESCE(clientUpdatedAtMs, updatedAtMs)), VALUES(clientUpdatedAtMs), clientUpdatedAtMs)`,
    deletedAtMs: sql`IF(IF(clientUpdatedAtMs IS NULL, VALUES(clientUpdatedAtMs) > updatedAtMs, VALUES(clientUpdatedAtMs) > COALESCE(clientUpdatedAtMs, updatedAtMs)), VALUES(deletedAtMs), deletedAtMs)`,
  };

  switch (item.collection) {
    case "watchlist": {
      await db
        .insert(watchlistItems)
        .values({
          userId,
          productId: item.id,
          data: item.data,
          updatedAtMs: stampedAt,
          clientUpdatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: conditionalSet as never,
        });
      const row = await db
        .select({
          updatedAtMs: watchlistItems.updatedAtMs,
          clientUpdatedAtMs: watchlistItems.clientUpdatedAtMs,
        })
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.userId, userId),
            eq(watchlistItems.productId, item.id),
          ),
        )
        .limit(1);
      const accepted =
        row[0]?.updatedAtMs === stampedAt &&
        row[0]?.clientUpdatedAtMs === item.updatedAt;
      return { accepted, updatedAt: row[0]?.updatedAtMs ?? stampedAt };
    }
    case "alerts": {
      await db
        .insert(priceAlerts)
        .values({
          userId,
          alertId: item.id,
          data: item.data,
          updatedAtMs: stampedAt,
          clientUpdatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: conditionalSet as never,
        });
      const row = await db
        .select({
          updatedAtMs: priceAlerts.updatedAtMs,
          clientUpdatedAtMs: priceAlerts.clientUpdatedAtMs,
        })
        .from(priceAlerts)
        .where(
          and(eq(priceAlerts.userId, userId), eq(priceAlerts.alertId, item.id)),
        )
        .limit(1);
      const accepted =
        row[0]?.updatedAtMs === stampedAt &&
        row[0]?.clientUpdatedAtMs === item.updatedAt;
      return { accepted, updatedAt: row[0]?.updatedAtMs ?? stampedAt };
    }
    case "reminders": {
      await db
        .insert(backOrderReminders)
        .values({
          userId,
          reminderId: item.id,
          data: item.data,
          updatedAtMs: stampedAt,
          clientUpdatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: conditionalSet as never,
        });
      const row = await db
        .select({
          updatedAtMs: backOrderReminders.updatedAtMs,
          clientUpdatedAtMs: backOrderReminders.clientUpdatedAtMs,
        })
        .from(backOrderReminders)
        .where(
          and(
            eq(backOrderReminders.userId, userId),
            eq(backOrderReminders.reminderId, item.id),
          ),
        )
        .limit(1);
      const accepted =
        row[0]?.updatedAtMs === stampedAt &&
        row[0]?.clientUpdatedAtMs === item.updatedAt;
      return { accepted, updatedAt: row[0]?.updatedAtMs ?? stampedAt };
    }
    case "settings": {
      await db
        .insert(appSettings)
        .values({
          userId,
          data: item.data,
          updatedAtMs: stampedAt,
          clientUpdatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: conditionalSet as never,
        });
      const row = await db
        .select({
          updatedAtMs: appSettings.updatedAtMs,
          clientUpdatedAtMs: appSettings.clientUpdatedAtMs,
        })
        .from(appSettings)
        .where(eq(appSettings.userId, userId))
        .limit(1);
      const accepted =
        row[0]?.updatedAtMs === stampedAt &&
        row[0]?.clientUpdatedAtMs === item.updatedAt;
      return { accepted, updatedAt: row[0]?.updatedAtMs ?? stampedAt };
    }
    default:
      return { accepted: false, updatedAt: stampedAt };
  }
}

/** Hard-deletes tombstoned rows older than the cutoff (epoch ms). Batch-limited to avoid long locks; schedule via cron for full purge. */
export async function purgeOldTombstones(
  userId: number,
  cutoff: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db
      .delete(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, userId),
          lt(watchlistItems.deletedAtMs, cutoff),
        ),
      )
      .limit(1000),
    db
      .delete(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, userId),
          lt(priceAlerts.deletedAtMs, cutoff),
        ),
      )
      .limit(1000),
    db
      .delete(backOrderReminders)
      .where(
        and(
          eq(backOrderReminders.userId, userId),
          lt(backOrderReminders.deletedAtMs, cutoff),
        ),
      )
      .limit(1000),
    db
      .delete(appSettings)
      .where(
        and(
          eq(appSettings.userId, userId),
          lt(appSettings.deletedAtMs, cutoff),
        ),
      )
      .limit(1000),
  ]);
}

export const TOMBSTONE_PURGE_WINDOW_MS = TOMBSTONE_PURGE_MS;
