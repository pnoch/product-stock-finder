import { and, eq, gt, lt, or, type SQLWrapper } from "drizzle-orm";
import {
  appSettings,
  backOrderReminders,
  priceAlerts,
  watchlistItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { Collection, SyncItem } from "../lib/types";

const TOMBSTONE_PURGE_MS = 30 * 24 * 60 * 60 * 1000;

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
 * Last-write-wins upsert. Returns true when the incoming item was accepted
 * (row absent, or incoming.updatedAt strictly newer than the existing row).
 * Tombstoned items (deletedAt set) are soft-deleted so pull can propagate them.
 */
export async function upsertSyncItem(
  userId: number,
  item: SyncItem,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  switch (item.collection) {
    case "watchlist": {
      const existing = await db
        .select({ updatedAtMs: watchlistItems.updatedAtMs })
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.userId, userId),
            eq(watchlistItems.productId, item.id),
          ),
        )
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return false;
      }
      await db
        .insert(watchlistItems)
        .values({
          userId,
          productId: item.id,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
    }
    case "alerts": {
      const existing = await db
        .select({ updatedAtMs: priceAlerts.updatedAtMs })
        .from(priceAlerts)
        .where(
          and(eq(priceAlerts.userId, userId), eq(priceAlerts.alertId, item.id)),
        )
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return false;
      }
      await db
        .insert(priceAlerts)
        .values({
          userId,
          alertId: item.id,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
    }
    case "reminders": {
      const existing = await db
        .select({ updatedAtMs: backOrderReminders.updatedAtMs })
        .from(backOrderReminders)
        .where(
          and(
            eq(backOrderReminders.userId, userId),
            eq(backOrderReminders.reminderId, item.id),
          ),
        )
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return false;
      }
      await db
        .insert(backOrderReminders)
        .values({
          userId,
          reminderId: item.id,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
    }
    case "settings": {
      const existing = await db
        .select({ updatedAtMs: appSettings.updatedAtMs })
        .from(appSettings)
        .where(eq(appSettings.userId, userId))
        .limit(1);
      if (existing.length > 0 && existing[0]!.updatedAtMs >= item.updatedAt) {
        return false;
      }
      await db
        .insert(appSettings)
        .values({
          userId,
          data: item.data,
          updatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            data: item.data,
            updatedAtMs: item.updatedAt,
            deletedAtMs: item.deletedAt,
          },
        });
      return true;
    }
  }
}

/** Hard-deletes tombstoned rows older than the cutoff (epoch ms). */
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
      ),
    db
      .delete(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, userId),
          lt(priceAlerts.deletedAtMs, cutoff),
        ),
      ),
    db
      .delete(backOrderReminders)
      .where(
        and(
          eq(backOrderReminders.userId, userId),
          lt(backOrderReminders.deletedAtMs, cutoff),
        ),
      ),
    db
      .delete(appSettings)
      .where(
        and(
          eq(appSettings.userId, userId),
          lt(appSettings.deletedAtMs, cutoff),
        ),
      ),
  ]);
}

export const TOMBSTONE_PURGE_WINDOW_MS = TOMBSTONE_PURGE_MS;
