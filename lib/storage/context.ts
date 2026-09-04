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
};

export interface StorageContext {
  readonly adapter: StorageAdapter;
  readonly KEYS: typeof STORAGE_KEYS;
  notify(collection: Collection, itemId: string): void;
  setOnChange(
    fn: ((collection: Collection, itemId: string) => void) | null,
  ): void;
  setChangeSuppressed(flag: boolean): void;
  enqueue<T>(key: string, fn: () => Promise<T>): Promise<T>;
  drainQueues(): Promise<void>;
  readList<T>(key: string): Promise<T[]>;
}

export function createContext(adapter: StorageAdapter): StorageContext {
  let onChange: ((collection: Collection, itemId: string) => void) | null =
    null;
  let suppressChange = false;

  function notify(collection: Collection, itemId: string) {
    if (!suppressChange && onChange) onChange(collection, itemId);
  }

  function setOnChange(
    fn: ((collection: Collection, itemId: string) => void) | null,
  ) {
    onChange = fn;
  }

  function setChangeSuppressed(flag: boolean) {
    suppressChange = flag;
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
    try {
      const raw = await adapter.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return {
    adapter,
    KEYS: STORAGE_KEYS,
    notify,
    setOnChange,
    setChangeSuppressed,
    enqueue,
    drainQueues,
    readList,
  };
}
