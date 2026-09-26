import type { Collection } from "../types";
import type { StorageAdapter } from "./adapter";

export const STORAGE_KEYS = {
  WATCHLIST: "watchlist_products",
  ALERTS: "price_alerts",
  SETTINGS: "app_settings",
  REMINDERS: "back_order_reminders",
  STOCK_WATCHES: "back_in_stock_watches",
  DIGEST_SNAPSHOT: "price_digest_snapshot",
  SYNC_META: "sync_meta",
  DISPLAYED_EVENT_IDS: "displayed_notification_event_ids",
  NOTIFICATION_HISTORY: "notification_history",
  FX_RATES: "fx_rates",
  PENDING_HEALTH_EVENTS: "pending_health_events",
  FX_RATE_HISTORY: "fx_rate_history",
  DISCOVERED_PRODUCTS: "discovered_products",
  DISCOVERED_DISTRIBUTORS: "discovered_distributors",
  BACKGROUND_TASK_INTERVAL: "background_task_interval",
};

export interface StorageContext {
  readonly adapter: StorageAdapter;
  readonly KEYS: typeof STORAGE_KEYS;
  notify(collection: Collection, itemId: string): void;
  setOnChange(
    fn: ((collection: Collection, itemId: string) => void) | null,
  ): void;
  // Additional observers alongside the single sync-engine `onChange` handler
  // (e.g. the tab badge, which must react to in-place mutations rather than
  // route focus). Additive so `setOnChange` keeps its replace semantics.
  addChangeListener(fn: (collection: Collection, itemId: string) => void): void;
  removeChangeListener(
    fn: (collection: Collection, itemId: string) => void,
  ): void;
  setChangeSuppressed(flag: boolean, ignoreKeys?: Set<string>): void;
  enqueue<T>(key: string, fn: () => Promise<T>): Promise<T>;
  drainQueues(): Promise<void>;
  readList<T>(key: string): Promise<T[]>;
}

// Quarantine blobs are capped per base key so a persistently corrupt key
// cannot exhaust storage quota. Tracked in module memory; evicting a key
// that no longer exists is a harmless no-op removeItem.
const MAX_QUARANTINE_PER_KEY = 3;
const quarantineKeys = new Map<string, string[]>();

export async function quarantinePayload(
  adapter: StorageAdapter,
  key: string,
  raw: string,
): Promise<void> {
  const name = `${key}.corrupt-${Date.now()}`;
  try {
    await adapter.setItem(name, raw.slice(0, 100_000));
  } catch {
    return;
  }
  const keys = quarantineKeys.get(key) ?? [];
  keys.push(name);
  while (keys.length > MAX_QUARANTINE_PER_KEY) {
    const oldest = keys.shift()!;
    try {
      await adapter.removeItem(oldest);
    } catch {
      // best effort
    }
  }
  quarantineKeys.set(key, keys);
}

export function createContext(adapter: StorageAdapter): StorageContext {
  let onChange: ((collection: Collection, itemId: string) => void) | null =
    null;
  let suppressChange = false;
  // Changes that arrive while suppressed are buffered and replayed when
  // suppression ends. Dropping them (the previous behavior) meant a local edit
  // made during a sync was never marked dirty, so it was treated as
  // already-synced and never uploaded.
  const suppressedChanges: Array<[Collection, string]> = [];
  const changeListeners = new Set<
    (collection: Collection, itemId: string) => void
  >();

  function deliver(collection: Collection, itemId: string) {
    onChange?.(collection, itemId);
    for (const listener of changeListeners) listener(collection, itemId);
  }

  function notify(collection: Collection, itemId: string) {
    if (!onChange && changeListeners.size === 0) return;
    if (suppressChange) {
      suppressedChanges.push([collection, itemId]);
      return;
    }
    deliver(collection, itemId);
  }

  function setOnChange(
    fn: ((collection: Collection, itemId: string) => void) | null,
  ) {
    onChange = fn;
  }

  function addChangeListener(
    fn: (collection: Collection, itemId: string) => void,
  ) {
    changeListeners.add(fn);
  }

  function removeChangeListener(
    fn: (collection: Collection, itemId: string) => void,
  ) {
    changeListeners.delete(fn);
  }

  function setChangeSuppressed(flag: boolean, ignoreKeys?: Set<string>) {
    suppressChange = flag;
    if (flag) return;
    // Replay buffered changes now that suppression has lifted, skipping the
    // keys the sync itself just applied (those are already stamped).
    const pending = suppressedChanges.splice(0);
    for (const [collection, itemId] of pending) {
      if (ignoreKeys?.has(`${collection}:${itemId}`)) continue;
      deliver(collection, itemId);
    }
  }

  // Serializes read-modify-write operations per key to prevent lost updates
  // when concurrent batches (e.g. background price checks) mutate the same list.
  const writeQueues = new Map<string, Promise<unknown>>();
  function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = writeQueues.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    writeQueues.set(
      key,
      next.catch(() => {}),
    );
    return next;
  }

  // Waits for all in-flight queued writes so operations like clearAllData
  // cannot be undone by a write that was already running.
  async function drainQueues(): Promise<void> {
    await Promise.all([...writeQueues.values()]);
  }

  async function readList<T>(key: string): Promise<T[]> {
    let raw: string | null;
    try {
      raw = await adapter.getItem(key);
    } catch (error) {
      // Adapter failures must not masquerade as empty stores: callers would
      // treat the result as empty and the next write would destroy data.
      console.warn(`[storage] read failed for ${key}`, error);
      throw error;
    }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      // Valid JSON of the wrong shape: returning [] here let the next write
      // overwrite the payload with a fresh array. Quarantine it like a corrupt
      // payload so the original survives for forensics/recovery.
      await quarantinePayload(adapter, key, raw);
      console.warn(`[storage] quarantined non-array payload for ${key}`);
      return [];
    } catch {
      // Corrupt payload: quarantine the raw value for forensics instead of
      // silently dropping it — returning [] here would let the next write
      // overwrite whatever the corrupt payload used to hold.
      await quarantinePayload(adapter, key, raw);
      console.warn(`[storage] quarantined corrupt payload for ${key}`);
      return [];
    }
  }

  return {
    adapter,
    KEYS: STORAGE_KEYS,
    notify,
    setOnChange,
    addChangeListener,
    removeChangeListener,
    setChangeSuppressed,
    enqueue,
    drainQueues,
    readList,
  };
}
