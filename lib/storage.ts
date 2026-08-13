import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Product,
  PriceAlert,
  AppSettings,
  DistributorListing,
  BackOrderReminder,
  NotificationHistoryEntry,
} from "./types";
import type { Collection, SyncMeta } from "./types";
import type { DigestSnapshot } from "./price-digest";

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export function createStorage(
  adapter: StorageAdapter,
  opts?: { onChange?: (collection: Collection, itemId: string) => void },
) {
  const KEYS = {
    WATCHLIST: "watchlist_products",
    ALERTS: "price_alerts",
    SETTINGS: "app_settings",
    REMINDERS: "back_order_reminders",
    STOCK_WATCHES: "back_in_stock_watches",
    DIGEST_SNAPSHOT: "price_digest_snapshot",
    SYNC_META: "sync_meta",
    DISPLAYED_EVENT_IDS: "displayed_notification_event_ids",
    NOTIFICATION_HISTORY: "notification_history",
  };

  let onChange = opts?.onChange ?? null;
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

  const DEFAULT_SETTINGS: AppSettings = {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    shippingRegion: "Asia-Pacific",
  };

  // ─── Watchlist ──────────────────────────────────────────────────────────────

  async function getWatchlist(): Promise<Product[]> {
    return readList<Product>(KEYS.WATCHLIST);
  }

  async function saveWatchlist(products: Product[]): Promise<void> {
    await adapter.setItem(KEYS.WATCHLIST, JSON.stringify(products));
  }

  async function addToWatchlist(product: Product): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const exists = list.find((p) => p.id === product.id);
      if (!exists) {
        list.unshift({
          ...product,
          isWatched: true,
          addedAt: new Date().toISOString(),
        });
        await saveWatchlist(list);
        notify("watchlist", product.id);
      }
    });
  }

  async function removeFromWatchlist(productId: string): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const next = list.filter((p) => p.id !== productId);
      if (next.length !== list.length) {
        await saveWatchlist(next);
        notify("watchlist", productId);
      }
    });
  }

  async function updateProductListings(
    productId: string,
    listings: DistributorListing[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const now = new Date().toISOString();
      const updated = list.map((p) =>
        p.id === productId ? { ...p, listings, lastRefreshed: now } : p,
      );
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }

  async function refreshWatchlistPrices(): Promise<void> {
    const list = await getWatchlist();
    const now = new Date().toISOString();
    const updated = list.map((p) => ({ ...p, lastRefreshed: now }));
    await saveWatchlist(updated);
    for (const p of updated) notify("watchlist", p.id);
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  async function getAlerts(): Promise<PriceAlert[]> {
    return readList<PriceAlert>(KEYS.ALERTS);
  }

  async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
    await adapter.setItem(KEYS.ALERTS, JSON.stringify(alerts));
  }

  async function addAlert(alert: PriceAlert): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      alerts.unshift(alert);
      await saveAlerts(alerts);
      notify("alerts", alert.id);
    });
  }

  async function removeAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      await saveAlerts(alerts.filter((a) => a.id !== alertId));
      notify("alerts", alertId);
    });
  }

  async function toggleAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, isActive: !a.isActive } : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function rearmAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              isActive: true,
              triggeredAt: undefined,
              triggeredPrice: undefined,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function deactivateAlert(
    alertId: string,
    triggeredPrice: number,
  ): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              isActive: false,
              triggeredAt: new Date().toISOString(),
              triggeredPrice,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  async function getSettings(): Promise<AppSettings> {
    try {
      const raw = await adapter.getItem(KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async function saveSettings(settings: AppSettings): Promise<void> {
    await adapter.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    notify("settings", "settings");
  }

  // ─── Back-Order Reminders ───────────────────────────────────────────────────

  async function getBackOrderReminders(): Promise<BackOrderReminder[]> {
    return readList<BackOrderReminder>(KEYS.REMINDERS);
  }

  async function saveBackOrderReminders(
    reminders: BackOrderReminder[],
  ): Promise<void> {
    await adapter.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  }

  async function addBackOrderReminder(
    reminder: BackOrderReminder,
  ): Promise<void> {
    await enqueue(KEYS.REMINDERS, async () => {
      const reminders = await getBackOrderReminders();
      const existing = reminders.findIndex(
        (r) =>
          r.productId === reminder.productId &&
          r.distributorId === reminder.distributorId,
      );
      if (existing >= 0) {
        reminders[existing] = reminder;
      } else {
        reminders.unshift(reminder);
      }
      await saveBackOrderReminders(reminders);
      notify("reminders", reminder.id);
    });
  }

  async function removeBackOrderReminder(
    reminderId: string,
  ): Promise<void> {
    await enqueue(KEYS.REMINDERS, async () => {
      const reminders = await getBackOrderReminders();
      await saveBackOrderReminders(reminders.filter((r) => r.id !== reminderId));
      notify("reminders", reminderId);
    });
  }

  // ─── Back-In-Stock Watches ──────────────────────────────────────────────────

  async function getStockWatches(): Promise<BackOrderReminder[]> {
    return readList<BackOrderReminder>(KEYS.STOCK_WATCHES);
  }

  async function saveStockWatches(
    watches: BackOrderReminder[],
  ): Promise<void> {
    await adapter.setItem(KEYS.STOCK_WATCHES, JSON.stringify(watches));
  }

  async function addStockWatch(watch: BackOrderReminder): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      const existing = watches.findIndex(
        (w) =>
          w.productId === watch.productId &&
          w.distributorId === watch.distributorId,
      );
      if (existing >= 0) {
        watches[existing] = watch;
      } else {
        watches.unshift(watch);
      }
      await saveStockWatches(watches);
      notify("reminders", watch.id);
    });
  }

  async function removeStockWatch(watchId: string): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      await saveStockWatches(watches.filter((w) => w.id !== watchId));
      notify("reminders", watchId);
    });
  }

  async function updateStockWatchStatus(
    productId: string,
    distributorId: string,
    status: string,
  ): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      let targetId: string | null = null;
      const updated = watches.map((w) => {
        if (w.productId === productId && w.distributorId === distributorId) {
          targetId = w.id;
          return { ...w, lastKnownStatus: status };
        }
        return w;
      });
      await saveStockWatches(updated);
      if (targetId) notify("reminders", targetId);
    });
  }

  // ─── Price Digest Snapshot ──────────────────────────────────────────────────

  async function getPriceDigestSnapshot(): Promise<DigestSnapshot | null> {
    try {
      const raw = await adapter.getItem(KEYS.DIGEST_SNAPSHOT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function savePriceDigestSnapshot(
    snapshot: DigestSnapshot,
  ): Promise<void> {
    await adapter.setItem(KEYS.DIGEST_SNAPSHOT, JSON.stringify(snapshot));
  }

  // ─── Sync Meta ─────────────────────────────────────────────────────────────

  async function getSyncMeta(): Promise<SyncMeta> {
    try {
      const raw = await adapter.getItem(KEYS.SYNC_META);
      if (!raw) return { lastSyncedAt: 0, items: {} };
      const parsed = JSON.parse(raw);
      return {
        lastSyncedAt:
          typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : 0,
        items: parsed.items ?? {},
      };
    } catch {
      return { lastSyncedAt: 0, items: {} };
    }
  }

  // Persists sync meta via read-modify-write. `saveSyncMeta` merges `items`
  // into the existing meta (lastSyncedAt is taken from the argument). The
  // merge is per collection, not per item: callers must pass the full
  // contents of any collection they touch, since its entry replaces that
  // collection wholesale. NOT enqueued — internal helpers call it while
  // already inside enqueue(KEYS.SYNC_META, ...); the public `saveSyncMeta`
  // wrapper below adds the queue for external callers.
  async function persistSyncMeta(meta: SyncMeta): Promise<void> {
    const existing = await getSyncMeta();
    await adapter.setItem(
      KEYS.SYNC_META,
      JSON.stringify({
        lastSyncedAt: meta.lastSyncedAt,
        items: { ...existing.items, ...meta.items },
      }),
    );
  }

  // Serialized on the sync-meta write queue so it cannot race other queued
  // meta mutations (setItemSyncMeta/markItemDeleted/clearItemSyncMeta).
  async function saveSyncMeta(meta: SyncMeta): Promise<void> {
    await enqueue(KEYS.SYNC_META, async () => {
      await persistSyncMeta(meta);
    });
  }

  function updateItemMeta(
    collection: Collection,
    id: string,
    patch: { updatedAt: number; deleted: boolean },
  ): Promise<void> {
    return enqueue(KEYS.SYNC_META, async () => {
      const meta = await getSyncMeta();
      const col = meta.items[collection] ?? {};
      col[id] = patch;
      meta.items[collection] = col;
      await persistSyncMeta(meta);
    });
  }

  async function setItemSyncMeta(
    collection: Collection,
    id: string,
    updatedAt: number,
  ): Promise<void> {
    await updateItemMeta(collection, id, { updatedAt, deleted: false });
  }

  async function markItemDeleted(
    collection: Collection,
    id: string,
    updatedAt: number,
  ): Promise<void> {
    await updateItemMeta(collection, id, { updatedAt, deleted: true });
  }

  async function clearItemSyncMeta(
    collection: Collection,
    id: string,
  ): Promise<void> {
    await enqueue(KEYS.SYNC_META, async () => {
      const meta = await getSyncMeta();
      const col = meta.items[collection];
      if (col && col[id]) {
        delete col[id];
        await persistSyncMeta(meta);
      }
    });
  }

  // ─── Displayed Event Ids (notification dedup) ──────────────────────────────

  async function getDisplayedEventIds(): Promise<string[]> {
    return readList<string>(KEYS.DISPLAYED_EVENT_IDS);
  }

  async function recordDisplayedEventId(id: string): Promise<void> {
    await enqueue(KEYS.DISPLAYED_EVENT_IDS, async () => {
      const ids = await getDisplayedEventIds();
      if (!ids.includes(id)) {
        ids.push(id);
        if (ids.length > 200) ids.splice(0, ids.length - 200);
        await adapter.setItem(KEYS.DISPLAYED_EVENT_IDS, JSON.stringify(ids));
      }
    });
  }

  // ─── Notification History ─────────────────────────────────────────────────

  async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
    return readList<NotificationHistoryEntry>(KEYS.NOTIFICATION_HISTORY);
  }

  async function recordNotificationEvent(
    event: Omit<NotificationHistoryEntry, "read">,
  ): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => e.id === event.id)) return;
      list.unshift({ ...event, read: false });
      if (list.length > 200) list.length = 200;
      await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
    });
  }

  async function markNotificationRead(id: string): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      const entry = list.find((e) => e.id === id);
      if (entry && !entry.read) {
        entry.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function markAllNotificationsRead(): Promise<void> {
    await enqueue(KEYS.NOTIFICATION_HISTORY, async () => {
      const list = await getNotificationHistory();
      if (list.some((e) => !e.read)) {
        for (const e of list) e.read = true;
        await adapter.setItem(KEYS.NOTIFICATION_HISTORY, JSON.stringify(list));
      }
    });
  }

  async function getUnreadNotificationCount(): Promise<number> {
    const list = await getNotificationHistory();
    return list.filter((e) => !e.read).length;
  }

  // ─── Clear All Data ─────────────────────────────────────────────────────────

  async function clearAllData(): Promise<void> {
    await adapter.multiRemove([
      KEYS.WATCHLIST,
      KEYS.ALERTS,
      KEYS.SETTINGS,
      KEYS.REMINDERS,
      KEYS.STOCK_WATCHES,
      KEYS.SYNC_META,
      KEYS.DISPLAYED_EVENT_IDS,
      KEYS.NOTIFICATION_HISTORY,
      "recently_viewed",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "has_seen_onboarding",
      "price_digest_snapshot",
    ]);
  }

  return {
    getWatchlist,
    saveWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateProductListings,
    refreshWatchlistPrices,
    getAlerts,
    saveAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
    rearmAlert,
    deactivateAlert,
    getSettings,
    saveSettings,
    getBackOrderReminders,
    saveBackOrderReminders,
    addBackOrderReminder,
    removeBackOrderReminder,
    getStockWatches,
    saveStockWatches,
    addStockWatch,
    removeStockWatch,
    updateStockWatchStatus,
    getPriceDigestSnapshot,
    savePriceDigestSnapshot,
    getSyncMeta,
    saveSyncMeta,
    setItemSyncMeta,
    markItemDeleted,
    clearItemSyncMeta,
    getDisplayedEventIds,
    recordDisplayedEventId,
    getNotificationHistory,
    recordNotificationEvent,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,
    setOnChange,
    setChangeSuppressed,
    clearAllData,
  };
}

export type Storage = ReturnType<typeof createStorage>;

// ─── Default instance (mobile / AsyncStorage) ──────────────────────────────────
// Preserves backward-compatible named exports so existing imports work unchanged.

export const defaultStorage = createStorage(AsyncStorage);

export const {
  getWatchlist,
  saveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateProductListings,
  refreshWatchlistPrices,
  getAlerts,
  saveAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  rearmAlert,
  deactivateAlert,
  getSettings,
  saveSettings,
  getBackOrderReminders,
  saveBackOrderReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  saveStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
  getSyncMeta,
  saveSyncMeta,
  setItemSyncMeta,
  markItemDeleted,
  clearItemSyncMeta,
  getDisplayedEventIds,
  recordDisplayedEventId,
  getNotificationHistory,
  recordNotificationEvent,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  setOnChange,
  setChangeSuppressed,
  clearAllData,
} = defaultStorage;