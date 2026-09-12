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
  await storage.addToWatchlist({
    ...input,
    isWatched: true,
    addedAt: new Date().toISOString(),
    listings: [],
  });
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
