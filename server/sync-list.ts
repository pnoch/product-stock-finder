import { and, eq, gt, or, sql, type SQLWrapper } from "drizzle-orm";
import {
  appSettings,
  backOrderReminders,
  priceAlerts,
  watchlistItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { SyncItem } from "../lib/types";
import { afterCursor, type SyncCursor } from "./sync-cursor";

// Per-collection cap when no explicit limit is given. Keeps an accidental
// unbounded full-resync read from loading an entire account into memory.
const DEFAULT_LIST_LIMIT = 5000;

/**
 * Returns all rows for the user whose updatedAtMs OR deletedAtMs is newer than
 * `since` (epoch ms). `since === null` means first sync (return everything).
 * Tombstoned rows carry `data: null` so the client only needs the deletion.
 */
export async function listChangedItems(
  userId: number,
  since: number | null,
  limit?: number,
  cursor: SyncCursor | null = null,
): Promise<SyncItem[]> {
  const db = await getDb();
  if (!db) return [];
  const sinceMs = since ?? 0;
  const changed = (updatedAtMs: SQLWrapper, deletedAtMs: SQLWrapper) =>
    or(gt(updatedAtMs, sinceMs), gt(deletedAtMs, sinceMs));
  const effectiveStamp = (updatedAtMs: SQLWrapper, deletedAtMs: SQLWrapper) =>
    sql`GREATEST(${updatedAtMs}, COALESCE(${deletedAtMs}, 0))`;

  const perCollection = limit ?? DEFAULT_LIST_LIMIT;
  const watchlistAfter = afterCursor(
    effectiveStamp(watchlistItems.updatedAtMs, watchlistItems.deletedAtMs),
    "watchlist",
    watchlistItems.productId,
    cursor,
  );
  const alertsAfter = afterCursor(
    effectiveStamp(priceAlerts.updatedAtMs, priceAlerts.deletedAtMs),
    "alerts",
    priceAlerts.alertId,
    cursor,
  );
  const remindersAfter = afterCursor(
    effectiveStamp(backOrderReminders.updatedAtMs, backOrderReminders.deletedAtMs),
    "reminders",
    backOrderReminders.reminderId,
    cursor,
  );
  const settingsAfter = afterCursor(
    effectiveStamp(appSettings.updatedAtMs, appSettings.deletedAtMs),
    "settings",
    sql`'settings'`,
    cursor,
  );

  const [watchlist, alerts, reminders, settings] = await Promise.all([
    db
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, userId),
          changed(watchlistItems.updatedAtMs, watchlistItems.deletedAtMs),
          ...(watchlistAfter ? [watchlistAfter] : []),
        ),
      )
      .orderBy(
        effectiveStamp(watchlistItems.updatedAtMs, watchlistItems.deletedAtMs),
        watchlistItems.productId,
      )
      .limit(perCollection),
    db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, userId),
          changed(priceAlerts.updatedAtMs, priceAlerts.deletedAtMs),
          ...(alertsAfter ? [alertsAfter] : []),
        ),
      )
      .orderBy(
        effectiveStamp(priceAlerts.updatedAtMs, priceAlerts.deletedAtMs),
        priceAlerts.alertId,
      )
      .limit(perCollection),
    db
      .select()
      .from(backOrderReminders)
      .where(
        and(
          eq(backOrderReminders.userId, userId),
          changed(backOrderReminders.updatedAtMs, backOrderReminders.deletedAtMs),
          ...(remindersAfter ? [remindersAfter] : []),
        ),
      )
      .orderBy(
        effectiveStamp(backOrderReminders.updatedAtMs, backOrderReminders.deletedAtMs),
        backOrderReminders.reminderId,
      )
      .limit(perCollection),
    db
      .select()
      .from(appSettings)
      .where(
        and(
          eq(appSettings.userId, userId),
          changed(appSettings.updatedAtMs, appSettings.deletedAtMs),
          ...(settingsAfter ? [settingsAfter] : []),
        ),
      )
      .orderBy(effectiveStamp(appSettings.updatedAtMs, appSettings.deletedAtMs))
      .limit(perCollection),
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
