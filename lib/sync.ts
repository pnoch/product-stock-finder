import type { Storage } from "./storage";
import type {
  AppSettings,
  BackOrderReminder,
  Collection,
  PriceAlert,
  Product,
  SyncItem,
  SyncMeta,
  SyncRejectedItem,
  SyncRejectionReason,
  SyncStampedItem,
} from "./types";
import {
  PRICE_HISTORY_DAYS,
  PRICE_HISTORY_SYNC_DAYS,
  SYNC_PUSH_MAX_ITEMS,
} from "@/shared/const";
import { mergePriceHistory } from "@/lib/price-history";

export interface SyncNowOptions {
  storage: Storage;
  isSignedIn: () => boolean;
  pull: (
    since: number | null,
    cursor?: { stamp: number; collection: string; id: string } | null,
  ) => Promise<{
    lastSyncedAt: number;
    items: SyncItem[];
    fullResyncSince?: number | null;
    hasMore?: boolean;
    nextCursor?: { stamp: number; collection: string; id: string } | null;
  }>;
  push: (
    items: SyncItem[],
  ) => Promise<{
    accepted: number;
    stamped: SyncStampedItem[];
    rejected?: SyncRejectedItem[];
  }>;
  now?: () => number;
}

export interface SyncSetup {
  syncNow: () => Promise<void>;
  schedule: () => void;
}

const COLLECTIONS: Collection[] = [
  "watchlist",
  "alerts",
  "reminders",
  "settings",
];
const SETTINGS_ID = "settings";

const inFlight = new WeakMap<Storage, Promise<void>>();

export async function syncNow(opts: SyncNowOptions): Promise<void> {
  if (!opts.isSignedIn()) return;
  const existing = inFlight.get(opts.storage);
  if (existing) return existing;
  const promise = doSync(opts).finally(() => {
    inFlight.delete(opts.storage);
  });
  inFlight.set(opts.storage, promise);
  return promise;
}

async function doSync(
  opts: SyncNowOptions,
  attempt = 0,
  skipKeys: Set<string> = new Set(),
  inheritedError: string | null = null,
): Promise<void> {
  const storage = opts.storage;
  const meta = await storage.getSyncMeta();
  const oldCursor = meta.lastSyncedAt || 0;
  const since = meta.lastSyncedAt || null;

  let pulled: {
    lastSyncedAt: number;
    items: SyncItem[];
    fullResyncSince?: number | null;
    hasMore?: boolean;
    nextCursor?: { stamp: number; collection: string; id: string } | null;
  };
  try {
    pulled = await opts.pull(since);
    // Drain remaining pages. The server caps each pull; without this a large
    // account would only ever receive the first page. `cursor` is the newest
    // stamp seen so far, and the server re-includes rows at that stamp so a
    // page boundary cannot skip an item (the client dedupes by key).
    let guard = 0;
    while (pulled.hasMore && pulled.nextCursor && guard < 50) {
      guard += 1;
      const next = await opts.pull(since, pulled.nextCursor);
      if (next.items.length === 0) break;
      pulled = {
        lastSyncedAt: next.lastSyncedAt,
        items: [...pulled.items, ...next.items],
        fullResyncSince: pulled.fullResyncSince ?? next.fullResyncSince,
        hasMore: next.hasMore,
        nextCursor: next.nextCursor,
      };
    }
  } catch (error) {
    console.warn("[Sync] Pull failed; skipping sync", error);
    await storage.saveSyncMeta({
      ...(await storage.getSyncMeta()),
      lastSyncError: `Pull failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return;
  }

  const applied = new Set<string>();
  storage.setChangeSuppressed(true);
  try {
    for (const item of pulled.items) {
      const key = `${item.collection}:${item.id}`;
      const local = meta.items[item.collection]?.[item.id];
      if (item.deletedAt !== null) {
        if (!local || item.updatedAt > local.updatedAt) {
          await removeLocalItem(storage, item.collection, item.id);
          await storage.clearItemSyncMeta(item.collection, item.id);
          applied.add(key);
        }
      } else if (!local || item.updatedAt > local.updatedAt) {
        await applyLocalItem(storage, item.collection, item.data);
        await storage.setItemSyncMeta(item.collection, item.id, item.updatedAt);
        applied.add(key);
      }
    }
  } finally {
    storage.setChangeSuppressed(false, applied);
  }

  // Full resync: the server's tombstone window has moved past our cursor, so
  // locally-present items absent from the pull may shadow purged deletes.
  // Drop those with stale sync meta. Items with no meta entry are genuine
  // never-synced offline work and are preserved (and pushed below).
  // Known limitation: seeds and ancient never-synced items can resurrect
  // rows deleted + purged elsewhere (tombstone expiry is inherent to the
  // design); the user can delete them again.
  // Settings is excluded: the client never emits settings tombstones, so
  // there is nothing to resurrect.
  if (pulled.fullResyncSince != null) {
    const cutoff = pulled.fullResyncSince;
    const pulledIds = new Set(pulled.items.map((i) => `${i.collection}:${i.id}`));
    const localLists: Array<{ collection: Collection; ids: string[] }> = [
      {
        collection: "watchlist",
        ids: (await storage.getWatchlist()).map((p) => p.id),
      },
      {
        collection: "alerts",
        ids: (await storage.getAlerts()).map((a) => a.id),
      },
      {
        collection: "reminders",
        ids: [
          ...(await storage.getBackOrderReminders()).map((r) => r.id),
          ...(await storage.getStockWatches()).map((w) => w.id),
        ],
      },
    ];
    for (const { collection, ids } of localLists) {
      for (const id of ids) {
        if (pulledIds.has(`${collection}:${id}`)) continue;
        const entry = meta.items[collection]?.[id];
        if (entry && entry.updatedAt < cutoff) {
          await removeLocalItem(storage, collection, id);
          await storage.clearItemSyncMeta(collection, id);
        }
      }
    }
  }

  const { dirty } = await collectDirty(
    storage,
    oldCursor,
    applied,
    pulled.lastSyncedAt,
    skipKeys,
  );

  // If the page drain hit its guard with pages still pending, do NOT advance
  // the cursor to lastSyncedAt: that would permanently skip the remaining
  // pages. Keep the previous cursor so the next sync re-pulls them.
  const drainIncomplete = Boolean(pulled.hasMore);
  const nextCursor = drainIncomplete ? oldCursor : pulled.lastSyncedAt;
  const stampedKeys = new Set<string>();
  const stampedTombstones: Array<{ collection: Collection; id: string }> = [];
  let rejected: Array<{ collection: Collection; id: string; reason: SyncRejectionReason }> = [];
  let rejectedValidation = 0;
  if (dirty.length > 0) {
    let stamped: SyncStampedItem[] = [];
    try {
      // The server rejects a push over SYNC_PUSH_MAX_ITEMS outright, so a user
      // with more dirty items than the cap would never sync. Send in batches
      // and merge the verdicts; a failed batch aborts the rest (local changes
      // stay dirty for the next sync).
      for (let i = 0; i < dirty.length; i += SYNC_PUSH_MAX_ITEMS) {
        const batch = dirty.slice(i, i + SYNC_PUSH_MAX_ITEMS);
        const result = await opts.push(batch);
        stamped = stamped.concat(result.stamped);
        rejected = rejected.concat(
          (result.rejected ?? []) as typeof rejected,
        );
      }
    } catch (error) {
      console.warn("[Sync] Push failed; local changes kept", error);
      // Persist the stamps from batches that DID succeed before the failure.
      // Dropping them left those items with a meta stamp <= the old cursor, so
      // `collectDirty` treated them as already-synced and never re-pushed them.
      const partialMeta = await storage.getSyncMeta();
      for (const s of stamped) {
        partialMeta.items[s.collection] = {
          ...(partialMeta.items[s.collection] ?? {}),
          [s.id]: { updatedAt: s.updatedAt, deleted: false },
        };
      }
      await storage.saveSyncMeta({
        ...partialMeta,
        lastSyncError: `Push failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        // The pull above may have merged settings (applyLocalItem). Refresh the
        // merge base to the post-merge state; otherwise every merged field
        // looks "locally edited" against the stale base and later remote
        // changes to those fields are ignored indefinitely.
        settingsSnapshot: await storage.getSettings(),
      });
      return;
    }
    const stampedByKey = new Map(
      stamped.map((s) => [`${s.collection}:${s.id}`, s.updatedAt]),
    );
    const metaAfter = await storage.getSyncMeta();
    // Partition rejections: stale LWW losses are safe to clear (pull
    // convergence recreates newer remote), validation failures stay dirty
    // for a visible retry instead of silently dropping local edits.
    const rejectedByKey = new Map(
      rejected.map((r) => [`${r.collection}:${r.id}`, r.reason]),
    );
    // Stale tombstones must be cleared via a direct delete after the
    // merged save (persistSyncMeta merges per-item, so a missing key in
    // the snapshot would be resurrected from the stored copy).
    const staleTombstonesToClear: Array<{ collection: Collection; id: string }> = [];
    for (const item of dirty) {
      const key = `${item.collection}:${item.id}`;
      const stampedAt = stampedByKey.get(key);
      if (stampedAt === undefined) {
        const reason = rejectedByKey.get(key);
        if (reason === "stale_write") {
          // Tombstones that lost LWW can be cleared; live items converge
          // via the next pull (remote is newer, so local will be overwritten).
          if (item.deletedAt !== null) {
            staleTombstonesToClear.push({ collection: item.collection, id: item.id });
          }
        } else if (reason === "validation_error") {
          rejectedValidation += 1;
        } else if (reason === undefined) {
          // No verdict — treat as transient and keep dirty for retry.
          rejectedValidation += 1;
        }
        continue;
      }
      stampedKeys.add(key);
      if (item.deletedAt !== null) stampedTombstones.push({ collection: item.collection, id: item.id });
      const col = metaAfter.items[item.collection] ?? {};
      col[item.id] = {
        updatedAt: stampedAt,
        deleted: item.deletedAt !== null,
      };
      metaAfter.items[item.collection] = col;
    }
    // Single write for stamps + cursor: a crash between two saves used to
    // leave server-stamped entries under an old cursor, causing duplicate
    // re-pushes on the next sync.
    metaAfter.lastSyncedAt = nextCursor;
    // Rejected items keep their old meta stamp, which is <= the new cursor, so
    // `entry.updatedAt > oldCursor` would never re-collect them and the edit
    // would be silently lost. Track them explicitly so the next sync retries.
    //
    // Only validation/transient rejections are retried. A `stale_write` means
    // the server had a newer value: re-pushing it with a bumped stamp would
    // beat the remote edit in LWW and revert it. Live stale items converge via
    // the next pull; stale tombstones are cleared above.
    const rejectedKeys = dirty
      .filter((item) => !stampedKeys.has(`${item.collection}:${item.id}`))
      .filter((item) => {
        const reason = rejectedByKey.get(`${item.collection}:${item.id}`);
        return reason !== "stale_write";
      })
      .map((item) => `${item.collection}:${item.id}`);
    const carriedRetries = (meta.retryKeys ?? []).filter(
      (key) => !stampedKeys.has(key) && !rejectedKeys.includes(key),
    );
    metaAfter.retryKeys = [...new Set([...carriedRetries, ...rejectedKeys])];
    const totalRejected = dirty.length - stampedKeys.size;
    metaAfter.lastSyncError =
      totalRejected > 0
        ? rejectedValidation > 0
          ? `Push partially rejected (${rejectedValidation} validation error(s))`
          : `Push partially rejected (${totalRejected} stale write(s) — cleared)`
        : (inheritedError ?? null);
    metaAfter.lastSyncOkAt = opts.now?.() ?? Date.now();
    // Base for the next settings per-field merge (post-merge local state).
    metaAfter.settingsSnapshot = await storage.getSettings();
    await storage.saveSyncMeta(metaAfter);
    for (const { collection, id } of staleTombstonesToClear) {
      await storage.clearItemSyncMeta(collection, id);
    }
  }

  // Clear tombstone meta only for tombstones pushed + stamped in this pass.
  // Stale tombstone entries (older than the cursor, never pushed) used to be
  // garbage-collected here; after a rejected run that drops deletes without
  // the server ever seeing them, so they are retained instead.
  for (const { collection, id } of stampedTombstones) {
    await storage.clearItemSyncMeta(collection, id);
  }

  if (dirty.length === 0) {
    await storage.saveSyncMeta({
      ...(await storage.getSyncMeta()),
      lastSyncedAt: nextCursor,
      lastSyncError: inheritedError ?? null,
      lastSyncOkAt: opts.now?.() ?? Date.now(),
      // No dirty items means no retryable local item remains (collectDirty
      // would have produced one), so any leftover retry key is obsolete.
      retryKeys: [],
      // Base for the next settings per-field merge.
      settingsSnapshot: await storage.getSettings(),
    });
  }

  // Follow-up pass: local edits that landed mid-sync (after the dirty
  // snapshot, newer than this pass's cursor, unstamped and unapplied) would
  // otherwise read as already-synced on the next run and never be pushed.
  // Re-run once, skipping keys this pass already resolved. JS is
  // single-threaded so the only interleaving windows are the awaits above.
  if (attempt < 1) {
    const fresh = await storage.getSyncMeta();
    // Rejected items are deliberately deferred to the next sync (retrying them
    // in this pass would loop against the same server verdict), so exclude them
    // from the mid-sync leftover scan.
    const deferred = new Set(fresh.retryKeys ?? []);
    let leftover = false;
    for (const col of Object.keys(fresh.items) as Collection[]) {
      const entries = fresh.items[col] ?? {};
      for (const [id, entry] of Object.entries(entries)) {
        const key = `${col}:${id}`;
        if (
          skipKeys.has(key) ||
          stampedKeys.has(key) ||
          applied.has(key) ||
          deferred.has(key)
        ) {
          continue;
        }
        if (entry.updatedAt > oldCursor) {
          leftover = true;
          break;
        }
      }
      if (leftover) break;
    }
    if (leftover) {
      await doSync(
        opts,
        attempt + 1,
        new Set([...skipKeys, ...stampedKeys, ...applied, ...deferred]),
        (await storage.getSyncMeta()).lastSyncError,
      );
    }
  }
}

async function collectDirty(
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
  const pendingSetMeta: Array<{ collection: Collection; id: string }> = [];
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
          data: local.settings,
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

function serializeItem(collection: Collection, item: unknown): unknown {
  if (collection !== "watchlist") return item;
  const product = item as Product;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - PRICE_HISTORY_SYNC_DAYS);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  return {
    ...product,
    listings: product.listings.map((l) => ({
      distributorId: l.distributorId,
      productId: l.productId,
      price: l.price,
      currency: l.currency,
      stockStatus: l.stockStatus,
      expectedDate: l.expectedDate,
      url: l.url,
      lastChecked: l.lastChecked,
      taxRate: l.taxRate,
      priceHistory: l.priceHistory.filter(
        (p) => p.date.slice(0, 10) >= cutoffDay,
      ),
    })),
  };
}

async function applyLocalItem(
  storage: Storage,
  collection: Collection,
  data: unknown,
): Promise<void> {
  switch (collection) {
    case "watchlist": {
      const incoming = data as Product;
      await storage.updateWatchlist((list) => {
        const existing = list.find((p) => p.id === incoming.id);
        if (!existing) {
          return [...list, { ...incoming, isWatched: true }];
        }
        return list.map((p) => {
          if (p.id !== incoming.id) return p;
          const incomingIds = new Set(
            incoming.listings.map((l) => l.distributorId),
          );
          const merged = incoming.listings.map((l) => {
            const local = existing.listings.find(
              (el) => el.distributorId === l.distributorId,
            );
            return local
              ? {
                  ...l,
                  priceHistory: mergePriceHistory(
                    local.priceHistory,
                    l.priceHistory ?? [],
                    PRICE_HISTORY_DAYS,
                  ),
                }
              : l;
          });
          const localOnly = existing.listings.filter(
            (el) => !incomingIds.has(el.distributorId),
          );
          // Tags are a per-device organizational edit that LWW on the whole
          // product object would otherwise drop: union them so a tag added on
          // this device survives an incoming copy that predates it.
          const mergedTags = Array.from(
            new Set([...(incoming.tags ?? []), ...(existing.tags ?? [])]),
          );
          return {
            ...incoming,
            listings: [...merged, ...localOnly],
            ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
          };
        });
      });
      break;
    }
    case "alerts": {
      const incoming = data as PriceAlert;
      await storage.updateAlerts((alerts) => {
        const existing = alerts.find((a) => a.id === incoming.id);
        if (existing) {
          return alerts.map((a) => (a.id === incoming.id ? incoming : a));
        }
        return [...alerts, incoming];
      });
      break;
    }
    case "reminders": {
      const incoming = data as BackOrderReminder;
      const targetWatches = incoming.reminderType === "back_in_stock";
      if (targetWatches) {
        await storage.updateStockWatches((watches) => {
          const existing = watches.find((w) => w.id === incoming.id);
          return existing
            ? watches.map((w) => (w.id === incoming.id ? incoming : w))
            : [...watches, incoming];
        });
      } else {
        await storage.updateReminders((reminders) => {
          const existing = reminders.find((r) => r.id === incoming.id);
          return existing
            ? reminders.map((r) => (r.id === incoming.id ? incoming : r))
            : [...reminders, incoming];
        });
      }
      break;
    }
    case "settings": {
      // Per-field merge: settings is a single row, so a whole-row overwrite
      // loses a field another device changed while this one was offline. Using
      // the last-synced snapshot as the base, keep the local value for any
      // field the local device changed since that snapshot and take the
      // incoming value otherwise. Without a snapshot (first sync after
      // upgrade) there is no base, so fall back to whole-row LWW.
      const incoming = data as AppSettings;
      const base = (await storage.getSyncMeta()).settingsSnapshot;
      if (!base) {
        await storage.saveSettings(incoming);
        break;
      }
      const local = await storage.getSettings();
      const merged: AppSettings = { ...incoming };
      for (const key of Object.keys(local) as (keyof AppSettings)[]) {
        const localChanged =
          JSON.stringify(local[key]) !== JSON.stringify(base[key]);
        if (localChanged) {
          (merged as unknown as Record<string, unknown>)[key] = local[key];
        }
      }
      await storage.saveSettings(merged);
      break;
    }
  }
}

async function removeLocalItem(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<void> {
  switch (collection) {
    case "watchlist": {
      await storage.updateWatchlist((list) =>
        list.filter((p) => p.id !== id),
      );
      break;
    }
    case "alerts": {
      await storage.updateAlerts((alerts) =>
        alerts.filter((a) => a.id !== id),
      );
      break;
    }
    case "reminders": {
      await storage.updateReminders((reminders) =>
        reminders.filter((r) => r.id !== id),
      );
      await storage.updateStockWatches((watches) =>
        watches.filter((w) => w.id !== id),
      );
      break;
    }
    case "settings":
      break;
  }
}

async function itemExists(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<boolean> {
  switch (collection) {
    case "watchlist":
      return (await storage.getWatchlist()).some((p) => p.id === id);
    case "alerts":
      return (await storage.getAlerts()).some((a) => a.id === id);
    case "reminders":
      return (
        (await storage.getBackOrderReminders()).some((r) => r.id === id) ||
        (await storage.getStockWatches()).some((w) => w.id === id)
      );
    case "settings":
      return true;
  }
}

// Best estimate of the server clock: the measured offset from the last
// successful sync (lastSyncedAt is server time, lastSyncOkAt is client time)
// applied to the current client time. Keeps offline edits server-comparable
// so device clock skew cannot lose or wrongly win edits.
async function serverNow(storage: Storage): Promise<number> {
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

async function markDirty(
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

const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 5 * 60_000;

export function setupSync(
  opts: SyncNowOptions & { debounceMs?: number },
): SyncSetup {
  const debounceMs = opts.debounceMs ?? 2000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = RETRY_BASE_MS;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryDelayMs = RETRY_BASE_MS;
  };

  const scheduleRetry = () => {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void run();
    }, retryDelayMs);
    retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
  };

  const afterSync = async () => {
    if (!opts.isSignedIn()) {
      clearRetry();
      return;
    }
    const meta = await opts.storage.getSyncMeta();
    if (meta.lastSyncError) {
      scheduleRetry();
    } else {
      clearRetry();
    }
  };

  const run = async () => {
    timer = null;
    await syncNow(opts).catch((error) => {
      console.warn("[Sync] Background sync failed", error);
    });
    await afterSync().catch((error) => {
      console.warn("[Sync] Retry scheduling failed", error);
    });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, debounceMs);
  };

  const runNow = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await syncNow(opts).catch((error) => {
      console.warn("[Sync] Launch sync failed", error);
    });
    await afterSync().catch((error) => {
      console.warn("[Sync] Retry scheduling failed", error);
    });
  };

  opts.storage.setOnChange((collection, itemId) => {
    markDirty(opts.storage, collection, itemId)
      .catch((e) => console.warn("[Sync] markDirty failed", e))
      .then(() => schedule());
  });
  return { syncNow: runNow, schedule };
}

export function countQueuedEdits(meta: SyncMeta): number {
  const cursor = meta.lastSyncedAt || 0;
  let count = 0;
  for (const col of Object.keys(meta.items) as Collection[]) {
    const colMap = meta.items[col] ?? {};
    for (const entry of Object.values(colMap)) {
      if (entry.updatedAt > cursor) count++;
    }
  }
  return count;
}

export async function getQueuedEditCount(storage: Storage): Promise<number> {
  const meta = await storage.getSyncMeta();
  return countQueuedEdits(meta);
}

export interface SyncStatus {
  label: string;
  tone: "success" | "error" | "muted";
}

export function formatSyncStatus(
  meta: SyncMeta,
  isAuthenticated: boolean,
  now: number,
): SyncStatus {
  if (!isAuthenticated) {
    return { label: "Sign in to sync across devices", tone: "muted" };
  }
  if (meta.lastSyncError) {
    return { label: meta.lastSyncError, tone: "error" };
  }
  const successAt = meta.lastSyncOkAt ?? meta.lastSyncedAt;
  if (!successAt) {
    return { label: "Not synced yet", tone: "muted" };
  }
  const minutes = Math.floor((now - successAt) / 60000);
  const label =
    minutes < 1
      ? "Synced just now"
      : minutes < 60
        ? `Last synced ${minutes}m ago`
        : `Last synced ${Math.floor(minutes / 60)}h ago`;
  return { label, tone: minutes < 5 ? "success" : "muted" };
}

let syncSetupRef: SyncSetup | null = null;

export function registerSyncSetup(setup: SyncSetup | null): () => void {
  syncSetupRef = setup;
  return () => {
    if (syncSetupRef === setup) syncSetupRef = null;
  };
}

export function getSyncSetup(): SyncSetup | null {
  return syncSetupRef;
}
