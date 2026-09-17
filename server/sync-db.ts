import { and, eq, gt, gte, lt, or, sql, type SQLWrapper } from "drizzle-orm";
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
// Per-collection cap when no explicit limit is given. Keeps an accidental
// unbounded full-resync read from loading an entire account into memory.
const DEFAULT_LIST_LIMIT = 5000;

export interface SyncCursor {
  stamp: number;
  collection: string;
  id: string;
}

// Deterministic global page order is (effectiveStamp, collection, id) ascending.
// A stamp-only cursor cannot page correctly: many rows can share a stamp (bulk
// edits, tombstones), so `>= stamp` would return the same page forever and the
// client would stop with rows undelivered. The composite cursor makes the order
// total, so each page is strictly after the previous one.
// Canonical collection order. MUST match COLLECTION_ORDER in
// server/routers.ts (which sorts the merged page and builds the cursor):
// comparing collection names lexicographically here while the router sorts by
// this array made the two orders disagree, so a page boundary could skip rows
// in a collection that sorts earlier lexicographically but later here.
export const SYNC_COLLECTION_ORDER = [
  "watchlist",
  "alerts",
  "reminders",
  "settings",
] as const;

function collectionRank(collection: string): number {
  const idx = (SYNC_COLLECTION_ORDER as readonly string[]).indexOf(collection);
  return idx === -1 ? SYNC_COLLECTION_ORDER.length : idx;
}

function afterCursor(
  stampExpr: SQLWrapper,
  collection: string,
  idExpr: SQLWrapper,
  cursor: SyncCursor | null,
): SQLWrapper | undefined {
  if (!cursor) return undefined;
  const rank = collectionRank(collection);
  const cursorRank = collectionRank(cursor.collection);
  if (rank > cursorRank) {
    // Later collection: any row at the same stamp sorts after the cursor.
    return gte(stampExpr, cursor.stamp);
  }
  if (rank === cursorRank) {
    return or(
      gt(stampExpr, cursor.stamp),
      and(eq(stampExpr, cursor.stamp), gt(idExpr, cursor.id)),
    );
  }
  // Earlier collection: only strictly newer stamps come after the cursor.
  return gt(stampExpr, cursor.stamp);
}

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
    effectiveStamp(
      backOrderReminders.updatedAtMs,
      backOrderReminders.deletedAtMs,
    ),
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
          changed(
            backOrderReminders.updatedAtMs,
            backOrderReminders.deletedAtMs,
          ),
          ...(remindersAfter ? [remindersAfter] : []),
        ),
      )
      .orderBy(
        effectiveStamp(
          backOrderReminders.updatedAtMs,
          backOrderReminders.deletedAtMs,
        ),
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
): Promise<{
  accepted: boolean;
  updatedAt: number;
  reason?: "stale_write" | "validation_error";
}> {
  if (item.collection === "settings" && item.id !== "settings") {
    return {
      accepted: false,
      updatedAt: item.updatedAt,
      reason: "validation_error",
    };
  }
  const db = await getDb();
  if (!db)
    return {
      accepted: false,
      updatedAt: item.updatedAt,
      reason: "validation_error",
    };
  const stampedAt = Date.now();

  // Single LWW admission condition shared by all guarded columns below.
  // Must mirror shouldAcceptSyncWrite() (SQL cannot call TS): legacy rows
  // without a client stamp fall back to the server-stamped comparison
  // instead of unconditionally accepting. Pinned by the consistency test in
  // tests/sync-db.test.ts — update both together.
  //
  // The verdict is snapshotted into a user variable on first evaluation.
  // MySQL evaluates ON DUPLICATE KEY UPDATE assignments left-to-right with
  // intermediate values visible, and Drizzle emits columns in *schema*
  // order (clientUpdatedAtMs before deletedAtMs) regardless of object key
  // order — so a bare condition re-evaluated per column would read the
  // just-overwritten clientUpdatedAtMs and flip false, silently dropping
  // deletes. (@-variables are per-connection and always assigned before
  // use here, so pool reuse is safe.)
  const lwwAcceptsStaleWrite = sql`IF(clientUpdatedAtMs IS NULL, VALUES(clientUpdatedAtMs) > updatedAtMs, VALUES(clientUpdatedAtMs) > COALESCE(clientUpdatedAtMs, updatedAtMs))`;
  const lwwOk = sql`(@__lww_ok := (${lwwAcceptsStaleWrite}))`;
  const conditionalSet = {
    data: sql`IF(${lwwOk}, VALUES(data), data)`,
    updatedAtMs: sql`IF(@__lww_ok, VALUES(updatedAtMs), updatedAtMs)`,
    deletedAtMs: sql`IF(@__lww_ok, VALUES(deletedAtMs), deletedAtMs)`,
    clientUpdatedAtMs: sql`IF(@__lww_ok, VALUES(clientUpdatedAtMs), clientUpdatedAtMs)`,
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
      return {
        accepted,
        updatedAt: row[0]?.updatedAtMs ?? stampedAt,
        reason: accepted ? undefined : "stale_write",
      };
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
      return {
        accepted,
        updatedAt: row[0]?.updatedAtMs ?? stampedAt,
        reason: accepted ? undefined : "stale_write",
      };
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
      return {
        accepted,
        updatedAt: row[0]?.updatedAtMs ?? stampedAt,
        reason: accepted ? undefined : "stale_write",
      };
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
      return {
        accepted,
        updatedAt: row[0]?.updatedAtMs ?? stampedAt,
        reason: accepted ? undefined : "stale_write",
      };
    }
    default:
      return {
        accepted: false,
        updatedAt: stampedAt,
        reason: "validation_error",
      };
  }
}

/** Hard-deletes tombstoned rows older than the cutoff (epoch ms). Batch-limited to avoid long locks; schedule via cron for full purge. */
// Purges tombstones older than `cutoff`. The caller gates this on a global
// interval, so it must purge ALL users — filtering to the triggering user left
// every other account's tombstones to accumulate forever. `deletedAtMs` is
// NULL for live rows, so `lt(deletedAtMs, cutoff)` only matches tombstones.
export async function purgeOldTombstones(cutoff: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db
      .delete(watchlistItems)
      .where(lt(watchlistItems.deletedAtMs, cutoff))
      .limit(1000),
    db
      .delete(priceAlerts)
      .where(lt(priceAlerts.deletedAtMs, cutoff))
      .limit(1000),
    db
      .delete(backOrderReminders)
      .where(lt(backOrderReminders.deletedAtMs, cutoff))
      .limit(1000),
    db
      .delete(appSettings)
      .where(lt(appSettings.deletedAtMs, cutoff))
      .limit(1000),
  ]);
}

export const TOMBSTONE_PURGE_WINDOW_MS = TOMBSTONE_PURGE_MS;
