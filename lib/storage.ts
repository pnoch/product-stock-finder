import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Product,
  PriceAlert,
  AppSettings,
  DistributorListing,
  BackOrderReminder,
} from "./types";

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export function createStorage(adapter: StorageAdapter) {
  const KEYS = {
    WATCHLIST: "watchlist_products",
    ALERTS: "price_alerts",
    SETTINGS: "app_settings",
    REMINDERS: "back_order_reminders",
    STOCK_WATCHES: "back_in_stock_watches",
  };

  const DEFAULT_SETTINGS: AppSettings = {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  };

  // ─── Watchlist ──────────────────────────────────────────────────────────────

  async function getWatchlist(): Promise<Product[]> {
    try {
      const raw = await adapter.getItem(KEYS.WATCHLIST);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveWatchlist(products: Product[]): Promise<void> {
    await adapter.setItem(KEYS.WATCHLIST, JSON.stringify(products));
  }

  async function addToWatchlist(product: Product): Promise<void> {
    const list = await getWatchlist();
    const exists = list.find((p) => p.id === product.id);
    if (!exists) {
      list.unshift({
        ...product,
        isWatched: true,
        addedAt: new Date().toISOString(),
      });
      await saveWatchlist(list);
    }
  }

  async function removeFromWatchlist(productId: string): Promise<void> {
    const list = await getWatchlist();
    await saveWatchlist(list.filter((p) => p.id !== productId));
  }

  async function updateProductListings(
    productId: string,
    listings: DistributorListing[],
  ): Promise<void> {
    const list = await getWatchlist();
    const updated = list.map((p) =>
      p.id === productId ? { ...p, listings } : p,
    );
    await saveWatchlist(updated);
  }

  async function refreshWatchlistPrices(): Promise<void> {
    const list = await getWatchlist();
    const now = new Date().toISOString();
    const updated = list.map((p) => ({ ...p, lastRefreshed: now }));
    await saveWatchlist(updated);
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  async function getAlerts(): Promise<PriceAlert[]> {
    try {
      const raw = await adapter.getItem(KEYS.ALERTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
    await adapter.setItem(KEYS.ALERTS, JSON.stringify(alerts));
  }

  async function addAlert(alert: PriceAlert): Promise<void> {
    const alerts = await getAlerts();
    alerts.unshift(alert);
    await saveAlerts(alerts);
  }

  async function removeAlert(alertId: string): Promise<void> {
    const alerts = await getAlerts();
    await saveAlerts(alerts.filter((a) => a.id !== alertId));
  }

  async function toggleAlert(alertId: string): Promise<void> {
    const alerts = await getAlerts();
    const updated = alerts.map((a) =>
      a.id === alertId ? { ...a, isActive: !a.isActive } : a,
    );
    await saveAlerts(updated);
  }

  async function rearmAlert(alertId: string): Promise<void> {
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
  }

  // ─── Back-Order Reminders ───────────────────────────────────────────────────

  async function getBackOrderReminders(): Promise<BackOrderReminder[]> {
    try {
      const raw = await adapter.getItem(KEYS.REMINDERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveBackOrderReminders(
    reminders: BackOrderReminder[],
  ): Promise<void> {
    await adapter.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  }

  async function addBackOrderReminder(
    reminder: BackOrderReminder,
  ): Promise<void> {
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
  }

  async function removeBackOrderReminder(
    reminderId: string,
  ): Promise<void> {
    const reminders = await getBackOrderReminders();
    await saveBackOrderReminders(reminders.filter((r) => r.id !== reminderId));
  }

  // ─── Back-In-Stock Watches ──────────────────────────────────────────────────

  async function getStockWatches(): Promise<BackOrderReminder[]> {
    try {
      const raw = await adapter.getItem(KEYS.STOCK_WATCHES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveStockWatches(
    watches: BackOrderReminder[],
  ): Promise<void> {
    await adapter.setItem(KEYS.STOCK_WATCHES, JSON.stringify(watches));
  }

  async function addStockWatch(watch: BackOrderReminder): Promise<void> {
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
  }

  async function removeStockWatch(watchId: string): Promise<void> {
    const watches = await getStockWatches();
    await saveStockWatches(watches.filter((w) => w.id !== watchId));
  }

  async function updateStockWatchStatus(
    productId: string,
    distributorId: string,
    status: string,
  ): Promise<void> {
    const watches = await getStockWatches();
    const updated = watches.map((w) =>
      w.productId === productId && w.distributorId === distributorId
        ? { ...w, lastKnownStatus: status }
        : w,
    );
    await saveStockWatches(updated);
  }

  // ─── Clear All Data ─────────────────────────────────────────────────────────

  async function clearAllData(): Promise<void> {
    await adapter.multiRemove([
      KEYS.WATCHLIST,
      KEYS.ALERTS,
      KEYS.SETTINGS,
      KEYS.REMINDERS,
      KEYS.STOCK_WATCHES,
      "recently_viewed",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "has_seen_onboarding",
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
    clearAllData,
  };
}

export type Storage = ReturnType<typeof createStorage>;

// ─── Default instance (mobile / AsyncStorage) ──────────────────────────────────
// Preserves backward-compatible named exports so existing imports work unchanged.

const defaultStorage = createStorage(AsyncStorage);

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
  clearAllData,
} = defaultStorage;