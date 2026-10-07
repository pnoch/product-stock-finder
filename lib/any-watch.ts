import type { BackOrderReminder, DistributorListing } from "./types";

export interface AnyWatchDeps {
  /** Whether an any-watch ("*") already exists for this product. */
  isWatching: boolean;
  productId: string;
  productName: string;
  listings: DistributorListing[];
  addStockWatch: (watch: BackOrderReminder) => Promise<void>;
  /** Remove the existing any-watch (cancel its notification first). */
  removeAnyWatch: () => Promise<void>;
}

/**
 * Create or remove the product-level "any distributor" restock watch. Returns
 * which action was taken. The caller supplies the storage operations so the
 * decision is testable without a screen.
 */
export async function toggleAnyWatchRecord(
  deps: AnyWatchDeps,
): Promise<"created" | "removed"> {
  if (deps.isWatching) {
    await deps.removeAnyWatch();
    return "removed";
  }
  await deps.addStockWatch({
    id: `${deps.productId}-any`,
    productId: deps.productId,
    productName: deps.productName,
    distributorId: "*",
    distributorName: "Any distributor",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    reminderType: "back_in_stock",
    scope: "any",
    lastKnownStatusByDistributor: Object.fromEntries(
      deps.listings.map((l) => [l.distributorId, l.stockStatus]),
    ),
  });
  return "created";
}
