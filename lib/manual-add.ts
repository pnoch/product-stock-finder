import { withTimeoutReject } from "./with-timeout";
import type { DistributorListing, Product } from "./types";
import { isAutomaticProduct } from "./marketplace";
import { isMarketplaceKey } from "../shared/marketplace-url";
import { getAllParserIds } from "./scrapers/registry";
import type { DiscoverOptions } from "./listing-discovery";

// A cold discovery sweeps every registered parser with concurrency 3, so the
// first pass can exceed 15s when the server cache is empty. Warm searches
// finish well inside this budget; the longer ceiling only affects cold starts.
export const DISCOVER_TIMEOUT_MS = 30_000;

export interface ManualAddInput {
  id: string;
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
  tags?: string[];
}

export type ManualAddResult =
  | { status: "duplicate" }
  | { status: "created"; discovered: number; timedOut: boolean };

export interface ManualAddStorage extends RediscoverStorage {
  addToWatchlist(product: Product): Promise<unknown>;
}

export interface RediscoverStorage {
  updateProductListings(id: string, listings: DistributorListing[], discovery?: Product["discovery"]): Promise<unknown>;
}

export type DiscoverFn = (
  model: string,
  opts: DiscoverOptions & { productId: string },
) => Promise<DistributorListing[]>;

export async function manualAddProduct(deps: {
  storage: ManualAddStorage;
  trackedIds: { has(id: string): boolean };
  discover: DiscoverFn;
  input: ManualAddInput;
  onProgress?: (done: number, total: number) => void;
  timeoutMs?: number;
}): Promise<ManualAddResult> {
  const { storage, trackedIds, discover, input, onProgress, timeoutMs = DISCOVER_TIMEOUT_MS } = deps;
  if (trackedIds.has(input.id)) return { status: "duplicate" };
  const added = await storage.addToWatchlist({
    ...input,
    isWatched: true,
    addedAt: new Date().toISOString(),
    listings: [],
  });
  // `trackedIds` can be stale (a sync landing between the check and the write)
  // and storage dedupes — do NOT run discovery then, or the existing product's
  // listings and history get replaced with a fresh single-point array.
  if (!added) return { status: "duplicate" };
  const result = await rediscoverProduct({ storage, discover, productId: input.id, modelNumber: input.modelNumber, onProgress, timeoutMs });
  return { status: "created", ...result };
}

/** Products discovered per price-check run (each is a search across every distributor). */
export const MISSING_LISTINGS_PER_RUN = 2;

/**
 * How long before a product that still has no listings is retried. The
 * watchlist is newest-first, so without this the same first N products were
 * re-scraped across every distributor on every launch while later products
 * (and the whole bulk-import backlog) were never reached.
 */
export const MISSING_LISTINGS_RETRY_MS = 6 * 60 * 60 * 1000;

// Per-process attempt record (each launch/sweep runs in one process).
const lastListingAttemptAt = new Map<string, number>();

export function clearListingAttemptsForTests(): void {
  lastListingAttemptAt.clear();
}

/**
 * Marks a discovery attempt so the background rotation skips the product for
 * the retry window. Recorded for user-driven misses too, so a "Find prices"
 * that found nothing is not immediately re-scraped by the next sweep.
 */
export function recordListingAttempt(productId: string, now = Date.now()): void {
  lastListingAttemptAt.set(productId, now);
}

/**
 * True when a previous discovery covered some, but not all, distributors.
 * The UI uses this to offer "Find more prices" instead of hiding the action
 * once the first listing arrives.
 */
export function hasIncompleteDiscovery(
  product: Pick<Product, "discovery">,
): boolean {
  const completed = product.discovery?.completedDistributorIds.length ?? 0;
  return completed > 0 && completed < getAllParserIds().length;
}

export interface MissingListingsStorage extends RediscoverStorage {
  getWatchlist(): Promise<
    { id: string; modelNumber: string; marketplace?: Product["marketplace"]; listings?: DistributorListing[] }[]
  >;
}

/**
 * Discovers listings for watched products that have none.
 *
 * A bulk import — and any product whose listings were lost — stores an empty
 * array, and discovery is the only thing that fills it. Bounded per run: each
 * discovery searches every distributor, so a backlog drains gradually over
 * launches/refreshes instead of firing N x 25 requests at once.
 */
export async function rediscoverMissingListings(deps: {
  storage: MissingListingsStorage;
  discover: DiscoverFn;
  limit?: number;
  now?: number;
}): Promise<{ scanned: number; discovered: number }> {
  const {
    storage,
    discover,
    limit = MISSING_LISTINGS_PER_RUN,
    now = Date.now(),
  } = deps;
  const watchlist = await storage.getWatchlist();
  const missing = watchlist.filter(
    (product) =>
      isAutomaticProduct(product) &&
      !!product.modelNumber &&
      (product.listings?.length ?? 0) === 0 &&
      // Rotate: a product attempted recently is skipped so permanently
      // unfindable ones cannot occupy every run's slots.
      now - (lastListingAttemptAt.get(product.id) ?? 0) >=
        MISSING_LISTINGS_RETRY_MS,
  );
  const batch = missing.slice(0, Math.max(0, limit));
  for (const product of batch) recordListingAttempt(product.id, now);
  let discovered = 0;
  for (const product of batch) {
    try {
      const result = await rediscoverProduct({
        storage,
        discover,
        productId: product.id,
        modelNumber: product.modelNumber,
      });
      discovered += result.discovered;
    } catch {
      // Best-effort: the next run retries this product.
    }
  }
  return { scanned: batch.length, discovered };
}

export async function rediscoverProduct(deps: {
  storage: RediscoverStorage;
  discover: DiscoverFn;
  productId: string;
  modelNumber: string;
  onProgress?: (done: number, total: number) => void;
  timeoutMs?: number;
  completedDistributorIds?: string[];
  onSaved?: () => Promise<void>;
}): Promise<{ discovered: number; timedOut: boolean }> {
  const { storage, discover, productId, modelNumber, onProgress, onSaved, completedDistributorIds = [], timeoutMs = DISCOVER_TIMEOUT_MS } = deps;
  if (isMarketplaceKey(modelNumber)) return { discovered: 0, timedOut: false };
  const parserIds = getAllParserIds();
  const completed = new Set(completedDistributorIds.filter((id) => parserIds.includes(id)));
  const remaining = parserIds.filter((id) => !completed.has(id));
  if (remaining.length === 0) return { discovered: 0, timedOut: false };
  const controller = new AbortController();
  const found = new Map<string, DistributorListing>();
  let persistence = Promise.resolve();
  let streamed = false;
  let timedOut = false;
  onProgress?.(completed.size, parserIds.length);
  try {
    const listings = await withTimeoutReject(
      discover(modelNumber, {
        productId,
        parserIds: remaining,
        signal: controller.signal,
        onResult(distributorId, listing, failed) {
          if (controller.signal.aborted) return Promise.resolve();
          streamed = true;
          if (!failed) completed.add(distributorId);
          if (listing) found.set(distributorId, listing);
          const checkpoint = { modelNumber, completedDistributorIds: [...completed] };
          const completedCount = completed.size;
          persistence = persistence.then(async () => {
            // A checkpoint write is best-effort: losing one must not abort the
            // remaining distributors or discard the listings already found.
            try {
              await storage.updateProductListings(productId, listing ? [listing] : [], checkpoint);
              // Only a new listing changes what the screen renders; a miss just
              // advances the checkpoint.
              if (listing) await onSaved?.();
            } catch {
              // The next checkpoint or the final write retries the same data.
            }
            onProgress?.(completedCount, parserIds.length);
          });
          return persistence;
        },
        onProgress: (done, total) => {
          // Streaming checkpoints already report progress; this covers a
          // discover implementation that only reports completion counts.
          if (!streamed) onProgress?.(done, total);
        },
      }),
      timeoutMs,
    );
    if (!streamed && listings.length > 0) {
      for (const listing of listings) found.set(listing.distributorId, listing);
      await storage.updateProductListings(productId, listings);
      await onSaved?.();
    }
  } catch (e) {
    if (e instanceof Error && e.message === "timeout") {
      timedOut = true;
    } else {
      throw e;
    }
  } finally {
    controller.abort();
    await persistence;
  }
  if (found.size === 0) {
    recordListingAttempt(productId);
  }
  return { discovered: found.size, timedOut };
}
