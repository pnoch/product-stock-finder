import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";
import { getAlerts, getWatchlist, saveAlerts } from "./storage";
import { convertPrice, formatPrice } from "./currency";
import { requestNotificationPermissions } from "./notifications";
import * as Notifications from "expo-notifications";

export const PRICE_CHECK_TASK = "price-drop-check";

// Must be defined in global scope, outside any component
TaskManager.defineTask(PRICE_CHECK_TASK, async () => {
  try {
    const alerts = await getAlerts();
    const activeAlerts = alerts.filter((a) => a.isActive);
    if (activeAlerts.length === 0) return BackgroundTask.BackgroundTaskResult.Success;

    const watchlist = await getWatchlist();
    let triggered = false;

    for (const alert of activeAlerts) {
      const product = watchlist.find((p) => p.id === alert.productId);
      if (!product?.listings?.length) continue;

      const inStockListings = product.listings.filter((l) => l.stockStatus === "in_stock");
      if (inStockListings.length === 0) continue;

      // Find the best (cheapest) in-stock price converted to alert currency
      const bestPrice = inStockListings.reduce((best, l) => {
        const converted = convertPrice(l.price, l.currency, alert.currency);
        return converted < best ? converted : best;
      }, Infinity);

      if (bestPrice <= alert.targetPrice) {
        // Price dropped below target — fire notification and deactivate alert
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💸 Price Drop Alert!",
            body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — below your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
            sound: true,
          },
          trigger: null,
        });
        triggered = true;
        // Deactivate the alert so it doesn't fire repeatedly
        alert.isActive = false;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = bestPrice;
      }
    }

    // Persist updated alert states
    await saveAlerts(alerts);
    return triggered
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerPriceCheckTask() {
  if (Platform.OS === "web") return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(PRICE_CHECK_TASK, {
        minimumInterval: 15, // minutes — minimum allowed by the OS
      });
    }
  } catch {
    // Background tasks not available on simulator/web — silently ignore
  }
}

export async function checkPriceDropsNow() {
  // Foreground check — same logic as background task, called on app focus
  const alerts = await getAlerts();
  const activeAlerts = alerts.filter((a) => a.isActive);
  if (activeAlerts.length === 0) return;

  const watchlist = await getWatchlist();
  let anyTriggered = false;

  for (const alert of activeAlerts) {
    const product = watchlist.find((p) => p.id === alert.productId);
    if (!product?.listings?.length) continue;
    const inStockListings = product.listings.filter((l) => l.stockStatus === "in_stock");
    if (inStockListings.length === 0) continue;
    const bestPrice = inStockListings.reduce((best, l) => {
      const converted = convertPrice(l.price, l.currency, alert.currency);
      return converted < best ? converted : best;
    }, Infinity);
    if (bestPrice <= alert.targetPrice) {
      await requestNotificationPermissions();
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
      anyTriggered = true;
    }
  }
  if (anyTriggered) await saveAlerts(alerts);
}
