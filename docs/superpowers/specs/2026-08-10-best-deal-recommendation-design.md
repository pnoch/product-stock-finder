# Best Deal Distributor Recommendation Design Spec

**Date:** 2026-08-10
**Status:** Approved
**Scope:** Add a "Best Deal" card to the Product Detail screen (mobile + desktop) that recommends the distributor with the lowest total landed cost (price + shipping to the user's region).

## Overview

Add a "Best Deal" card to the Product Detail screen that ranks in-stock distributors by total landed cost (price + shipping to the user's shipping region). A shared pure utility computes the recommendation so both platforms stay consistent. Shipping costs are added as static data per distributor, keyed by destination region.

## Architecture

### Data Model Change

Add `shippingCosts` to the `Distributor` type:

```typescript
interface Distributor {
  // ...existing fields
  shippingCosts?: Record<string, number>; // destination region → shipping cost in distributor's currency
}
```

Each distributor gets a map like `{ "Asia-Pacific": 15, "Europe": 25, "North America": 30 }`. The values are in the distributor's native currency (matching `price`).

### Shared Utility: `lib/best-deal.ts`

A platform-agnostic pure function consumed by both mobile and desktop Product Detail screens.

**Types:**
```typescript
export interface BestDeal {
  distributorId: string;
  price: number;    // converted to display currency
  shipping: number; // converted to display currency
  total: number;    // price + shipping
  currency: string;  // display currency
}
```

**Function:**
```typescript
export function findBestDeal(
  listings: DistributorListing[],
  destinationRegion: string,
  displayCurrency: string,
): BestDeal | null
```

**Behavior:**
- Filters to in-stock listings with valid `price > 0`
- For each, looks up the distributor's `shippingCosts[destinationRegion]` via `getDistributorById`
- Converts price + shipping to display currency via `convertPrice`
- Returns the listing with the lowest total landed cost
- Returns `null` if no in-stock listing, or no listing has shipping data for the region

### Setting

Add `shippingRegion` to `AppSettings` (default `"Asia-Pacific"`), user-selectable in Settings.

### Product Detail Card (mobile + desktop)

A "Best Deal" card showing:
- Recommended distributor name + flag
- Total landed cost (formatted in display currency)
- Price / shipping breakdown
- Recomputes when `shippingRegion` or `displayCurrency` changes
- Respects the active region filter (only considers listings in the filtered set)

## Data Flow

1. **Settings** — user selects their `shippingRegion` (default "Asia-Pacific"). Stored in `AppSettings`.
2. **Product Detail** — on load, read `shippingRegion` + `displayCurrency` from settings, call `findBestDeal(listings, shippingRegion, displayCurrency)`.
3. **Best Deal card** — shows the recommended distributor, total landed cost, and a price/shipping breakdown. Recomputes when the region or currency changes.
4. **Region filter** — the Best Deal card respects the active region filter (only considers listings in the filtered set).

## Error Handling

- No in-stock listings → card hidden (or shows "No in-stock distributors")
- Distributor missing `shippingCosts` for the destination region → that listing is skipped (can't compute shipping)
- Unknown currency → `convertPrice` defaults to rate 1 (existing behavior)
- Empty `shippingCosts` → listing skipped

## Testing

- Unit tests for `findBestDeal`:
  - Returns the lowest total landed cost (price + shipping)
  - Skips out-of-stock listings
  - Skips listings with no shipping data for the region
  - Converts price + shipping to display currency
  - Returns null with no in-stock listings
- Component tests for the Best Deal card (renders distributor, total, breakdown)

## Files

**New:**
- `lib/best-deal.ts` — shared best-deal utility
- `tests/best-deal.test.ts` — unit tests

**Modified:**
- `lib/types.ts` — add `shippingCosts` to `Distributor`, `shippingRegion` to `AppSettings`
- `lib/distributors.ts` — add `shippingCosts` to each distributor
- `lib/storage.ts` — add `shippingRegion` default to settings
- `app/(tabs)/settings.tsx` — add shipping region selector
- `app/product/[id].tsx` — add Best Deal card
- `desktop/src/pages/ProductDetail.tsx` — add Best Deal card
- `desktop/src/pages/Settings.tsx` — add shipping region selector
