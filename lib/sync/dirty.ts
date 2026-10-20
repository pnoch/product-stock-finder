import type { Storage } from "@/lib/storage";
import type {
  AppSettings,
  BackOrderReminder,
  Collection,
  PriceAlert,
  Product,
  SyncItem,
} from "@/lib/types";
import { stripDeviceLocalSettings } from "@/lib/settings-privacy";
import { COLLECTIONS, SETTINGS_ID } from "./constants";
import { serializeItem } from "./serialize";
import { itemExists } from "./apply";

export async function collectDirty(
  storage: Storage,
  oldCursor: number,
  applied: Set<string>,
  _now: number,
  skipKeys: Set<string> = new Set(),
): Promise<{ dirty: SyncItem[] }> {
  const meta = await storage.getSyncMeta();
  const dirty: SyncItem[] = [];
  const keyOf = (c: Collection, id: string) => `${c}:${id}`;
  const retryKeys = new Set(meta.retryKeys ?? []);
  const local = await collectLocalState(storage);
  const pendingSetMeta: { collection: Collection; id: string }[] = [];
  const rawServerNow = await serverNow(storage);
  // NOTE: stamps deliberately use the per-item skew-corrected estimate, not
  // the just-observed server cursor. Flooring at the cursor would falsify
  // edit times (claiming old edits happened at pull time) and break LWW
  // fairness across devices; see the "server-corrected time" test.
  const freshServerNow = Math.max(rawServerNow, oldCursor + 1);

  for (const collection of COLLECTIONS) {
    if (collection === "settings") {
      const key = keyOf("settings", SETTINGS_ID);
      if (applied.has(key) || skipKeys.has(key)) continue;
      const entry = meta.items.settings?.[SETTINGS_ID];
      const isRetry = retryKeys.has(key);
      if ((entry && entry.updatedAt > oldCursor) || isRetry) {
        dirty.push({
          collection: "settings",
          id: SETTINGS_ID,
          data: stripDeviceLocalSettings(local.settings),
          updatedAt:
            entry && !isRetry ? entry.updatedAt : freshServerNow,
          deletedAt: null,
        });
      }
      continue;
    }
    const items = local[collection] as { id: string }[];
    for (const item of items) {
      const key = keyOf(collection, item.id);
      if (applied.has(key) || skipKeys.has(key)) continue;
      const entry = meta.items[collection]?.[item.id];
      // `retryKeys` holds items the server rejected earlier: their stamp is
      // <= the cursor, so the normal freshness check would skip them forever.
      const isRetry = retryKeys.has(key);
      if (!entry || entry.updatedAt > oldCursor || entry.deleted || isRetry) {
        dirty.push({
          collection,
          id: item.id,
          data: serializeItem(collection, item),
          updatedAt:
            entry && !entry.deleted && !isRetry
              ? entry.updatedAt
              : freshServerNow,
          deletedAt: null,
        });
        if (entry?.deleted) {
          pendingSetMeta.push({ collection, id: item.id });
        }
      }
    }
  }

  for (const collection of ["watchlist", "alerts", "reminders"] as const) {
    const colMeta = meta.items[collection] ?? {};
    const localItems = local[collection] as { id: string }[];
    for (const [id, entry] of Object.entries(colMeta)) {
      if (!entry.deleted) continue;
      const key = keyOf(collection, id);
      if (applied.has(key) || skipKeys.has(key)) continue;
      if (localItems.some((item) => item.id === id)) continue;
      if (entry.updatedAt > oldCursor) {
        dirty.push({
          collection,
          id,
          data: null,
          updatedAt: entry.updatedAt,
          deletedAt: entry.updatedAt,
        });
      }
      // Older tombstones are intentionally left alone: clearing meta for a
      // tombstone the server never confirmed resurrects the row on next pull.
    }
  }

  for (const { collection, id } of pendingSetMeta) {
    await storage.setItemSyncMeta(collection, id, freshServerNow);
  }

  return { dirty };
}

async function collectLocalState(storage: Storage): Promise<{
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  settings: AppSettings;
}> {
  const [watchlist, alerts, reminders, stockWatches, settings] =
    await Promise.all([
      storage.getWatchlist(),
      storage.getAlerts(),
      storage.getBackOrderReminders(),
      storage.getStockWatches(),
      storage.getSettings(),
    ]);
  return {
    watchlist,
    alerts,
    reminders: [...reminders, ...stockWatches],
    settings,
  };
}

// Best estimate of the server clock: the measured offset from the last
// successful sync (lastSyncedAt is server time, lastSyncOkAt is client time)
// applied to the current client time. Keeps offline edits server-comparable
// so device clock skew cannot lose or wrongly win edits.
export async function serverNow(storage: Storage): Promise<number> {
  const meta = await storage.getSyncMeta();
  // Never synced: there is no server clock baseline, so use the client
  // clock. Without this, lastSyncedAt (0) minus okAt (now) collapses to 0
  // and pre-first-sync edits are stamped 0, which collectDirty treats as
  // "not newer than cursor 0" — silently never pushing them.
  if (!meta.lastSyncedAt) return Date.now();
  const lastSyncedAt = meta.lastSyncedAt;
  const okAt = meta.lastSyncOkAt ?? Date.now();
  if (!Number.isFinite(lastSyncedAt) || !Number.isFinite(okAt)) return Date.now();
  return Date.now() + (lastSyncedAt - okAt);
}

export async function markDirty(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<void> {
  const now = await serverNow(storage);
  const exists = await itemExists(storage, collection, id);
  if (exists) {
    await storage.setItemSyncMeta(collection, id, now);
    return;
  }
  // A mutation that reported an id which isn't present locally (stale UI,
  // removed on another device, double-tap after removal) must NOT create a
  // fresh tombstone: that tombstone wins LWW and deletes the item on the other
  // device. Only tombstone an item that was previously synced.
  const meta = await storage.getSyncMeta();
  const known = meta.items[collection]?.[id];
  if (!known) return;
  await storage.markItemDeleted(collection, id, now);
}

