import { Platform } from "react-native";
import * as defaultStorageModule from "./storage";
import { scheduleStockAlert } from "./notifications";
import { getDistributorById } from "@shared/distributors";

// The subset of the storage API this module needs. Injectable so the desktop
// build can pass its own store: the module-level `defaultStorage` uses
// IndexedDB when available (Tauri webviews have it), while the desktop UI
// writes localStorage — without injection the two diverge and restock watches
// created in the UI are invisible here.
export interface RestockStorage {
  getStockWatches: typeof defaultStorageModule.getStockWatches;
  getWatchlist: typeof defaultStorageModule.getWatchlist;
  getSettings: typeof defaultStorageModule.getSettings;
  removeStockWatch: typeof defaultStorageModule.removeStockWatch;
  updateStockWatchStatus: typeof defaultStorageModule.updateStockWatchStatus;
  recordNotificationEvent: typeof defaultStorageModule.recordNotificationEvent;
}

/**
 * Delivers the restock alert. Injectable because the desktop app must use its
 * own Tauri notification channel (like the digest and basket-alert paths) — the
 * default `Platform.OS === "web"` branch goes through the browser Notification
 * API, which is not granted in the Tauri webview, so the alert silently never
 * fired and the watch was retried forever.
 */
export type RestockNotifier = (
  title: string,
  body: string,
) => boolean | Promise<boolean>;

// Serializes concurrent checkRestocks calls (background task + foreground check)
// so overlapping runs can't both fire a duplicate restock notification.
let inFlight: Promise<void> | null = null;

export function checkRestocks(
  storage: RestockStorage = defaultStorageModule,
  notify?: RestockNotifier,
): Promise<void> {
  if (inFlight) return inFlight;
  // Best-effort: a storage read failure here must not reject, or it would
  // abort the rest of runPriceCheckCore (including the digest send) even though
  // the restock check is independent.
  inFlight = runCheckRestocks(storage, notify)
    .catch((e) => console.warn("[Restock] check failed", e))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function runCheckRestocks(
  storage: RestockStorage,
  notify?: RestockNotifier,
): Promise<void> {
  const watches = await storage.getStockWatches();
  if (watches.length === 0) return;

  const settings = await storage.getSettings();
  const watchlist = await storage.getWatchlist();

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
          const body = `${watch.productName} is now available at ${distrib?.name ?? watch.distributorName}.`;
          if (notify) {
            // Caller-provided channel (desktop → Tauri notification).
            notified = await notify("🟢 Back In Stock!", body);
          } else if (Platform.OS === "web") {
            // No local scheduling on web; show a foreground web notification
            // so the watch isn't consumed without any user-visible alert.
            const { displayWebNotification } = await import("./web-notifications");
            notified = displayWebNotification("🟢 Back In Stock!", body);
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
      // Record in the in-app history so the Notification Center reflects
      // locally-fired restocks, not just server events. Use the injected store:
      // the module-level default resolves to IndexedDB in a Tauri webview, a
      // different store from the desktop UI's localStorage, so desktop restock
      // events never reached the Alerts tab.
      try {
        await storage.recordNotificationEvent({
          id: `local-restock-${watch.id}-${Date.now()}`,
          type: "restock",
          title: "🟢 Back In Stock!",
          body: `${watch.productName} is now available at ${watch.distributorName}.`,
          productId: watch.productId,
          distributorId: watch.distributorId,
          createdAt: Date.now(),
        });
      } catch {
        // history recording never breaks the check
      }
      try {
        await storage.removeStockWatch(watch.id);
      } catch {
        // Ignore remove failures — the watch stays for the next cycle
      }
    } else if (prevStatus !== newStatus) {
      // Status changed to another non-in-stock state — update cache
      try {
        await storage.updateStockWatchStatus(
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
