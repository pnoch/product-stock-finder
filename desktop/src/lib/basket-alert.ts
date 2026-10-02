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
  recordNotificationEvent: (event: {
    id: string;
    // "digest" is the shared history/routing type whose destination is /stats,
    // which is where the basket value lives (mobile tags its basket notification
    // `data.type = "digest"` for the same reason).
    type: "digest";
    title: string;
    body: string;
    createdAt: number;
  }) => Promise<unknown>;
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
    "Basket Alert",
    `Watchlist value ${formatPrice(total, currency)} dropped below your ${formatPrice(threshold, currency)} threshold.`,
    "/stats",
  );
  // Only clear the threshold once the alert actually fired; clearing it on a
  // failed send would lose the alert forever.
  if (ok) {
    await storage.updateSettings({ basketAlertThreshold: null });
    // Record in the in-app notification history, matching the price-drop and
    // restock paths: otherwise the Notification Center only shows server events
    // and its counts diverge from what was actually delivered. Best-effort — a
    // history write failure must not resurrect the threshold.
    try {
      await storage.recordNotificationEvent({
        id: `local-basket-${new Date().toISOString().slice(0, 10)}`,
        type: "digest",
        title: "Basket Alert",
        body: `Watchlist value ${formatPrice(total, currency)} dropped below your ${formatPrice(threshold, currency)} threshold.`,
        createdAt: Date.now(),
      });
    } catch {
      // best-effort
    }
  }
  return ok;
}
