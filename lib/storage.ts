import AsyncStorage from "@react-native-async-storage/async-storage";
import { Product, PriceAlert, AppSettings, DistributorListing, BackOrderReminder } from "./types";

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

// ─── Watchlist ────────────────────────────────────────────────────────────────

export async function getWatchlist(): Promise<Product[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATCHLIST);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveWatchlist(products: Product[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.WATCHLIST, JSON.stringify(products));
}

export async function addToWatchlist(product: Product): Promise<void> {
  const list = await getWatchlist();
  const exists = list.find((p) => p.id === product.id);
  if (!exists) {
    list.unshift({ ...product, isWatched: true, addedAt: new Date().toISOString() });
    await saveWatchlist(list);
  }
}

export async function removeFromWatchlist(productId: string): Promise<void> {
  const list = await getWatchlist();
  await saveWatchlist(list.filter((p) => p.id !== productId));
}

export async function updateProductListings(
  productId: string,
  listings: DistributorListing[]
): Promise<void> {
  const list = await getWatchlist();
  const updated = list.map((p) =>
    p.id === productId ? { ...p, listings } : p
  );
  await saveWatchlist(updated);
}

/**
 * Stamps `lastRefreshed` on every product in the watchlist (simulated refresh).
 * In a real app this would re-fetch live prices; here it refreshes the timestamp
 * so the "Updated X min ago" UI shows the correct time.
 */
export async function refreshWatchlistPrices(): Promise<void> {
  const list = await getWatchlist();
  const now = new Date().toISOString();
  const updated = list.map((p) => ({ ...p, lastRefreshed: now }));
  await saveWatchlist(updated);
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getAlerts(): Promise<PriceAlert[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ALERTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ALERTS, JSON.stringify(alerts));
}

export async function addAlert(alert: PriceAlert): Promise<void> {
  const alerts = await getAlerts();
  alerts.unshift(alert);
  await saveAlerts(alerts);
}

export async function removeAlert(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  await saveAlerts(alerts.filter((a) => a.id !== alertId));
}

export async function toggleAlert(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const updated = alerts.map((a) =>
    a.id === alertId ? { ...a, isActive: !a.isActive } : a
  );
  await saveAlerts(updated);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// ─── Back-Order Reminders ─────────────────────────────────────────────────────

export async function getBackOrderReminders(): Promise<BackOrderReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.REMINDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveBackOrderReminders(reminders: BackOrderReminder[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
}

export async function addBackOrderReminder(reminder: BackOrderReminder): Promise<void> {
  const reminders = await getBackOrderReminders();
  const existing = reminders.findIndex((r) => r.productId === reminder.productId && r.distributorId === reminder.distributorId);
  if (existing >= 0) {
    reminders[existing] = reminder; // update existing
  } else {
    reminders.unshift(reminder);
  }
  await saveBackOrderReminders(reminders);
}

export async function removeBackOrderReminder(reminderId: string): Promise<void> {
  const reminders = await getBackOrderReminders();
  await saveBackOrderReminders(reminders.filter((r) => r.id !== reminderId));
}

// ─── Back-In-Stock Watches ────────────────────────────────────────────────────

export async function getStockWatches(): Promise<BackOrderReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STOCK_WATCHES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveStockWatches(watches: BackOrderReminder[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.STOCK_WATCHES, JSON.stringify(watches));
}

export async function addStockWatch(watch: BackOrderReminder): Promise<void> {
  const watches = await getStockWatches();
  const existing = watches.findIndex((w) => w.productId === watch.productId && w.distributorId === watch.distributorId);
  if (existing >= 0) {
    watches[existing] = watch;
  } else {
    watches.unshift(watch);
  }
  await saveStockWatches(watches);
}

export async function removeStockWatch(watchId: string): Promise<void> {
  const watches = await getStockWatches();
  await saveStockWatches(watches.filter((w) => w.id !== watchId));
}

export async function updateStockWatchStatus(productId: string, distributorId: string, status: string): Promise<void> {
  const watches = await getStockWatches();
  const updated = watches.map((w) =>
    w.productId === productId && w.distributorId === distributorId
      ? { ...w, lastKnownStatus: status }
      : w
  );
  await saveStockWatches(updated);
}

// ─── Clear All Data ───────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
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
