import { Platform } from "react-native";
import { formatPrice } from "@shared/currency";
import { convertPrice, getBestPrice } from "../currency";
import {
  ensureNotificationPermission,
  scheduleStockAlert,
} from "../notifications";
import { evaluateCriterionWatches } from "../criterion-watch";
import {
  getCriterionWatches,
  getSettings,
  getWatchlist,
  recordNotificationEvent,
  updateCriterionWatches,
} from "../storage";
import { isAutomaticProduct } from "../marketplace";
import type { AvailableProduct } from "../types";

/**
 * Criterion watches: notify when a new matching product appears in stock.
 * Best-effort; a failure must never break the price check.
 */
export async function checkCriterionWatches(): Promise<void> {
  try {
try {
  const watches = await getCriterionWatches();
  if (watches.some((w) => w.isActive)) {
    // Lazy so this module (and tests that import it) never statically pulls
    // `expo-linking` via constants/oauth → server-catalog.
    const { isServerConfigured } = await import("../../constants/oauth");
    const { fetchAvailable } = await import("../server-catalog");
    const criterionSettings = await getSettings();
    const criterionEnabled =
      criterionSettings.notificationsEnabled !== false &&
      criterionSettings.stockAlerts !== false;
    const currency = criterionSettings.displayCurrency ?? "USD";
    let available: AvailableProduct[] = [];
    if (isServerConfigured()) {
      available = await fetchAvailable({ currency });
    } else {
      // Standalone: one entry per product (cheapest in-stock listing),
      // converted to the display currency so maxPrice compares like-for-like.
      const watchlist = await getWatchlist();
      for (const p of watchlist) {
        if (!isAutomaticProduct(p)) continue;
        const inStock = (p.listings ?? []).filter(
          (l) => l.stockStatus === "in_stock",
        );
        if (inStock.length === 0) continue;
        const best = getBestPrice(inStock, currency);
        if (!best) continue;
        available.push({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          modelNumber: p.modelNumber,
          bestPrice: best.price,
          bestCurrency: best.currency,
          bestDistributorId: inStock[0]!.distributorId,
          storeCount: inStock.length,
          fetchedAt: Date.now(),
        });
      }
    }
    // Convert each watch's cap into the display currency so maxPrice compares
    // like-for-like (the watch stores the currency it was created in).
    const evalWatches = watches.map((w) => ({
      ...w,
      maxPrice:
        w.maxPrice != null
          ? (convertPrice(w.maxPrice, w.currency, currency) ?? w.maxPrice)
          : undefined,
    }));
    const { matches } = evaluateCriterionWatches({
      watches: evalWatches,
      available,
    });

    // Notify per match; only a match that actually notified (or that needs no
    // notification) is marked seen, so a failed send re-detects next cycle.
    // Keyed by (watch, product): the same product matched by two watches must
    // not let one watch's success mark the other's failed send as seen.
    const notifiedKeys = new Set<string>();
    const keyOf = (m: { watchId: string; productId: string }) =>
      `${m.watchId}:${m.productId}`;
    for (const m of matches) {
      if (!criterionEnabled) {
        notifiedKeys.add(keyOf(m));
        continue;
      }
      try {
        let ok = false;
        if (Platform.OS === "web") {
          const { displayWebNotification } = await import("../web-notifications");
          ok = displayWebNotification(
            "New match",
            `${m.name} — ${formatPrice(m.bestPrice, m.bestCurrency)} at ${m.storeCount} store${m.storeCount === 1 ? "" : "s"}`,
          );
        } else {
          const granted = await ensureNotificationPermission();
          if (granted) {
            const id = await scheduleStockAlert(
              m.name,
              `${m.storeCount} store${m.storeCount === 1 ? "" : "s"}`,
              m.bestPrice,
              m.bestCurrency,
              m.productId,
            );
            ok = id !== null;
          }
        }
        if (ok) {
          notifiedKeys.add(keyOf(m));
          try {
            await recordNotificationEvent({
              id: `local-criterion-${m.watchId}-${m.productId}-${new Date().toISOString().slice(0, 10)}`,
              type: "criterion_match",
              title: "New match",
              body: `${m.name} — ${formatPrice(m.bestPrice, m.bestCurrency)} at ${m.storeCount} store${m.storeCount === 1 ? "" : "s"}`,
              productId: m.productId,
              createdAt: Date.now(),
            });
          } catch {
            // history is best-effort
          }
        }
      } catch {
        // best effort
      }
    }

    // Merge into the CURRENT store (a watch added/removed during the fetch
    // must not be clobbered) and advance seen ids only for notified matches.
    const notifiedByWatch = new Map<string, Set<string>>();
    for (const m of matches) {
      if (!notifiedKeys.has(keyOf(m))) continue;
      const set = notifiedByWatch.get(m.watchId) ?? new Set<string>();
      set.add(m.productId);
      notifiedByWatch.set(m.watchId, set);
    }
    await updateCriterionWatches((current) =>
      current.map((w) => {
        const notified = notifiedByWatch.get(w.id);
        if (!notified) return w;
        const next = new Set(w.seenProductIds);
        for (const id of notified) next.add(id);
        return { ...w, seenProductIds: [...next] };
      }),
    );
  }
} catch {
  // criterion evaluation is best-effort; never break the price check
}

  } catch {
    // criterion evaluation is best-effort; never break the price check
  }
}
