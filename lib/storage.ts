import AsyncStorage from "@react-native-async-storage/async-storage";
import { Product, PriceAlert, AppSettings, DistributorListing } from "./types";

const KEYS = {
  WATCHLIST: "watchlist_products",
  ALERTS: "price_alerts",
  SETTINGS: "app_settings",
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

export async function markAlertPurchased(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const updated = alerts.map((a) =>
    a.id === alertId ? { ...a, purchasedAt: new Date().toISOString(), isActive: false } : a
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
