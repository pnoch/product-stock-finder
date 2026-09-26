import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Collection } from "../types";
import { StorageAdapter, DISTRIBUTOR_BREAKER_KEY } from "./adapter";
import { createContext, STORAGE_KEYS } from "./context";
import { createIDBAdapter, isIndexedDBAvailable } from "./idb-adapter";
import { createWatchlistStorage } from "./watchlist";
import { createAlertsStorage } from "./alerts";
import { createRemindersStorage } from "./reminders";
import { createSettingsStorage } from "./settings";
import { createDigestFxStorage } from "./digest-fx";
import { createFxHistoryStorage } from "./fx-history";
import { RECENT_SEARCHES_KEY } from "../recent-searches";
import { createSyncMetaStorage } from "./sync-meta";
import { createNotificationsStorage } from "./notifications";
import { createDiscoveryStorage, createBackgroundTaskStorage } from "./discovery";
import { bumpSyncGeneration } from "@/lib/sync-gate";

export { DISTRIBUTOR_BREAKER_KEY };
export type { StorageAdapter };

export function createStorage(
  adapter: StorageAdapter,
  opts?: {
    onChange?: (collection: Collection, itemId: string) => void;
    // Cancels a scheduled OS notification. Injected so this module never
    // statically imports expo-notifications (which the server/tests can't
    // load); the default instance supplies the real implementation.
    cancelNotification?: (notificationId: string) => Promise<void>;
    // Cancels every scheduled OS notification. Called when a wipe removes all
    // reminders/watches, whose notifications would otherwise still fire.
    cancelAllNotifications?: () => Promise<void>;
  },
) {
  const ctx = createContext(adapter);
  ctx.setOnChange(opts?.onChange ?? null);
  const cancelNotification =
    opts?.cancelNotification ?? (async () => {});
  const cancelAllNotifications =
    opts?.cancelAllNotifications ?? (async () => {});

  const watchlist = createWatchlistStorage(ctx);
  const alertsStorage = createAlertsStorage(ctx);
  const remindersStorage = createRemindersStorage(ctx);

  // ─── Clear All Data ─────────────────────────────────────────────────────────

  // Sign-out variant: clears the previous account's synced collections and
  // cursor but keeps device-local preferences (onboarding, theme, currency,
  // notification toggles) so signing back in doesn't reset the app.
  async function clearAccountData(): Promise<void> {
    // Invalidate any sync already in flight before touching the store, so it
    // cannot re-apply the previous account's rows or recreate sync_meta after
    // the wipe (see lib/sync-gate.ts).
    bumpSyncGeneration();
    await ctx.drainQueues();
    // Cancel scheduled notifications for the reminders/watches being wiped, or
    // they still fire after sign-out.
    await cancelAllNotifications().catch(() => {});
    await ctx.adapter.multiRemove([
      STORAGE_KEYS.WATCHLIST,
      STORAGE_KEYS.ALERTS,
      STORAGE_KEYS.REMINDERS,
      STORAGE_KEYS.STOCK_WATCHES,
      STORAGE_KEYS.SYNC_META,
      STORAGE_KEYS.DISPLAYED_EVENT_IDS,
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      STORAGE_KEYS.PENDING_HEALTH_EVENTS,
      STORAGE_KEYS.DISCOVERED_PRODUCTS,
      STORAGE_KEYS.DISCOVERED_DISTRIBUTORS,
      "distributor_health",
      "distributor_health_history",
      "recently_viewed",
      // Search terms are user activity like recently_viewed; leaving them meant
      // the next account on the device still saw the previous one's queries.
      RECENT_SEARCHES_KEY,
      // Error-boundary breadcrumbs (written, never read) can embed user data and
      // otherwise outlive every wipe.
      "last_error",
      "last_route_error",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "price_digest_snapshot",
      DISTRIBUTOR_BREAKER_KEY,
    ]);
  }

  async function clearAllData(): Promise<void> {
    // Drain queued writes first: otherwise an in-flight save started before
    // the clear would land afterwards and resurrect deleted data.
    await ctx.drainQueues();
    // Cancel scheduled notifications for the reminders/watches being wiped, or
    // they still fire after the wipe.
    await cancelAllNotifications().catch(() => {});
    await ctx.adapter.multiRemove([
      STORAGE_KEYS.WATCHLIST,
      STORAGE_KEYS.ALERTS,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.REMINDERS,
      STORAGE_KEYS.STOCK_WATCHES,
      STORAGE_KEYS.SYNC_META,
      STORAGE_KEYS.DISPLAYED_EVENT_IDS,
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      STORAGE_KEYS.FX_RATES,
      STORAGE_KEYS.FX_RATE_HISTORY,
      STORAGE_KEYS.PENDING_HEALTH_EVENTS,
      STORAGE_KEYS.DISCOVERED_PRODUCTS,
      STORAGE_KEYS.DISCOVERED_DISTRIBUTORS,
      // Distributor health telemetry lives under its own keys (not in
      // STORAGE_KEYS); omitting them left health data behind after a wipe.
      "distributor_health",
      "distributor_health_history",
      "recently_viewed",
      RECENT_SEARCHES_KEY,
      "last_error",
      "last_route_error",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "has_seen_onboarding",
      "price_digest_snapshot",
      DISTRIBUTOR_BREAKER_KEY,
      // Background-task interval marker: leaving it behind made a wiped app
      // skip a needed re-registration.
      STORAGE_KEYS.BACKGROUND_TASK_INTERVAL,
    ]);
  }

  // Removing a product must also remove everything scoped to it: an alert,
  // reminder, or stock watch for a product no longer on the watchlist can never
  // fire (price-check/restock skip products they cannot find) and rendered as a
  // stale row with a misleading count. Cascading here (rather than at each call
  // site) covers every removal path.
  async function removeFromWatchlist(productId: string): Promise<void> {
    await watchlist.removeFromWatchlist(productId);
    const alerts = await alertsStorage.getAlerts();
    for (const alert of alerts.filter((a) => a.productId === productId)) {
      await alertsStorage.removeAlert(alert.id);
    }
    // Reminders/watches carry a scheduled OS notification id. Removing the row
    // without cancelling the notification leaves it scheduled, so it still
    // fires with no corresponding reminder. The canceller is injected (see
    // createStorage) so this module never imports expo-notifications.
    const reminders = await remindersStorage.getBackOrderReminders();
    for (const reminder of reminders.filter((r) => r.productId === productId)) {
      if (reminder.notificationId) {
        await cancelNotification(reminder.notificationId).catch(() => {});
      }
      await remindersStorage.removeBackOrderReminder(reminder.id);
    }
    const watches = await remindersStorage.getStockWatches();
    for (const watch of watches.filter((w) => w.productId === productId)) {
      if (watch.notificationId) {
        await cancelNotification(watch.notificationId).catch(() => {});
      }
      await remindersStorage.removeStockWatch(watch.id);
    }
  }

  // Remove a single reminder/watch by id, cancelling its scheduled
  // notification first. Used by the sync tombstone path, which removes by id
  // (not by product) and would otherwise leave the notification scheduled.
  async function removeReminderById(id: string): Promise<void> {
    const reminder = (await remindersStorage.getBackOrderReminders()).find(
      (r) => r.id === id,
    );
    if (reminder?.notificationId) {
      await cancelNotification(reminder.notificationId).catch(() => {});
    }
    await remindersStorage.removeBackOrderReminder(id);
  }

  async function removeStockWatchById(id: string): Promise<void> {
    const watch = (await remindersStorage.getStockWatches()).find(
      (w) => w.id === id,
    );
    if (watch?.notificationId) {
      await cancelNotification(watch.notificationId).catch(() => {});
    }
    await remindersStorage.removeStockWatch(id);
  }

  return {
    ...watchlist,
    ...alertsStorage,
    ...remindersStorage,
    ...createSettingsStorage(ctx, watchlist),
    ...createDigestFxStorage(ctx),
    ...createFxHistoryStorage(ctx),
    ...createSyncMetaStorage(ctx),
    ...createNotificationsStorage(ctx),
    ...createDiscoveryStorage(ctx),
    ...createBackgroundTaskStorage(ctx),
    removeFromWatchlist,
    removeReminderById,
    removeStockWatchById,
    setOnChange: ctx.setOnChange,
    // Additive observer: unlike setOnChange (single handler owned by the sync
    // engine) this can be used by several consumers, e.g. the tab badge.
    subscribeToStorageChanges: (
      fn: (collection: Collection, itemId: string) => void,
    ) => {
      ctx.addChangeListener(fn);
      return () => ctx.removeChangeListener(fn);
    },
    setChangeSuppressed: ctx.setChangeSuppressed,
    clearAllData,
    clearAccountData,
  };
}

export type Storage = ReturnType<typeof createStorage>;
// (kept as a type-only alias; see tests/price-check-budget-preserve.test.ts)

// ─── Default instance (mobile / AsyncStorage) ──────────────────────────────────
// Preserves backward-compatible named exports so existing imports work unchanged.
// On web we prefer IndexedDB (via idb-adapter) to avoid the 5 MB localStorage quota.
// 50×25×90 pts (~112k points) would exceed localStorage; capped to maxHistoryPerProduct
// and spilled to IDB when available (AsyncStorage on web is localStorage-backed).

export function getDefaultAdapter(): StorageAdapter {
  if (isIndexedDBAvailable()) {
    try {
      // isIndexedDBAvailable already checks window + indexedDB, so this is web with IDB
      return createIDBAdapter();
    } catch {
      // fall through to AsyncStorage
    }
  }
  return AsyncStorage;
}

export const defaultStorage = createStorage(getDefaultAdapter(), {
  // Lazy so expo-notifications is only pulled in when a reminder/watch with a
  // scheduled notification is actually removed (keeps it out of server/tests).
  cancelNotification: async (notificationId) => {
    const { cancelNotification } = await import("../notifications");
    await cancelNotification(notificationId);
  },
  cancelAllNotifications: async () => {
    const { cancelAllNotifications } = await import("../notifications");
    await cancelAllNotifications();
  },
});

// ─── Watchlist ───────────────────────────────────────────────────────────
export const {
  getWatchlist,
  saveWatchlist,
  updateWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateProductDetails,
  updateProductListings,
  refreshWatchlistPrices,
} = defaultStorage;
// ─── Alerts ──────────────────────────────────────────────────────────────
export const {
  getAlerts,
  saveAlerts,
  updateAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  snoozeAlert,
  updateAlert,
  rearmAlert,
  deactivateAlert,
} = defaultStorage;
// ─── Reminders ───────────────────────────────────────────────────────────
export const {
  getBackOrderReminders,
  saveBackOrderReminders,
  updateReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  saveStockWatches,
  updateStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
} = defaultStorage;
// ─── Settings / Meta ─────────────────────────────────────────────────────
export const {
  getSettings,
  saveSettings,
  updateSettings,
  getTagDefinitions,
  saveTagDefinitions,
  setProductTags,
  addTagsToProducts,
  createTag,
  renameTag,
  setTagColor,
  deleteTag,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
  getFxRates,
  saveFxRates,
  getFxHistory,
  saveFxHistory,
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
  getPendingHealthEvents,
  savePendingHealthEvents,
  clearPendingHealthEvents,
  setOnChange,
  subscribeToStorageChanges,
  setChangeSuppressed,
  clearAllData,
  clearAccountData,
} = defaultStorage;
// ─── Discovery ─────────────────────────────────────────────────────────
export const {
  getDiscoveredProducts,
  saveDiscoveredProducts,
  addDiscoveredProduct,
  getDiscoveredDistributors,
  saveDiscoveredDistributors,
  addDiscoveredDistributor,
} = defaultStorage;
// ─── Background tasks ──────────────────────────────────────────────────
export const {
  getBackgroundTaskInterval,
  saveBackgroundTaskInterval,
} = defaultStorage;
