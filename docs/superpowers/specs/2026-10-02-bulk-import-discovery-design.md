# Bulk-Import Discovery + Repair — Design Spec

**Date:** 2026-10-02
**Goal:** Give bulk-imported products prices. Bulk import currently adds products with `listings: []`, so they show no price and have no way to recover. Add a capped, user-controlled eager discovery after bulk import, and a per-product "Find prices" repair CTA on both platforms.

## Decisions (from brainstorming)

- **Capped eager + repair CTA**: import stays fast; discover up to a small cap with continuation; every no-price product also has a repair action.
- **Batches of 3**, sequential, with an "Fetch prices for the remaining N?" prompt; the remainder is reachable via the repair CTA.
- **Repair CTA on Product Detail + Watchlist card**, mobile and desktop.
- Discovery reuses the existing best-effort pipeline (`discoverListings` → `rediscoverProduct`); **no server changes**.

## Shared module: `lib/bulk-discovery.ts`

A pure, testable batch runner over the existing `rediscoverProduct` (`lib/manual-add.ts:146`) and `DiscoverFn`/`RediscoverStorage` types:

```ts
export interface BulkDiscoveryItem { productId: string; modelNumber: string }

export async function runDiscoveryBatch(deps: {
  items: BulkDiscoveryItem[];
  startIndex: number;
  batchSize?: number;              // default 3
  storage: RediscoverStorage;      // { updateProductListings }
  discover: DiscoverFn;
  onProgress?: (done: number, total: number, modelNumber: string) => void;
  shouldCancel?: () => boolean;
}): Promise<{ nextIndex: number; discovered: number }>;
```

- Sequentially calls `rediscoverProduct` for `items[startIndex .. startIndex+batchSize)`.
- Returns `nextIndex = min(startIndex + attempted, items.length)` and the total listings found in the batch.
- Stops early (returning the current `nextIndex`) when `shouldCancel()` is true before the next item.
- Each item is independent; a failure/timeout inside `rediscoverProduct` never throws out of the batch.

## Bulk-import integration

`components/search/bulk-import-modal.tsx` (and the desktop bulk-import path): after the add loop completes, build `BulkDiscoveryItem[]` from the newly-added products (`productId = item.id`, `modelNumber = item.modelNumber`) and run the first batch of 3 with a progress line ("Finding prices 2/3 — CRS326…"). When `nextIndex < items.length`, show a confirm alert **"Fetch prices for the remaining N?"** and continue in 3-model batches on confirm; declining leaves them for the repair CTA. The import result alert still reports added/already-tracked/failed; discovered counts are appended ("prices found for X").

## Repair CTA

Shown whenever a product has `listings.length === 0`:

- **Product Detail** (mobile `app/product/[id].tsx`, desktop `desktop/src/pages/ProductDetail.tsx`): a "Find prices" button runs `rediscoverProduct` for that product with a progress indicator, reloads on completion, and reports "Found prices at N distributor(s)" or "No prices found at any distributor".
- **Watchlist card** (mobile card component, desktop `Watchlist.tsx`): a small "No prices — Find" badge that triggers the same per-product discovery for that card.

Both call the shared helper with `batchSize: 1` (or `rediscoverProduct` directly) so behavior matches the bulk path.

## Testing

- Unit (`tests/bulk-discovery.test.ts`): batch size default/override; sequential order; `nextIndex` continuation across calls; `shouldCancel` stops early; a throwing/timeout `discover` is absorbed; progress callback values; zero-hit result.
- Source guards (`tests/bulk-discovery-ui.test.ts`): the bulk modal invokes the batch runner and the repair CTA exists on mobile Product Detail + Watchlist and desktop ProductDetail + Watchlist.
- Manual verification documented (import a 7-model paste → first 3 discovered, prompt for remaining 4; a no-price card → Find prices).

## Out of scope

- Background/persisted discovery queue; server-side discovery; changing single-add or manual-add paths; automatic refresh cadence.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/bulk-discovery.ts` | new: batch runner |
| `components/search/bulk-import-modal.tsx` | + post-import discovery (mobile) |
| `app/product/[id].tsx` | + Find prices CTA |
| `components/watchlist/product-card.tsx` | + no-prices badge/CTA |
| `desktop/src/pages/Search.tsx` (+ `desktop/src/components/SearchModal.tsx`) | + post-import discovery |
| `desktop/src/pages/ProductDetail.tsx` | + Find prices CTA |
| `desktop/src/pages/Watchlist.tsx` | + no-prices CTA |
| `tests/bulk-discovery.test.ts`, `tests/bulk-discovery-ui.test.ts` | new |
| `todo.md` | append phase entry |
