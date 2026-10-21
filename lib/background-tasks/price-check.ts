import { log } from "@shared/log";
import {
  getSettings,
  getWatchlist,
  updateProductListings,
  setLastBackgroundRun,
} from "../storage";
import { checkRestocks } from "../restock";
import { checkCriterionWatches } from "./criterion-watches";
import { syncServerNotifications } from "../server-notifications";
import { evaluatePriceAlerts } from "./price-alerts";
import { sendScheduledDigest } from "./digest";
import { checkBasketAlert } from "./basket-alert";
import { fulfillConciergePendingAlerts } from "./pending-alerts";
import type { DistributorListing, Product } from "../types";
import { createHealthCollector, type HealthCollector } from "./health-collector";
import { refreshListing } from "./refresh-listing";
import { isAutomaticProduct } from "../marketplace";

/**
 * Refreshes a product's listings while the budget allows, carrying unprocessed
 * listings through UNCHANGED. `updateProductListings` replaces the whole array,
 * so dropping the remainder here would delete those listings (and their price
 * history). Exported for testing.
 */
export async function refreshListingsWithinBudget(
  product: Product,
  healthCollector: HealthCollector,
  isBudgetExhausted: () => boolean,
): Promise<DistributorListing[]> {
  if (!isAutomaticProduct(product)) return product.listings;
  const out: DistributorListing[] = [];
  let exhausted = false;
  for (const listing of product.listings ?? []) {
    if (exhausted || isBudgetExhausted()) {
      exhausted = true;
      out.push(listing);
      continue;
    }
    out.push(await refreshListing(product, listing, healthCollector));
  }
  return out;
}

// A launch check, the background task and a foreground refresh can all fire
// close together. The notification path is idempotent (deactivateAlert returns
// false for an already-triggered alert), but overlapping runs still scrape every
// listing twice — wasted requests and needless rate-limit pressure. The second
// caller joins the in-flight run instead of starting another.
let inFlightPriceCheck: Promise<void> | null = null;

export async function runPriceCheckCore(opts?: {
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  if (inFlightPriceCheck) return inFlightPriceCheck;
  const run = runPriceCheckCoreInner(opts).finally(() => {
    inFlightPriceCheck = null;
  });
  inFlightPriceCheck = run;
  return run;
}

async function runPriceCheckCoreInner(opts?: {
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { onProgress } = opts ?? {};
  const watchlist = (await getWatchlist()).filter(isAutomaticProduct);
  if (watchlist.length === 0) return;

  const healthCollector = createHealthCollector();
  const startTime = Date.now();
  const TIME_BUDGET_MS = 25_000; // leave headroom for Android 30s limit

  // Scrape fresh prices for all products in parallel batches
  const CONCURRENCY = 3;
  for (let i = 0; i < watchlist.length; i += CONCURRENCY) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      log.warn(
        `[PriceCheck] Time budget exceeded after ${i}/${watchlist.length} products, deferring remainder`,
      );
      break;
    }
    const batch = watchlist.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (product, batchIdx) => {
        try {
          onProgress?.(i + batchIdx + 1, watchlist.length);
          if (!product.listings?.length) return;

          const updatedListings = await refreshListingsWithinBudget(
            product,
            healthCollector,
            () => Date.now() - startTime > TIME_BUDGET_MS,
          );

          // Never write an empty array over a non-empty one.
          if (updatedListings.length > 0) {
            await updateProductListings(product.id, updatedListings);
          }
        } catch (e) {
          log.warn(`[PriceCheck] Skipping ${product.id}:`, e);
        }
      }),
    );
  }

  await healthCollector.flush();

  await fulfillConciergePendingAlerts();

  // Check back-in-stock watches globally (independent of price alerts)
  await checkRestocks();

  await checkCriterionWatches();

  const settings = await getSettings();
  await sendScheduledDigest(settings);
  await checkBasketAlert(settings);
  await evaluatePriceAlerts(settings);

}

export async function checkPriceDropsNow(
  onProgress?: (current: number, total: number) => void,
) {
  // Foreground check — same logic as background task, called on app focus
  await runPriceCheckCore({ onProgress });

  // Record the timestamp here too: the health hook reads it as "last price
  // check (foreground or background)", so a foreground check must clear a
  // `stale` background task rather than only the background handler updating it.
  await setLastBackgroundRun(Date.now());

  // Pull any server-queued notification events (server-side detection supplement)
  await syncServerNotifications();
}
