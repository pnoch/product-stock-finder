# Desktop Parity — Fuzzy Search + Currency

**Date:** 2026-09-21
**Status:** Approved

## Problem

The desktop (Tauri) app has two parity gaps with mobile:

1. **SearchModal** uses hand-rolled substring matching (name, modelNumber, brand) instead of the Fuse.js fuzzy search now used on mobile
2. **Compare page** hardcodes `"USD"` in 5 `convertPrice()` calls instead of using the user's `displayCurrency` from settings

## Changes

### `desktop/src/components/SearchModal.tsx`

- Import `searchCatalog` from `../../../lib/catalog`
- Replace the inline `PRODUCT_CATALOG.filter(...)` (lines 29-37) with `searchCatalog(query)`
- The `PRODUCT_CATALOG` import is no longer needed (remove it)

### `desktop/src/pages/Compare.tsx`

- Add `useState` for `displayCurrency` (default `"USD"`)
- Load `displayCurrency` from `storage.getSettings()` in the existing `useEffect`
- Replace 5 hardcoded `"USD"` values in `convertPrice()` calls with `displayCurrency`:
  - Line 84: chart data conversion
  - Lines 112-113: sort-by-price
  - Lines 126-127: cheapest listing calculation

## What stays the same

- Desktop `MultiLineChart` uses `recharts` — no changes needed
- All other desktop pages (`Watchlist`, `ProductDetail`, `DistributorAnalysis`) already use `displayCurrency` from settings

## Testing

- `pnpm check` — 0 TypeScript errors
- `pnpm lint` — 0 errors
- `pnpm test` — all tests pass
