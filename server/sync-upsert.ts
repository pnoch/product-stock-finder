import { and, eq, sql } from "drizzle-orm";
import {
  appSettings,
  backOrderReminders,
  priceAlerts,
  watchlistItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { SyncItem } from "../lib/types";

/** Drops the device-local BYO-LLM key from a settings payload of unknown shape. */
function stripSettingsSecret(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const { llmApiKey: _omit, ...rest } = data as Record<string, unknown>;
  return rest;
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
        .onDuplicateKeyUpdate({ set: conditionalSet as never });
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
        .onDuplicateKeyUpdate({ set: conditionalSet as never });
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
        .onDuplicateKeyUpdate({ set: conditionalSet as never });
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
          // The client strips the BYO-LLM key from outbound settings, but the
          // contract is that it is never stored server-side — enforce it here too
          // so an older or modified client cannot persist it at rest.
          data: stripSettingsSecret(item.data),
          updatedAtMs: stampedAt,
          clientUpdatedAtMs: item.updatedAt,
          deletedAtMs: item.deletedAt,
        })
        .onDuplicateKeyUpdate({ set: conditionalSet as never });
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
