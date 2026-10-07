import { log } from "@shared/log";
import { Platform } from "react-native";
import * as defaultStorageModule from "./storage";
import { ensureNotificationPermission, scheduleStockAlert } from "./notifications";
import { getDistributorById } from "@shared/distributors";
import type { BackOrderReminder } from "./types";

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
  updateStockWatchStatuses: typeof defaultStorageModule.updateStockWatchStatuses;
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
    .catch((e) => log.warn("[Restock] check failed", e))
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

  async function deliverRestock(
    watch: BackOrderReminder,
    body: string,
    names: string,
    price: number,
    currency: string,
  ): Promise<boolean> {
    const notificationsEnabled =
      settings.notificationsEnabled !== false && settings.stockAlerts !== false;
    if (!notificationsEnabled) return true; // nothing to deliver; consume is fine
    try {
      if (notify) return await notify("Back In Stock!", body);
      if (Platform.OS === "web") {
        const { displayWebNotification } = await import("./web-notifications");
        return displayWebNotification("Back In Stock!", body);
      }
      const granted = await ensureNotificationPermission();
      if (!granted) return false;
      const id = await scheduleStockAlert(
        watch.productName,
        names,
        price,
        currency,
        watch.productId,
      );
      return id !== null;
    } catch {
      return false;
    }
  }

  for (const watch of watches) {
    const product = watchlist.find((p) => p.id === watch.productId);
    if (!product?.listings?.length) continue;

    if (watch.scope === "any" || watch.distributorId === "*") {
      const prev = watch.lastKnownStatusByDistributor ?? {};
      const inStockNow = product.listings.filter(
        (l) => l.stockStatus === "in_stock",
      );
      const newlyInStock = inStockNow.filter(
        (l) => (prev[l.distributorId] ?? "back_order") !== "in_stock",
      );
      const statuses = Object.fromEntries(
        product.listings.map((l) => [l.distributorId, l.stockStatus]),
      );
      if (newlyInStock.length === 0) {
        try {
          await storage.updateStockWatchStatuses(watch.id, statuses);
        } catch {
          // Status caching is best-effort.
        }
        continue;
      }
      const names = newlyInStock
        .map((l) => getDistributorById(l.distributorId)?.name ?? l.distributorId)
        .join(", ");
      const body =
        newlyInStock.length === 1
          ? `${watch.productName} is now in stock at ${names}.`
          : `${watch.productName} is now in stock at ${newlyInStock.length} distributors: ${names}.`;
      const first = newlyInStock[0]!;
      if (
        !(await deliverRestock(
          watch,
          body,
          names,
          first.price,
          first.currency,
        ))
      ) {
        continue;
      }
      try {
        await storage.updateStockWatchStatuses(watch.id, statuses);
        await storage.removeStockWatch(watch.id);
      } catch {
        // Ignore persist failures — the watch stays for the next cycle.
      }
      try {
        await storage.recordNotificationEvent({
          id: `local-restock-${watch.id}-${Date.now()}`,
          type: "restock",
          title: "Back In Stock!",
          body,
          productId: watch.productId,
          createdAt: Date.now(),
        });
      } catch {
        // History is best-effort.
      }
      continue;
    }

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
      const distrib = getDistributorById(watch.distributorId);
      const names = distrib?.name ?? watch.distributorName;
      const body = `${watch.productName} is now available at ${names}.`;
      if (
        !(await deliverRestock(
          watch,
          body,
          names,
          currentListing.price,
          currentListing.currency,
        ))
      ) {
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
          title: "Back In Stock!",
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
