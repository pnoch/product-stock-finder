import * as Notifications from "expo-notifications";
import {
  getAlerts,
  getSettings,
  getWatchlist,
  deactivateAlert,
  updateProductListings,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
} from "../storage";
import { convertPrice, formatPrice } from "../currency";
import { requestNotificationPermissions } from "../notifications";
import { checkRestocks } from "../restock";
import { maybeSendDigest } from "../price-digest";
import { syncServerNotifications } from "../server-notifications";
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

  // Scrape fresh prices for all products in parallel batches
  const CONCURRENCY = 3;
  for (let i = 0; i < watchlist.length; i += CONCURRENCY) {
    const batch = watchlist.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (product, batchIdx) => {
        onProgress?.(i + batchIdx + 1, watchlist.length);
        if (!product.listings?.length) return;

        const updatedListings: DistributorListing[] = [];

        for (const listing of product.listings) {
          const updated = await refreshListing(
            product,
            listing,
            healthCollector,
          );
          updatedListings.push(updated);

          // 2-second delay between scrapes
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        await updateProductListings(product.id, updatedListings);
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

  // Now check price alerts against fresh prices
  if (!settings.notificationsEnabled || !settings.priceAlerts) return;

  const alerts = await getAlerts();
  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
  if (activeAlerts.length === 0) return;

  const refreshedWatchlist = await getWatchlist();

  for (const alert of activeAlerts) {
    const product = refreshedWatchlist.find((p) => p.id === alert.productId);
    if (!product?.listings?.length) continue;

    const inStockListings = product.listings.filter(
      (l) =>
        l.stockStatus === "in_stock" &&
        l.price > 0 &&
        Number.isFinite(l.price),
    );
    if (inStockListings.length === 0) continue;

    // Find the best (cheapest) in-stock price converted to alert currency
    const bestPrice = inStockListings.reduce((best, l) => {
      const converted = convertPrice(l.price, l.currency, alert.currency);
      return converted < best ? converted : best;
    }, Infinity);

    if (bestPrice <= alert.targetPrice) {
      // Re-read alerts to avoid duplicate fire
      const currentAlerts = await getAlerts();
      const current = currentAlerts.find((a) => a.id === alert.id);
      if (current?.triggeredAt) continue;
      // Price dropped below target — fire notification and deactivate alert
      const granted = await requestNotificationPermissions();
      if (!granted) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💸 Price Drop Alert!",
          body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — below your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
          sound: true,
        },
        trigger: null,
      });
      // Deactivate the alert so it doesn't fire repeatedly
      await deactivateAlert(alert.id, bestPrice);
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
