import { lt } from "drizzle-orm";
import {
  appSettings,
  backOrderReminders,
  priceAlerts,
  watchlistItems,
} from "../drizzle/schema";
import { getDb } from "./db";

const TOMBSTONE_PURGE_MS = 30 * 24 * 60 * 60 * 1000;

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
