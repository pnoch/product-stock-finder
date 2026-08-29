import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Collection } from "../types";
import { StorageAdapter, DISTRIBUTOR_BREAKER_KEY } from "./adapter";
import { createContext, STORAGE_KEYS } from "./context";
import { createWatchlistStorage } from "./watchlist";
import { createAlertsStorage } from "./alerts";
import { createRemindersStorage } from "./reminders";
import { createSettingsStorage } from "./settings";
import { createDigestFxStorage } from "./digest-fx";
import { createFxHistoryStorage } from "./fx-history";
import { createSyncMetaStorage } from "./sync-meta";
import { createNotificationsStorage } from "./notifications";

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
      "recently_viewed",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "has_seen_onboarding",
      "price_digest_snapshot",
      DISTRIBUTOR_BREAKER_KEY,
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
    setOnChange: ctx.setOnChange,
    setChangeSuppressed: ctx.setChangeSuppressed,
    clearAllData,
  };
}

export type Storage = ReturnType<typeof createStorage>;

// ─── Default instance (mobile / AsyncStorage) ──────────────────────────────────
// Preserves backward-compatible named exports so existing imports work unchanged.

export const defaultStorage = createStorage(AsyncStorage);

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
