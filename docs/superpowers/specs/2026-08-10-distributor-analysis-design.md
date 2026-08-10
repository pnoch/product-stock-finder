# Cross-Product Distributor Analysis Design Spec

**Date:** 2026-08-10
**Status:** Approved
**Scope:** Add a dedicated Distributor Analysis screen to both mobile (Expo) and desktop (Tauri) apps, showing per-distributor coverage, total cost, and average price across the user's watchlist.

## Overview

Add a Distributor Analysis screen that shows, for each distributor, how many watchlist products it carries (coverage), its total cost across those products (in display currency), and its average price. This helps users see which distributor is cheapest overall for their watchlist. A shared pure utility computes the analysis so both platforms stay consistent.

## Architecture

### Shared Utility: `lib/distributor-analysis.ts`

A platform-agnostic pure function consumed by both mobile and desktop analysis screens.

**Types:**
```typescript
export interface DistributorAnalysis {
  distributorId: string;
  coverage: number;    // number of watchlist products this distributor carries (in-stock)
  totalCost: number;   // sum of best in-stock price per product, converted to display currency
  averagePrice: number; // totalCost / coverage
}
```

**Function:**
```typescript
export function analyzeDistributors(
  watchlist: Product[],
  displayCurrency: string,
): DistributorAnalysis[]
```

**Behavior:**
- For each distributor in `DISTRIBUTORS`, iterate all watchlist products
- For each product, find its best in-stock price via `getBestPrice(product.listings, displayCurrency)`
- If the distributor has an in-stock listing for that product, add the product's best in-stock price to that distributor's total and increment its coverage
- Compute average as `totalCost / coverage` (0 if coverage is 0)
- Return sorted by total cost (ascending, cheapest first)
- Distributors with no in-stock listings across the watchlist are excluded

Note: A distributor's `totalCost` is the sum of each product's **best in-stock price** (not the distributor's own price for that product). This represents the total cost if you bought each product at its best available price from that distributor. This keeps the metric consistent across distributors regardless of which distributor actually has the lowest price per product.

### Dedicated Screen (mobile + desktop)

A Distributor Analysis screen that:
- Lists each distributor with: flag + name, coverage count, total cost, average price
- Sorted by total cost (cheapest first)
- Accessible from the Watchlist screen

## Data Flow

1. **Watchlist** — add a "Distributor Analysis" navigation entry
2. **Analysis screen** — on mount, load watchlist + display currency from settings, call `analyzeDistributors(watchlist, displayCurrency)`
3. **Render** — list each distributor with flag/name, coverage count, total cost, average price, sorted by total cost
4. **Recompute** — when display currency changes

## Error Handling

- Empty watchlist → empty state ("Add products to see distributor analysis")
- Distributor with no in-stock listings → excluded (no cost to analyze)
- Unknown currency → `convertPrice` defaults to rate 1 (existing behavior)
- Coverage of 0 → average is 0 (avoid division by zero)

## Testing

- Unit tests for `analyzeDistributors`:
  - Computes coverage, total, and average correctly
  - Converts to display currency
  - Sorts by total cost
  - Excludes distributors with no in-stock listings
  - Empty watchlist → empty array
- Component tests for the analysis screen (renders distributors, metrics)

## Files

**New:**
- `lib/distributor-analysis.ts` — shared analysis utility
- `tests/distributor-analysis.test.ts` — unit tests
- `app/distributor-analysis.tsx` — mobile screen
- `desktop/src/pages/DistributorAnalysis.tsx` — desktop screen

**Modified:**
- `app/(tabs)/watchlist.tsx` — add navigation entry
- `desktop/src/pages/Watchlist.tsx` — add navigation link
- `desktop/src/App.tsx` — add route
