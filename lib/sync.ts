import { log } from "@shared/log";
import type { Storage } from "./storage";
import type {
  Collection,
  SyncItem,
  SyncRejectedItem,
  SyncRejectionReason,
  SyncStampedItem,
} from "./types";
import { currentSyncGeneration } from "@/lib/sync-gate";

import { collectDirty, markDirty } from "./sync/dirty";
import { applyLocalItem, removeLocalItem } from "./sync/apply";
import { batchSyncItems } from "./sync/serialize";
import type { SyncSetup } from "./sync/status";

export type { SyncSetup, SyncStatus } from "./sync/status";
export {
  countQueuedEdits,
  formatSyncStatus,
  registerSyncSetup,
  getSyncSetup,
} from "./sync/status";

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
  // Any logout that wipes the store while this sync is in flight bumps the
  // generation; this run must then stop before writing anything back.
  const gate = currentSyncGeneration();
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
    log.warn("[Sync] Pull failed; skipping sync", error);
    await storage.saveSyncMeta({
      ...(await storage.getSyncMeta()),
      lastSyncError: `Pull failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return;
  }

  // The account may have been wiped while the pull was in flight.
  if (currentSyncGeneration() !== gate) return;

  const applied = new Set<string>();
  storage.setChangeSuppressed(true);
  try {
    for (const item of pulled.items) {
      // A wipe can land between items; never write the old account's rows
      // into the freshly cleared store.
      if (currentSyncGeneration() !== gate) return;
      const key = `${item.collection}:${item.id}`;
      const local = meta.items[item.collection]?.[item.id];
      if (item.deletedAt !== null) {
        if (!local || item.updatedAt > local.updatedAt) {
          await removeLocalItem(storage, item.collection, item.id);
          await storage.clearItemSyncMeta(item.collection, item.id);
          storage.notifyLocal(item.collection, item.id);
          applied.add(key);
        }
      } else if (!local || item.updatedAt > local.updatedAt) {
        await applyLocalItem(storage, item.collection, item.data);
        await storage.setItemSyncMeta(item.collection, item.id, item.updatedAt);
        // The apply primitives intentionally do not notify (they would mark the
        // item dirty again); notify UI observers only so open screens refresh.
        storage.notifyLocal(item.collection, item.id);
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
    if (currentSyncGeneration() !== gate) return;
    const cutoff = pulled.fullResyncSince;
    const pulledIds = new Set(pulled.items.map((i) => `${i.collection}:${i.id}`));
    const localLists: { collection: Collection; ids: string[] }[] = [
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
        if (currentSyncGeneration() !== gate) return;
        if (pulledIds.has(`${collection}:${id}`)) continue;
        const entry = meta.items[collection]?.[id];
        // `entry.updatedAt <= oldCursor` means the item was already confirmed
        // at or before the last successful sync; anything edited since is still
        // dirty (or was never pushed at all) and must be kept and pushed —
        // dropping it deleted genuinely local, never-synced work.
        if (entry && entry.updatedAt < cutoff && entry.updatedAt <= oldCursor) {
          await removeLocalItem(storage, collection, id);
          await storage.clearItemSyncMeta(collection, id);
          storage.notifyLocal(collection, id);
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
  const stampedTombstones: { collection: Collection; id: string }[] = [];
  let rejected: { collection: Collection; id: string; reason: SyncRejectionReason }[] = [];
  let rejectedValidation = 0;
  if (dirty.length > 0) {
    let stamped: SyncStampedItem[] = [];
    try {
      // The server rejects a push over SYNC_PUSH_MAX_ITEMS outright, so a user
      // with more dirty items than the cap would never sync. Send in batches
      // and merge the verdicts; a failed batch aborts the rest (local changes
      // stay dirty for the next sync).
      for (const batch of batchSyncItems(dirty)) {
        const result = await opts.push(batch);
        stamped = stamped.concat(result.stamped);
        rejected = rejected.concat(
          (result.rejected ?? []) as typeof rejected,
        );
      }
    } catch (error) {
      log.warn("[Sync] Push failed; local changes kept", error);
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
    const staleTombstonesToClear: { collection: Collection; id: string }[] = [];
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
        // Cap at the cursor: the push lands a few ms after the pull, so a raw
        // server stamp is always `> lastSyncedAt` and `collectDirty` re-collected
        // the item on every sync. Each re-push then inflated the stamp again,
        // and a peer device's genuine edit looked stale forever (rejected and
        // retried against an ever-newer stamp). The cursor is still a server
        // time, so the LWW base stays server-corrected, not client-clocked.
        updatedAt: Math.min(stampedAt, nextCursor),
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
    // A wipe during the push must not resurrect the cursor: without it the next
    // account's first sync is incremental and silently skips rows.
    if (currentSyncGeneration() !== gate) return;
    await storage.saveSyncMeta(metaAfter);
    for (const { collection, id } of staleTombstonesToClear) {
      await storage.clearItemSyncMeta(collection, id);
    }
  }

  // Clear tombstone meta only for tombstones pushed + stamped in this pass.
  // Stale tombstone entries (older than the cursor, never pushed) used to be
  // garbage-collected here; after a rejected run that drops deletes without
  // the server ever seeing them, so they are retained instead.
  if (currentSyncGeneration() !== gate) return;
  for (const { collection, id } of stampedTombstones) {
    await storage.clearItemSyncMeta(collection, id);
  }

  if (dirty.length === 0) {
    if (currentSyncGeneration() !== gate) return;
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
      log.warn("[Sync] Background sync failed", error);
    });
    await afterSync().catch((error) => {
      log.warn("[Sync] Retry scheduling failed", error);
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
      log.warn("[Sync] Launch sync failed", error);
    });
    await afterSync().catch((error) => {
      log.warn("[Sync] Retry scheduling failed", error);
    });
  };

  opts.storage.setOnChange((collection, itemId) => {
    // Signed-out writes are device-local preferences, not sync edits. Marking
    // them dirty recreated sync_meta after a sign-out wipe and pushed the
    // previous account's settings into the next account.
    if (!opts.isSignedIn()) return;
    markDirty(opts.storage, collection, itemId)
      .catch((e) => log.warn("[Sync] markDirty failed", e))
      .then(() => schedule());
  });
  return { syncNow: runNow, schedule };
}

