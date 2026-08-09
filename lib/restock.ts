import { Platform } from "react-native";
import {
  getStockWatches,
  getWatchlist,
  getSettings,
  removeStockWatch,
  updateStockWatchStatus,
} from "./storage";
import { scheduleStockAlert } from "./notifications";
import { getDistributorById } from "./distributors";

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
      // Back in stock — fire notification and remove watch
      const notificationsEnabled =
        settings.notificationsEnabled !== false && settings.stockAlerts !== false;
      if (notificationsEnabled && Platform.OS !== "web") {
        try {
          const distrib = getDistributorById(watch.distributorId);
          await scheduleStockAlert(
            watch.productName,
            distrib?.name ?? watch.distributorName,
            currentListing.price,
            currentListing.currency,
          );
        } catch {
          // Notification failure must not prevent watch removal
        }
      }
      try {
        await removeStockWatch(watch.id);
      } catch {
        // Ignore remove failures — the watch stays for the next cycle
      }
    } else if (prevStatus !== newStatus) {
      // Status changed to another non-in-stock state — update cache
      try {
        await updateStockWatchStatus(watch.productId, watch.distributorId, newStatus);
      } catch {
        // Ignore cache-update failures
      }
    }
  }
}
