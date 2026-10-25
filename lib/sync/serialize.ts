import type { Collection, Product, SyncItem } from "@/lib/types";
import {
  PRICE_HISTORY_SYNC_DAYS,
  SYNC_PUSH_ITEM_MAX_BYTES,
  SYNC_PUSH_MAX_BYTES,
  SYNC_PUSH_MAX_ITEMS,
} from "@/shared/const";

export function itemBytes(data: unknown): number {
  try {
    return JSON.stringify(data ?? null).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

// The server rejects a push over either SYNC_PUSH_MAX_ITEMS or
// SYNC_PUSH_MAX_BYTES outright, and a rejected push is retried with the same
// dirty items forever. Batch on both: count alone lets 200 history-heavy
// watchlist items exceed the byte cap.
export function batchSyncItems(items: SyncItem[]): SyncItem[][] {
  const batches: SyncItem[][] = [];
  let current: SyncItem[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = itemBytes(item.data);
    if (
      current.length > 0 &&
      (current.length >= SYNC_PUSH_MAX_ITEMS ||
        bytes + size > SYNC_PUSH_MAX_BYTES)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

// History dominates a watchlist item's size (25 listings × up to 30 days of
// points), and one item over SYNC_PUSH_ITEM_MAX_BYTES rejects the whole push
// forever. Trim the pushed copy (never the local one) until it fits.
const SYNC_HISTORY_FALLBACK_POINTS = [20, 10, 5, 2, 1, 0] as const;

export function serializeItem(collection: Collection, item: unknown): unknown {
  if (collection !== "watchlist") return item;
  const product = item as Product;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - PRICE_HISTORY_SYNC_DAYS);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  // Defensive `?? []`: a corrupt/legacy stored product can lack `listings` (or
  // a listing can lack `priceHistory`), and a throw here aborts the whole sync
  // (not just this item) since collectDirty is not per-item guarded.
  const withHistory = (maxPointsPerListing: number | null) => ({
    ...product,
    listings: (product.listings ?? []).map((l) => {
      const withinWindow = (l.priceHistory ?? [])
        .filter((p) => p.date.slice(0, 10) >= cutoffDay)
        // Sort by parsed time so the `slice(-N)` byte-cap fallback below keeps
        // the newest points: a history restored from a backup is not guaranteed
        // ascending, and on a descending array it kept the OLDEST.
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      return {
        distributorId: l.distributorId,
        productId: l.productId,
        price: l.price,
        currency: l.currency,
        stockStatus: l.stockStatus,
        expectedDate: l.expectedDate,
        url: l.url,
        lastChecked: l.lastChecked,
        taxRate: l.taxRate,
        priceHistory:
          maxPointsPerListing === null
            ? withinWindow
            : maxPointsPerListing === 0
              ? []
              : withinWindow.slice(-maxPointsPerListing),
      };
    }),
  });
  let serialized = withHistory(null);
  if (itemBytes(serialized) < SYNC_PUSH_ITEM_MAX_BYTES) return serialized;
  for (const keep of SYNC_HISTORY_FALLBACK_POINTS) {
    serialized = withHistory(keep);
    if (itemBytes(serialized) < SYNC_PUSH_ITEM_MAX_BYTES) break;
  }
  return serialized;
}

/**
 * Shape-checks a pulled item before it is written to the local store. The
 * server accepts `data` as arbitrary JSON (forward compatibility), so a buggy or
 * malicious client can push a malformed product/alert/reminder that would then
 * render on every device — and the local store is the source of truth, so it
 * persists. Returns null when the item cannot be salvaged.
 */
export function sanitizePulledItem(
  collection: Collection,
  data: unknown,
): unknown | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  // Settings is a single row keyed by the collection, not by an item id.
  if (collection === "settings") return data;
  const id = typeof record.id === "string" ? record.id : "";
  if (!id) return null;
  if (collection === "watchlist") {
    // The share normalizer is NOT reused here: it rebuilds the product without
    // `tagsUpdatedAt`, which the tag-LWW merge needs. Validate the core shape
    // and the listings array instead, preserving every other field verbatim.
    if (typeof record.name !== "string" || !record.name.trim()) return null;
    if (record.listings === undefined) return data;
    if (!Array.isArray(record.listings)) return null;
    // A malformed array (`[null]`) used to pass this check and then throw in
    // the apply merge, which wedged the whole pull cursor. Drop unusable
    // entries instead of rejecting the product.
    const listings = record.listings.filter(
      (l): l is Record<string, unknown> =>
        !!l &&
        typeof l === "object" &&
        typeof (l as { distributorId?: unknown }).distributorId === "string",
    );
    return { ...record, listings };
  }
  if (collection === "alerts") {
    if (typeof record.targetPrice !== "number" || !Number.isFinite(record.targetPrice)) {
      return null;
    }
    return data;
  }
  if (collection === "reminders") {
    if (typeof record.reminderDate !== "string") return null;
    return data;
  }
  // settings: a single row merged field-by-field below; a non-object is dropped.
  return data;
}

