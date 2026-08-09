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

export async function checkRestocks(): Promise<void> {
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
      if (settings.stockAlerts && Platform.OS !== "web") {
        const distrib = getDistributorById(watch.distributorId);
        await scheduleStockAlert(
          watch.productName,
          distrib?.name ?? watch.distributorName,
          currentListing.price,
          currentListing.currency,
        );
      }
      await removeStockWatch(watch.id);
    } else if (prevStatus !== newStatus) {
      // Status changed to another non-in-stock state — update cache
      await updateStockWatchStatus(watch.productId, watch.distributorId, newStatus);
    }
  }
}
