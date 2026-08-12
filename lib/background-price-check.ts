import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";
import { getAlerts, getSettings, getWatchlist, deactivateAlert, updateProductListings, getPriceDigestSnapshot, savePriceDigestSnapshot } from "./storage";
import { createHealthService, DistributorHealth } from "./scrapers/health";
import { convertPrice, formatPrice } from "./currency";
import { requestNotificationPermissions } from "./notifications";
import * as Notifications from "expo-notifications";
import { getParserByDistributorId } from "./scrapers/registry";
import { fetchWithParser } from "./scrapers/utils";
import { fetchServerPrice, uploadServerHistory } from "./server-prices";
import { PricePoint, DistributorListing, Product } from "./types";
import { appendPricePoint, mergePriceHistory } from "./price-history";
import { checkRestocks } from "./restock";
import { maybeSendDigest } from "./price-digest";

export const PRICE_CHECK_TASK = "price-drop-check";

const PRICE_HISTORY_DAYS = 90;

const healthService = createHealthService(AsyncStorage);

function createHealthCollector() {
  const updates = new Map<string, DistributorHealth>();
  return {
    record(
      parserId: string,
      status: "working" | "blocked" | "error",
      reason?: string,
    ) {
      updates.set(parserId, {
        distributorId: parserId,
        status,
        reason,
        lastChecked: new Date().toISOString(),
      });
    },
    async flush() {
      if (updates.size === 0) return;
      try {
        const current = await healthService.getDistributorHealth();
        const merged = current.map((h) => updates.get(h.distributorId) ?? h);
        for (const [id, entry] of updates) {
          if (!current.some((h) => h.distributorId === id)) {
            merged.push(entry);
          }
        }
        await healthService.saveDistributorHealth(merged);
      } catch {
        // Ignore health update errors
      }
    },
  };
}

async function refreshListing(
  product: Product,
  listing: DistributorListing,
  healthCollector: ReturnType<typeof createHealthCollector>,
): Promise<DistributorListing> {
  const serverResult = await fetchServerPrice(
    listing.distributorId,
    product.modelNumber,
  );
  if (serverResult?.snapshot) {
    healthCollector.record(listing.distributorId, "working");
    const now = new Date().toISOString();
    const newPricePoint: PricePoint = {
      date: now,
      price: serverResult.snapshot.price,
      currency: serverResult.snapshot.currency,
      stockStatus: serverResult.snapshot.stockStatus,
    };
    const mergedHistory = mergePriceHistory(
      listing.priceHistory,
      serverResult.history,
    );
    if (serverResult.history.length < listing.priceHistory.length) {
      void uploadServerHistory(
        listing.distributorId,
        product.modelNumber,
        listing.priceHistory,
      );
    }
    return {
      ...listing,
      price: serverResult.snapshot.price,
      currency: serverResult.snapshot.currency,
      stockStatus: serverResult.snapshot.stockStatus,
      expectedDate: serverResult.snapshot.expectedDate,
      url: serverResult.snapshot.url,
      lastChecked: now,
      priceHistory: appendPricePoint(
        mergedHistory,
        newPricePoint,
        PRICE_HISTORY_DAYS,
      ),
    };
  }

  const parser = getParserByDistributorId(listing.distributorId);
  if (!parser) return listing;

  try {
    const url = parser.buildSearchUrl(product.modelNumber);
    const html = await fetchWithParser(parser, url);
    const result = parser.parsePrice(html);

    if (result) {
      healthCollector.record(parser.id, "working");
      const now = new Date().toISOString();
      const newPricePoint: PricePoint = {
        date: now,
        price: result.price,
        currency: result.currency,
        stockStatus: result.stockStatus,
      };
      return {
        ...listing,
        price: result.price,
        currency: result.currency,
        stockStatus: result.stockStatus,
        expectedDate: result.expectedDate,
        url: result.url,
        lastChecked: now,
        priceHistory: appendPricePoint(
          listing.priceHistory,
          newPricePoint,
          PRICE_HISTORY_DAYS,
        ),
      };
    }
    if (
      html.includes("403 Forbidden") ||
      html.includes("Access Denied") ||
      html.includes("cf-browser-verification") ||
      html.includes("Checking your browser")
    ) {
      healthCollector.record(parser.id, "blocked", "blocked by site");
      return listing;
    }
    healthCollector.record(parser.id, "error", "no price found");
    return listing;
  } catch (error) {
    healthCollector.record(
      parser.id,
      "error",
      error instanceof Error ? error.message : String(error),
    );
    return listing;
  }
}

// Must be defined in global scope, outside any component
TaskManager.defineTask(PRICE_CHECK_TASK, async () => {
  try {
    const watchlist = await getWatchlist();
    if (watchlist.length === 0)
      return BackgroundTask.BackgroundTaskResult.Success;

    const healthCollector = createHealthCollector();

    // Scrape fresh prices for all products in parallel batches
    const CONCURRENCY = 3;
    for (let i = 0; i < watchlist.length; i += CONCURRENCY) {
      const batch = watchlist.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (product) => {
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
    if (!settings.notificationsEnabled || !settings.priceAlerts)
      return BackgroundTask.BackgroundTaskResult.Success;

    const alerts = await getAlerts();
    const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
    if (activeAlerts.length === 0)
      return BackgroundTask.BackgroundTaskResult.Success;

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

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerPriceCheckTask() {
  if (Platform.OS === "web") return;
  try {
    const settings = await getSettings();
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK);

    if (settings.checkInterval === "manual") {
      // Manual mode — unregister if previously registered
      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(PRICE_CHECK_TASK);
      }
      return;
    }

    const intervalMinutes =
      settings.checkInterval === "hourly" ? 60 : 1440;

    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(PRICE_CHECK_TASK, {
        minimumInterval: intervalMinutes,
      });
    } else {
      // Re-register to update the interval if it changed
      await BackgroundTask.unregisterTaskAsync(PRICE_CHECK_TASK);
      await BackgroundTask.registerTaskAsync(PRICE_CHECK_TASK, {
        minimumInterval: intervalMinutes,
      });
    }
  } catch {
    // Background tasks not available on simulator/web — silently ignore
  }
}

export async function checkPriceDropsNow(
  onProgress?: (current: number, total: number) => void,
) {
  // Foreground check — same logic as background task, called on app focus
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
    const bestPrice = inStockListings.reduce((best, l) => {
      const converted = convertPrice(l.price, l.currency, alert.currency);
      return converted < best ? converted : best;
    }, Infinity);
    if (bestPrice <= alert.targetPrice) {
      // Re-read alerts to avoid duplicate fire with a concurrent background task
      const currentAlerts = await getAlerts();
      const current = currentAlerts.find((a) => a.id === alert.id);
      if (current?.triggeredAt) continue;
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
      alert.isActive = false;
      alert.triggeredAt = new Date().toISOString();
      alert.triggeredPrice = bestPrice;
      // Persist immediately (mutex-protected) so the background task doesn't also fire a duplicate
      await deactivateAlert(alert.id, bestPrice);
    }
  }
}