import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";
import { getAlerts, getSettings, getWatchlist, saveAlerts, updateProductListings } from "./storage";
import { createHealthService, DistributorHealth } from "./scrapers/health";
import { convertPrice, formatPrice } from "./currency";
import { requestNotificationPermissions } from "./notifications";
import * as Notifications from "expo-notifications";
import { getParserByDistributorId } from "./scrapers/registry";
import { fetchWithParser } from "./scrapers/utils";
import { PricePoint, DistributorListing } from "./types";

export const PRICE_CHECK_TASK = "price-drop-check";

const healthService = createHealthService(AsyncStorage);

async function updateHealthForScrape(
  parserId: string,
  status: "working" | "error",
  reason?: string,
) {
  try {
    const current = await healthService.getDistributorHealth();
    const entry: DistributorHealth = {
      distributorId: parserId,
      status,
      reason,
      lastChecked: new Date().toISOString(),
    };
    const updated = current.some((h) => h.distributorId === parserId)
      ? current.map((h) => (h.distributorId === parserId ? entry : h))
      : [...current, entry];
    await healthService.saveDistributorHealth(updated);
  } catch {
    // Ignore health update errors
  }
}

// Must be defined in global scope, outside any component
TaskManager.defineTask(PRICE_CHECK_TASK, async () => {
  try {
    const watchlist = await getWatchlist();
    if (watchlist.length === 0)
      return BackgroundTask.BackgroundTaskResult.Success;

    // Scrape fresh prices for all products in parallel batches
    const CONCURRENCY = 3;
    for (let i = 0; i < watchlist.length; i += CONCURRENCY) {
      const batch = watchlist.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (product) => {
          if (!product.listings?.length) return;

          const updatedListings: DistributorListing[] = [];

          for (const listing of product.listings) {
            const parser = getParserByDistributorId(listing.distributorId);
            if (!parser) {
              updatedListings.push(listing);
              continue;
            }

            try {
              const url = parser.buildSearchUrl(product.modelNumber);
              const html = await fetchWithParser(parser, url);
              const result = parser.parsePrice(html);

              if (result) {
                await updateHealthForScrape(parser.id, "working");
                const now = new Date().toISOString();
                const newPricePoint: PricePoint = {
                  date: now,
                  price: result.price,
                  currency: result.currency,
                  stockStatus: result.stockStatus,
                };

                const updatedListing: DistributorListing = {
                  ...listing,
                  price: result.price,
                  currency: result.currency,
                  stockStatus: result.stockStatus,
                  expectedDate: result.expectedDate,
                  url: result.url,
                  lastChecked: now,
                  priceHistory: [...listing.priceHistory, newPricePoint],
                };

                updatedListings.push(updatedListing);
              } else {
                await updateHealthForScrape(parser.id, "error", "no price found");
                updatedListings.push(listing);
              }
            } catch (error) {
              await updateHealthForScrape(
                parser.id,
                "error",
                error instanceof Error ? error.message : String(error),
              );
              updatedListings.push(listing);
            }

            // 2-second delay between scrapes
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          await updateProductListings(product.id, updatedListings);
        }),
      );
    }

    // Now check price alerts against fresh prices
    const alerts = await getAlerts();
    const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
    if (activeAlerts.length === 0)
      return BackgroundTask.BackgroundTaskResult.Success;

    const refreshedWatchlist = await getWatchlist();

    for (const alert of activeAlerts) {
      const product = refreshedWatchlist.find((p) => p.id === alert.productId);
      if (!product?.listings?.length) continue;

      const inStockListings = product.listings.filter(
        (l) => l.stockStatus === "in_stock",
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
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💸 Price Drop Alert!",
            body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — below your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
            sound: true,
          },
          trigger: null,
        });
        // Deactivate the alert so it doesn't fire repeatedly
        alert.isActive = false;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = bestPrice;
      }
    }

    // Persist updated alert states
    await saveAlerts(alerts);
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
          const parser = getParserByDistributorId(listing.distributorId);
          if (!parser) {
            updatedListings.push(listing);
            continue;
          }

          try {
            const url = parser.buildSearchUrl(product.modelNumber);
            const html = await fetchWithParser(parser, url);
            const result = parser.parsePrice(html);

            if (result) {
              await updateHealthForScrape(parser.id, "working");
              const now = new Date().toISOString();
              const newPricePoint: PricePoint = {
                date: now,
                price: result.price,
                currency: result.currency,
                stockStatus: result.stockStatus,
              };

              const updatedListing: DistributorListing = {
                ...listing,
                price: result.price,
                currency: result.currency,
                stockStatus: result.stockStatus,
                expectedDate: result.expectedDate,
                url: result.url,
                lastChecked: now,
                priceHistory: [...listing.priceHistory, newPricePoint],
              };

              updatedListings.push(updatedListing);
            } else {
              await updateHealthForScrape(parser.id, "error", "no price found");
              updatedListings.push(listing);
            }
          } catch (error) {
            await updateHealthForScrape(
              parser.id,
              "error",
              error instanceof Error ? error.message : String(error),
            );
            updatedListings.push(listing);
          }

          // 2-second delay between scrapes
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        await updateProductListings(product.id, updatedListings);
      }),
    );
  }

  // Now check price alerts against fresh prices
  const alerts = await getAlerts();
  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
  if (activeAlerts.length === 0) return;

  const refreshedWatchlist = await getWatchlist();

  for (const alert of activeAlerts) {
    const product = refreshedWatchlist.find((p) => p.id === alert.productId);
    if (!product?.listings?.length) continue;
    const inStockListings = product.listings.filter(
      (l) => l.stockStatus === "in_stock",
    );
    if (inStockListings.length === 0) continue;
    const bestPrice = inStockListings.reduce((best, l) => {
      const converted = convertPrice(l.price, l.currency, alert.currency);
      return converted < best ? converted : best;
    }, Infinity);
    if (bestPrice <= alert.targetPrice) {
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
      // Persist immediately so the background task doesn't also fire a duplicate
      await saveAlerts(alerts);
    }
  }
}