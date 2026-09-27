import { withTimeoutReject } from "./with-timeout";
import type { DistributorListing, Product } from "./types";

export const DISCOVER_TIMEOUT_MS = 15_000;

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

export interface ManualAddStorage {
  addToWatchlist(product: Product): Promise<unknown>;
  updateProductListings(id: string, listings: DistributorListing[]): Promise<unknown>;
}

export interface RediscoverStorage {
  updateProductListings(id: string, listings: DistributorListing[]): Promise<unknown>;
}

export type DiscoverFn = (
  model: string,
  opts: { productId: string; onProgress?: (done: number, total: number) => void },
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
  let listings: DistributorListing[];
  let timedOut = false;
  try {
    listings = await withTimeoutReject(
      discover(input.modelNumber, { productId: input.id, onProgress }),
      timeoutMs,
    );
  } catch (e) {
    if (e instanceof Error && e.message === "timeout") {
      listings = [];
      timedOut = true;
    } else {
      throw e;
    }
  }
  if (listings.length > 0) await storage.updateProductListings(input.id, listings);
  return { status: "created", discovered: listings.length, timedOut };
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

export interface MissingListingsStorage extends RediscoverStorage {
  getWatchlist(): Promise<
    { id: string; modelNumber: string; listings?: DistributorListing[] }[]
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
      !!product.modelNumber &&
      (product.listings?.length ?? 0) === 0 &&
      // Rotate: a product attempted recently is skipped so permanently
      // unfindable ones cannot occupy every run's slots.
      now - (lastListingAttemptAt.get(product.id) ?? 0) >=
        MISSING_LISTINGS_RETRY_MS,
  );
  const batch = missing.slice(0, Math.max(0, limit));
  for (const product of batch) lastListingAttemptAt.set(product.id, now);
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
}): Promise<{ discovered: number; timedOut: boolean }> {
  const { storage, discover, productId, modelNumber, onProgress, timeoutMs = DISCOVER_TIMEOUT_MS } = deps;
  let listings: DistributorListing[];
  let timedOut = false;
  try {
    listings = await withTimeoutReject(
      discover(modelNumber, { productId, onProgress }),
      timeoutMs,
    );
  } catch (e) {
    if (e instanceof Error && e.message === "timeout") {
      listings = [];
      timedOut = true;
    } else {
      throw e;
    }
  }
  if (listings.length > 0) await storage.updateProductListings(productId, listings);
  return { discovered: listings.length, timedOut };
}
