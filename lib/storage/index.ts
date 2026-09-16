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
import { createSyncMetaStorage } from "./sync-meta";
import { createNotificationsStorage } from "./notifications";
import { createDiscoveryStorage, createBackgroundTaskStorage } from "./discovery";

export { DISTRIBUTOR_BREAKER_KEY };
export type { StorageAdapter };

export function createStorage(
  adapter: StorageAdapter,
  opts?: { onChange?: (collection: Collection, itemId: string) => void },
) {
  const ctx = createContext(adapter);
  ctx.setOnChange(opts?.onChange ?? null);

  const watchlist = createWatchlistStorage(ctx);
  const alertsStorage = createAlertsStorage(ctx);

  // ─── Clear All Data ─────────────────────────────────────────────────────────

  async function clearAllData(): Promise<void> {
    // Drain queued writes first: otherwise an in-flight save started before
    // the clear would land afterwards and resurrect deleted data.
    await ctx.drainQueues();
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

  return {
    ...watchlist,
    ...alertsStorage,
    ...createRemindersStorage(ctx),
    ...createSettingsStorage(ctx, watchlist),
    ...createDigestFxStorage(ctx),
    ...createFxHistoryStorage(ctx),
    ...createSyncMetaStorage(ctx),
    ...createNotificationsStorage(ctx),
    ...createDiscoveryStorage(ctx),
    ...createBackgroundTaskStorage(ctx),
    setOnChange: ctx.setOnChange,
    setChangeSuppressed: ctx.setChangeSuppressed,
    clearAllData,
  };
}

export type Storage = ReturnType<typeof createStorage>;

// ─── Default instance (mobile / AsyncStorage) ──────────────────────────────────
// Preserves backward-compatible named exports so existing imports work unchanged.
// On web we prefer IndexedDB (via idb-adapter) to avoid the 5 MB localStorage quota.
// 50×25×90 pts (~112k points) would exceed localStorage; capped to maxHistoryPerProduct
// and spilled to IDB when available (AsyncStorage on web is localStorage-backed).

function getDefaultAdapter(): StorageAdapter {
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

export const defaultStorage = createStorage(getDefaultAdapter());

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
  setChangeSuppressed,
  clearAllData,
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
