# Watchlist Summary Card Design Spec

**Date:** 2026-08-06
**Status:** Approved
**Scope:** Add a summary card to the Watchlist screen in both mobile (Expo) and desktop (Tauri) apps, showing total watchlist value (converted to display currency) and stock status counts.

## Overview

Add a summary card at the top of the Watchlist screen showing the total value of all listings (converted to the display currency) plus counts of in-stock / back-order / out-of-stock listings. A shared pure utility computes the summary so both platforms stay consistent.

## Architecture

### Shared Utility: `lib/watchlist-summary.ts`

A platform-agnostic pure function consumed by both mobile and desktop Watchlist screens.

**Types:**
```typescript
export interface WatchlistSummary {
  totalValue: number; // sum of ALL listings' prices, converted to display currency
  listingCount: number; // total number of listings
  inStock: number; // count of in_stock listings
  backOrder: number; // count of back_order listings
  outOfStock: number; // count of out_of_stock listings
}
```

**Function:**
```typescript
export function computeWatchlistSummary(
  watchlist: Product[],
  displayCurrency: string,
): WatchlistSummary
```

**Behavior:**
- Iterates all `Product.listings` across the watchlist
- For each listing with a valid `price > 0` and a `currency`, converts to `displayCurrency` via `convertPrice()` and adds to `totalValue`
- Counts each listing into `inStock` / `backOrder` / `outOfStock` based on `stockStatus`
- Listings with missing price, missing currency, or unknown stock status are skipped from the relevant buckets
- Empty watchlist → all zeros

### Summary Card UI

**Mobile:** A card component at the top of `app/(tabs)/watchlist.tsx`, placed below the header and above the sort bar. Shows:
- Total value (formatted via `formatPrice(totalValue, displayCurrency)`)
- Listing count
- In-stock / back-order / out-of-stock counts with colored badges

**Desktop:** A card component at the top of `desktop/src/pages/Watchlist.tsx`, same layout.

## Data Flow

1. **On watchlist load** — after `getWatchlist()` returns products, call `computeWatchlistSummary(watchlist, settings.displayCurrency)`
2. **On display currency change** — recompute (summary depends on `displayCurrency` from settings)
3. **After Check Now / refresh** — recompute with fresh prices
4. **Render** — summary card shows `totalValue`, `listingCount`, and the three stock counts

## Error Handling

- Empty watchlist → card shows zeros
- Listing missing `price` or `currency` → skipped from total
- Unknown stock status → not counted in any stock bucket
- Currency not in `EXCHANGE_RATES` → `convertPrice` defaults to rate 1 (existing behavior)

## Testing

- Unit tests for `computeWatchlistSummary`:
  - Sums all listings converted to display currency
  - Counts in-stock / back-order / out-of-stock correctly
  - Skips listings with missing price/currency
  - Empty watchlist → zeros
  - Mixed currencies convert correctly
- Component tests for the summary card (renders total and counts)

## Files

**New:**
- `lib/watchlist-summary.ts` — shared summary utility
- `tests/watchlist-summary.test.ts` — unit tests

**Modified:**
- `app/(tabs)/watchlist.tsx` — add summary card
- `desktop/src/pages/Watchlist.tsx` — add summary card
