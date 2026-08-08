# Distributor Region Filter Design Spec

**Date:** 2026-08-06
**Status:** Approved
**Scope:** Add a distributor region filter to the Watchlist and Product Detail screens in both mobile (Expo) and desktop (Tauri) apps.

## Overview

Add region filter chips to the Watchlist and Product Detail screens. On the Watchlist, selecting a region shows only products that have at least one listing from a distributor in that region. On the Product Detail screen, selecting a region filters which distributor listings are shown for a single product. A shared pure utility keeps region-matching logic consistent across all four screens.

## Architecture

### Shared Utility: `lib/region-filter.ts`

A platform-agnostic module consumed by all four screens.

**Functions:**
```typescript
export function getAllRegions(): string[]
// Returns the distinct regions from DISTRIBUTORS (e.g. ["Africa", "Asia-Pacific", "Europe", "Middle East", "North America"])

export function productHasRegion(product: Product, region: string): boolean
// Returns true if any of the product's listings has a distributor in the given region

export function filterListingsByRegion(
  listings: DistributorListing[],
  region: string,
): DistributorListing[]
// Returns only the listings whose distributor is in the given region
```

**Behavior:**
- Uses `getDistributorById()` from `lib/distributors.ts` to map each listing's `distributorId` to its region
- Listing with unknown distributor (not found in `DISTRIBUTORS`) → excluded from all region filters
- `getAllRegions()` returns distinct, non-empty regions in a stable order

### Watchlist Screen (mobile + desktop)

- Add a region filter chip row below the sort bar: "All" + one chip per region
- Default selection: "All"
- When a region is selected, filter products via `productHasRegion(product, region)`
- The summary card recomputes from the filtered product list
- Empty filtered result → show empty state

### Product Detail Screen (mobile + desktop)

- Add a region filter chip row above the distributor listings: "All" + one chip per region
- Default selection: "All"
- When a region is selected, filter listings via `filterListingsByRegion(listings, region)`
- The best-distributor card and price history recompute from the filtered listings

## Data Flow

1. **Watchlist** — on mount, load watchlist + regions. When user taps a region chip, filter `watchlist` via `productHasRegion`. Recompute the summary card from the filtered list.
2. **Product Detail** — on mount, load product + regions. When user taps a region chip, filter `product.listings` via `filterListingsByRegion`. The best-distributor card and price history recompute from the filtered listings.

## Error Handling

- Empty region list → only "All" chip shown
- Product with no listings → hidden when a region is selected (no matching region)
- Listing with unknown distributor → excluded from all region filters
- Region not found → treated as no match

## Testing

- Unit tests for `getAllRegions`, `productHasRegion`, `filterListingsByRegion`
- Component tests for the filter chips (renders regions, filters correctly)

## Files

**New:**
- `lib/region-filter.ts` — shared region filter utility
- `tests/region-filter.test.ts` — unit tests

**Modified:**
- `app/(tabs)/watchlist.tsx` — add region filter chips
- `app/product/[id].tsx` — add region filter chips
- `desktop/src/pages/Watchlist.tsx` — add region filter chips
- `desktop/src/pages/ProductDetail.tsx` — add region filter chips
