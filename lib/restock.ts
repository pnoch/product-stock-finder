import { Platform } from "react-native";
import {
  getStockWatches,
  getWatchlist,
  getSettings,
  removeStockWatch,
  updateStockWatchStatus,
} from "./storage";
import { scheduleStockAlert } from "./notifications";
import { getDistributorById } from "@shared/distributors";

// Serializes concurrent checkRestocks calls (background task + foreground check)
// so overlapping runs can't both fire a duplicate restock notification.
let inFlight: Promise<void> | null = null;

export function checkRestocks(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runCheckRestocks().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runCheckRestocks(): Promise<void> {
  const watches = await getStockWatches();
  if (watches.length === 0) return;

  const settings = await getSettings();
  const watchlist = await getWatchlist();

  for (const watch of watches) {
    const product = watchlist.find((p) => p.id === watch.productId);
    if (!product?.listings?.length) continue;

    const currentListing = product.listings.find(
      (l) => l.distributorId === watch.distributorId,
    );
    if (!currentListing) continue;

    const prevStatus = watch.lastKnownStatus ?? "back_order";
    const newStatus = currentListing.stockStatus;

    if (prevStatus !== "in_stock" && newStatus === "in_stock") {
      // Back in stock — notify, then remove the watch. The watch is only
      // removed once the notification actually fired: deleting it on a failed
      // send would silently lose the restock alert forever.
      const notificationsEnabled =
        settings.notificationsEnabled !== false &&
        settings.stockAlerts !== false;
      let notified = false;
      if (notificationsEnabled) {
        try {
          const distrib = getDistributorById(watch.distributorId);
          if (Platform.OS === "web") {
            // No local scheduling on web; show a foreground web notification
            // so the watch isn't consumed without any user-visible alert.
            const { displayWebNotification } = await import("./web-notifications");
            displayWebNotification(
              "🟢 Back In Stock!",
              `${watch.productName} is now available at ${distrib?.name ?? watch.distributorName}.`,
            );
            notified = true;
          } else {
            const id = await scheduleStockAlert(
              watch.productName,
              distrib?.name ?? watch.distributorName,
              currentListing.price,
              currentListing.currency,
              watch.productId,
            );
            notified = id !== null;
          }
        } catch {
          notified = false;
        }
      } else {
        // Alerts disabled: nothing to deliver, so consuming the watch is fine.
        notified = true;
      }
      if (!notified) {
        // Keep the watch so the next cycle retries the notification.
        continue;
      }
      try {
        await removeStockWatch(watch.id);
      } catch {
        // Ignore remove failures — the watch stays for the next cycle
      }
    } else if (prevStatus !== newStatus) {
      // Status changed to another non-in-stock state — update cache
      try {
        await updateStockWatchStatus(
          watch.productId,
          watch.distributorId,
          newStatus,
        );
      } catch {
        // Ignore cache-update failures
      }
    }
  }
}
