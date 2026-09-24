import { getBestPrice } from "../../../lib/currency";
import { formatPrice } from "@shared/currency";
import type { Product } from "../../../lib/types";

export interface BasketAlertSettings {
  notificationsEnabled?: boolean;
  basketAlertThreshold?: number | null;
  displayCurrency?: string | null;
}

export interface BasketAlertStorage {
  getSettings: () => Promise<BasketAlertSettings>;
  getWatchlist: () => Promise<Product[]>;
  updateSettings: (patch: { basketAlertThreshold: number | null }) => Promise<unknown>;
}

/**
 * Fires the basket-value alert when the watchlist total (best in-stock price per
 * product, in the display currency) is at or below the user's threshold, then
 * clears the threshold so it fires once.
 *
 * Mobile does this in lib/background-tasks/price-check.ts. The desktop could set
 * a threshold (Stats → Basket Value Alert) but never evaluated it, so the alert
 * never fired. Returns true when it fired and the threshold was cleared.
 */
export async function evaluateBasketAlert(
  storage: BasketAlertStorage,
  notify: (title: string, body: string, route?: string) => Promise<boolean>,
): Promise<boolean> {
  const settings = await storage.getSettings();
  const threshold = settings.basketAlertThreshold ?? null;
  if (!settings.notificationsEnabled || threshold == null || threshold <= 0) {
    return false;
  }
  const currency = settings.displayCurrency ?? "USD";
  const watchlist = await storage.getWatchlist();
  const total = watchlist.reduce(
    (sum, p) => sum + (getBestPrice(p.listings ?? [], currency)?.price ?? 0),
    0,
  );
  if (total <= 0 || total > threshold) return false;
  const ok = await notify(
    "🧺 Basket Alert",
    `Watchlist value ${formatPrice(total, currency)} dropped below your ${formatPrice(threshold, currency)} threshold.`,
    "/stats",
  );
  // Only clear the threshold once the alert actually fired; clearing it on a
  // failed send would lose the alert forever.
  if (ok) await storage.updateSettings({ basketAlertThreshold: null });
  return ok;
}
