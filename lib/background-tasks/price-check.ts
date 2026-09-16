import * as Notifications from "expo-notifications";
import {
  getAlerts,
  getSettings,
  getWatchlist,
  deactivateAlert,
  rearmAlert,
  updateProductListings,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
  saveSettings,
} from "../storage";
import { Platform } from "react-native";
import { formatPrice } from "@shared/currency";
import { convertPrice, getBestPrice } from "../currency";
import { ensureNotificationPermission, channelIdFor } from "../notifications";
import { checkRestocks } from "../restock";
import { maybeSendDigest } from "../price-digest";
import { syncServerNotifications } from "../server-notifications";
import { listingsForAlert } from "../alert-scope";
import type { DistributorListing } from "../types";
import { createHealthCollector } from "./health-collector";
import { refreshListing } from "./refresh-listing";

export async function runPriceCheckCore(opts?: {
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { onProgress } = opts ?? {};
  const watchlist = await getWatchlist();
  if (watchlist.length === 0) return;

  const healthCollector = createHealthCollector();
  const startTime = Date.now();
  const TIME_BUDGET_MS = 25_000; // leave headroom for Android 30s limit

  // Scrape fresh prices for all products in parallel batches
  const CONCURRENCY = 3;
  for (let i = 0; i < watchlist.length; i += CONCURRENCY) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.warn(
        `[PriceCheck] Time budget exceeded after ${i}/${watchlist.length} products, deferring remainder`,
      );
      break;
    }
    const batch = watchlist.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (product, batchIdx) => {
        try {
          onProgress?.(i + batchIdx + 1, watchlist.length);
          if (!product.listings?.length) return;

          const updatedListings: DistributorListing[] = [];

          for (const listing of product.listings) {
            if (Date.now() - startTime > TIME_BUDGET_MS) break;
            const updated = await refreshListing(
              product,
              listing,
              healthCollector,
            );
            updatedListings.push(updated);
          }

          await updateProductListings(product.id, updatedListings);
        } catch (e) {
          console.warn(`[PriceCheck] Skipping ${product.id}:`, e);
        }
      }),
    );
  }

  await healthCollector.flush();

  // Check back-in-stock watches globally (independent of price alerts)
  await checkRestocks();

  // Send a scheduled digest if one is due
  const settings = await getSettings();
  const prevDigest = await getPriceDigestSnapshot();
  const nextDigest = await maybeSendDigest(
    prevDigest,
    await getWatchlist(),
    settings,
    await getAlerts(),
  );
  if (nextDigest) await savePriceDigestSnapshot(nextDigest);

  // Basket value alert (fires once per set threshold, then auto-disables)
  if (settings.notificationsEnabled && settings.basketAlertThreshold) {
    const fresh = await getWatchlist();
    const total = fresh.reduce(
      (sum, p) => sum + (getBestPrice(p.listings ?? [], "USD")?.price ?? 0),
      0,
    );
    const threshold = settings.basketAlertThreshold;
    if (total > 0 && total <= threshold) {
      // ensureNotificationPermission (not requestNotificationPermissions, which
      // always returns false on web) so web users can receive basket alerts.
      const granted = await ensureNotificationPermission();
      if (granted) {
        try {
          const title = "🧺 Basket Alert";
          const body = `Watchlist value ${formatPrice(total, "USD")} dropped below your ${formatPrice(threshold, "USD")} threshold.`;
          if (Platform.OS === "web") {
            // expo-notifications is a no-op on web; use the Notification API.
            const { displayWebNotification } = await import("../web-notifications");
            if (!displayWebNotification(title, body)) return;
          } else {
            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: { type: "digest" },
                sound: true,
                ...(channelIdFor("digest") ? { channelId: channelIdFor("digest") } : {}),
              },
              trigger: null,
            });
          }
          // Only clear the threshold once the alert actually fired; clearing it
          // when permission is denied (or scheduling throws) silently loses the
          // alert forever.
          await saveSettings({ ...settings, basketAlertThreshold: null });
        } catch {
          // Leave the threshold set so the next run retries.
        }
      }
    }
  }

  // Now check price alerts against fresh prices
  if (!settings.notificationsEnabled || !settings.priceAlerts) return;

  const alerts = await getAlerts();
  const now = Date.now();
  const activeAlerts = alerts.filter(
    (a) =>
      a.isActive &&
      !a.triggeredAt &&
      (!a.snoozedUntil || new Date(a.snoozedUntil).getTime() <= now),
  );
  if (activeAlerts.length === 0) return;

  const refreshedWatchlist = await getWatchlist();

  for (const alert of activeAlerts) {
    const product = refreshedWatchlist.find((p) => p.id === alert.productId);
    if (!product?.listings?.length) continue;

    const eligibleListings = listingsForAlert(
      product.listings,
      alert.distributorId,
    );
    const inStockListings = eligibleListings.filter(
      (l) =>
        l.stockStatus === "in_stock" &&
        l.price > 0 &&
        Number.isFinite(l.price),
    );
    if (inStockListings.length === 0) continue;

    // Find the best (cheapest) in-stock price converted to alert currency
    const bestPrice = inStockListings.reduce((best, l) => {
      const converted = convertPrice(l.price, l.currency, alert.currency);
      if (converted === null) return best;
      return converted < best ? converted : best;
    }, Infinity);
    if (!Number.isFinite(bestPrice)) continue;

    const isRise = alert.direction === "rise";
    const triggered = isRise
      ? bestPrice >= alert.targetPrice
      : bestPrice <= alert.targetPrice;
    if (triggered) {
      // Re-read alerts to avoid duplicate fire
      const currentAlerts = await getAlerts();
      const current = currentAlerts.find((a) => a.id === alert.id);
      if (current?.triggeredAt) continue;
      // Price crossed target — fire notification and deactivate alert.
      // ensureNotificationPermission handles the web Notification API.
      const granted = await ensureNotificationPermission();
      if (!granted) continue;
      // Claim the transition first: a concurrent runner (foreground check
      // vs background task) that already triggered this alert makes
      // deactivateAlert return false, in which case we must not notify.
      if (!(await deactivateAlert(alert.id, bestPrice))) continue;
      try {
        const title = isRise ? "📈 Price Increase Alert!" : "💸 Price Drop Alert!";
        const body = `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — ${
          isRise ? "above" : "below"
        } your target of ${formatPrice(alert.targetPrice, alert.currency)}!`;
        if (Platform.OS === "web") {
          const { displayWebNotification } = await import("../web-notifications");
          displayWebNotification(title, body);
        } else {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: true,
              ...(channelIdFor("price") ? { channelId: channelIdFor("price") } : {}),
            },
            trigger: null,
          });
        }
        // Record locally-fired alerts in the in-app history too; otherwise the
        // Notification Center only shows server events and the counts diverge.
        try {
          const { recordNotificationEvent } = await import("../storage");
          await recordNotificationEvent({
            id: `local-price-${alert.id}-${Date.now()}`,
            type: isRise ? "price_rise" : "price_drop",
            title,
            body,
            alertId: alert.id,
            productId: alert.productId,
            triggeredPrice: bestPrice,
            currency: alert.currency,
            createdAt: Date.now(),
          });
        } catch {
          // history recording never breaks the check
        }
      } catch {
        // Scheduling failed after a successful claim: re-arm so a later run
        // retries instead of dropping the alert silently. Safe from
        // double-fire — only the claiming runner can re-arm this path.
        await rearmAlert(alert.id);
      }
    }
  }
}

export async function checkPriceDropsNow(
  onProgress?: (current: number, total: number) => void,
) {
  // Foreground check — same logic as background task, called on app focus
  await runPriceCheckCore({ onProgress });

  // Pull any server-queued notification events (server-side detection supplement)
  await syncServerNotifications();
}
