import AsyncStorage from "@react-native-async-storage/async-storage";
import { NotificationHistoryEntry } from "../types";
import type { Collection, SyncMeta } from "../types";
import { StorageAdapter, DISTRIBUTOR_BREAKER_KEY } from "./adapter";
import { createContext, STORAGE_KEYS } from "./context";
import { createWatchlistStorage } from "./watchlist";
import { createAlertsStorage } from "./alerts";
import { createRemindersStorage } from "./reminders";
import { createSettingsStorage } from "./settings";
import { createDigestFxStorage } from "./digest-fx";

export { StorageAdapter, DISTRIBUTOR_BREAKER_KEY };

export function createStorage(
  adapter: StorageAdapter,
  opts?: { onChange?: (collection: Collection, itemId: string) => void },
) {
  const ctx = createContext(adapter);
  ctx.setOnChange(opts?.onChange ?? null);

  const { KEYS, notify, enqueue, readList } = ctx;
  const watchlist = createWatchlistStorage(ctx);
  const {
    getWatchlist,
    saveWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateProductListings,
    refreshWatchlistPrices,
  } = watchlist;
  const alertsStorage = createAlertsStorage(ctx);

  // ─── Sync Meta ─────────────────────────────────────────────────────────────

  async function getSyncMeta(): Promise<SyncMeta> {
    try {
      const raw = await adapter.getItem(KEYS.SYNC_META);
      if (!raw) return { lastSyncedAt: 0, items: {} };
      const parsed = JSON.parse(raw);
      return {
        lastSyncedAt:
          typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : 0,
        lastSyncOkAt:
          typeof parsed.lastSyncOkAt === "number"
            ? parsed.lastSyncOkAt
            : undefined,
        lastSyncError:
          typeof parsed.lastSyncError === "string" ||
          parsed.lastSyncError === null
            ? parsed.lastSyncError
            : undefined,
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
        lastSyncOkAt: meta.lastSyncOkAt ?? existing.lastSyncOkAt,
        lastSyncError:
          meta.lastSyncError !== undefined
            ? meta.lastSyncError
            : existing.lastSyncError,
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

  // ─── Pending Health Events (server mirroring buffer) ─────────────────────

  async function getPendingHealthEvents(): Promise<
    Array<{
      distributorId: string;
      distributorName: string;
      status: "blocked" | "error";
      title: string;
      body: string;
      createdAt: number;
    }>
  > {
    return readList(KEYS.PENDING_HEALTH_EVENTS);
  }

  async function savePendingHealthEvents(
    events: Array<{
      distributorId: string;
      distributorName: string;
      status: "blocked" | "error";
      title: string;
      body: string;
      createdAt: number;
    }>,
  ): Promise<void> {
    await adapter.setItem(KEYS.PENDING_HEALTH_EVENTS, JSON.stringify(events));
  }

  async function clearPendingHealthEvents(): Promise<void> {
    await adapter.removeItem(KEYS.PENDING_HEALTH_EVENTS);
  }

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
    setOnChange: ctx.setOnChange,
    setChangeSuppressed: ctx.setChangeSuppressed,
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
  getTagDefinitions,
  saveTagDefinitions,
  setProductTags,
  addTagsToProducts,
  createTag,
  renameTag,
  setTagColor,
  deleteTag,
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
  getFxRates,
  saveFxRates,
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
