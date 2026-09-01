import type { Storage } from "./storage";
import type {
  AppSettings,
  BackOrderReminder,
  Collection,
  PriceAlert,
  Product,
  SyncItem,
  SyncMeta,
  SyncStampedItem,
} from "./types";
import { PRICE_HISTORY_DAYS, PRICE_HISTORY_SYNC_DAYS } from "@/shared/const";
import { mergePriceHistory } from "@/lib/price-history";

export interface SyncNowOptions {
  storage: Storage;
  isSignedIn: () => boolean;
  pull: (
    since: number | null,
  ) => Promise<{ lastSyncedAt: number; items: SyncItem[] }>;
  push: (
    items: SyncItem[],
  ) => Promise<{ accepted: number; stamped: SyncStampedItem[] }>;
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

async function doSync(opts: SyncNowOptions): Promise<void> {
  const storage = opts.storage;
  const meta = await storage.getSyncMeta();
  const oldCursor = meta.lastSyncedAt || 0;
  const since = meta.lastSyncedAt || null;

  let pulled: { lastSyncedAt: number; items: SyncItem[] };
  try {
    pulled = await opts.pull(since);
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
    storage.setChangeSuppressed(false);
  }

  const dirty = await collectDirty(storage, oldCursor, applied, pulled.lastSyncedAt);

  if (dirty.length > 0) {
    let stamped: SyncStampedItem[] = [];
    try {
      const result = await opts.push(dirty);
      stamped = result.stamped;
    } catch (error) {
      console.warn("[Sync] Push failed; local changes kept", error);
      await storage.saveSyncMeta({
        ...(await storage.getSyncMeta()),
        lastSyncError: `Push failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return;
    }
    const stampedByKey = new Map(
      stamped.map((s) => [`${s.collection}:${s.id}`, s.updatedAt]),
    );
    const metaAfter = await storage.getSyncMeta();
    for (const item of dirty) {
      const stampedAt = stampedByKey.get(`${item.collection}:${item.id}`);
      if (stampedAt === undefined) continue;
      const col = metaAfter.items[item.collection] ?? {};
      col[item.id] = {
        updatedAt: stampedAt,
        deleted: item.deletedAt !== null,
      };
      metaAfter.items[item.collection] = col;
    }
    await storage.saveSyncMeta(metaAfter);
  }

  const nextCursor = pulled.lastSyncedAt;
  await storage.saveSyncMeta({
    ...(await storage.getSyncMeta()),
    lastSyncedAt: nextCursor,
    lastSyncError: null,
    lastSyncOkAt: opts.now ? opts.now() : Date.now(),
  });
}

async function collectDirty(
  storage: Storage,
  oldCursor: number,
  applied: Set<string>,
  now: number,
): Promise<SyncItem[]> {
  const meta = await storage.getSyncMeta();
  const dirty: SyncItem[] = [];
  const keyOf = (c: Collection, id: string) => `${c}:${id}`;
  const local = await collectLocalState(storage);
  const pendingSetMeta: Array<{ collection: Collection; id: string }> = [];
  const pendingClearMeta: Array<{ collection: Collection; id: string }> = [];

  for (const collection of COLLECTIONS) {
    if (collection === "settings") {
      const key = keyOf("settings", SETTINGS_ID);
      if (applied.has(key)) continue;
      const entry = meta.items.settings?.[SETTINGS_ID];
      if (entry && entry.updatedAt > oldCursor) {
        dirty.push({
          collection: "settings",
          id: SETTINGS_ID,
          data: local.settings,
          updatedAt: entry ? entry.updatedAt : now,
          deletedAt: null,
        });
      }
      continue;
    }
    const items = local[collection] as { id: string }[];
    for (const item of items) {
      const key = keyOf(collection, item.id);
      if (applied.has(key)) continue;
      const entry = meta.items[collection]?.[item.id];
      if (!entry || entry.updatedAt > oldCursor || entry.deleted) {
        dirty.push({
          collection,
          id: item.id,
          data: serializeItem(collection, item),
          updatedAt: entry && !entry.deleted ? entry.updatedAt : now,
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
      if (applied.has(key)) continue;
      if (localItems.some((item) => item.id === id)) continue;
      if (entry.updatedAt > oldCursor) {
        dirty.push({
          collection,
          id,
          data: null,
          updatedAt: entry.updatedAt,
          deletedAt: entry.updatedAt,
        });
      } else {
        pendingClearMeta.push({ collection, id });
      }
    }
  }

  const freshServerNow = await serverNow(storage);
  for (const { collection, id } of pendingSetMeta) {
    await storage.setItemSyncMeta(collection, id, freshServerNow);
  }
  for (const { collection, id } of pendingClearMeta) {
    await storage.clearItemSyncMeta(collection, id);
  }

  return dirty;
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
          return {
            ...incoming,
            listings: incoming.listings.map((l) => {
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
            }),
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
      await storage.saveSettings(data as AppSettings);
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
  const lastSyncedAt = meta.lastSyncedAt ?? Date.now();
  const okAt = meta.lastSyncOkAt ?? lastSyncedAt ?? Date.now();
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
  } else {
    await storage.markItemDeleted(collection, id, now);
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
