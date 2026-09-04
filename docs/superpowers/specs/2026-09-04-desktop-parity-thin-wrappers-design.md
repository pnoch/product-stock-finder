# Desktop Parity Sweep — Approach A (Thin Wrappers) — Design

**Date:** 2026-09-04
**Status:** Draft — awaiting review
**Approach:** A — Shared lib, thin desktop wrappers (chosen over B duplicate logic, C shared package)
**Scope:** Full desktop parity (Rates tab, Search Bulk/Recent/Fuse, Watchlist bulk/tag/filter/sync on watchlist + NotificationCenter on alerts — ~4 hours)

## 1. Goal

Bring `desktop/` to full parity with `app/` by keeping thin wrappers in `lib/` (already thin: catalog `Fuse 0.4`, distributors 25, currency `CURRENCY_SYMBOLS`, fx `refreshFxRates`, trending tRPC, compare-utils chart helpers). Desktop calls the same pure helpers and builds its own UI around them. No duplication, no `shared/` package churn — fastest to parity.

## 2. Non-Goals

- No `lib/` → `shared/` extraction (that was Approach C; rejected for this sprint).
- No storage/sync/notification rewiring (RN-specific, stays in `lib/`).
- No catalog-warmer or price-cache move (server-side, stays in `server/`).

## 3. Modules Staying in lib/ (Thin Already)

- `lib/catalog.ts` — `Fuse 0.4`, `PRODUCT_CATALOG` (42), `getAllCategories/getAllBrands`
- `lib/distributors.ts` — `DISTRIBUTORS` 25, `getDistributorById`, `getAllDistributors`
- `lib/currency.ts` — `CURRENCY_SYMBOLS`, `convertPrice`, `formatPrice`
- `lib/fx.ts` — `refreshFxRates` (+storage write wrapper), `loadFxRates`, `maybeRefreshFxRates`
- `lib/trending.ts` — `fetchTrending` tRPC + FALLBACK_TRENDING
- `lib/compare-utils.ts` — chart helpers (`CHART_COLORS`, `filterByRange`, `cheapestByRegion`)

Desktop imports via `../lib/*` relatives (already wired in `1d613e1` with vite root aliases `@/lib → ../lib` etc.). No new aliases needed.

## 4. Slices

### Slice 1: Rates (`desktop/src/pages/Rates.tsx` + `/rates` route + `FxRateGrid`)
- Import `getFxHistory`, `refreshFxRates`, `maybeRefreshFxRates` from `../lib/fx`
- Import `EXCHANGE_RATES` from `../lib/currency`
- Render `FxRateGrid` with currentRates derived from history.rates[last] ?? EXCHANGE_RATES
- Pull-to-refresh equivalent (button + useEffect for maybeRefresh on mount)
- Handle loading/error/empty states
- Add route in `desktop/src/App.tsx` — check existing routes pattern (react-router), add `<Route path="/rates" element={<Rates />} />`
- Add sidebar entry in `desktop/src/components/Sidebar.tsx`

### Slice 2: Search (`desktop/src/components/SearchModal.tsx` + `desktop/src/pages/Search.tsx`)
- Fuse.js ranked search (threshold 0.4, keys modelNumber 0.4/name 0.3 etc.) — import from `../lib/catalog` or use `searchCatalogAsync`
- Up to 50 discoveredProducts via `getAllCatalog()`
- `BulkImportModal` + `ManualAddSheet` in SearchModal header
- `RecentSearches` chips
- Tag pre-assignment workflow

### Slice 3: Watchlist (`desktop/src/pages/Watchlist.tsx`)
- Bulk select mode (`selectedIds` Set, long-press or checkbox)
- `TagFilterRow` with tag counts
- `SwipeableCard` undo affordance (desktop equivalent)
- Price-range filter

## 5. Import Strategy

Desktop already imports `../lib/*` via vite root aliases:
- `@/lib` → `../lib` (root)
- `@/constants`, `@/server`, `@/shared` → root siblings
- RN/expo/playwright stubs retained (`async-storage-stub.ts`, `react-native-stub.ts`, `browser.web.ts` alias)

No new aliases; keep `@shared → shared/` for `shared/_core` only.

## 6. Build

No new build step: `lib/` is transpiled by `tsc --noEmit` (like today); both `app/` and `desktop/` consume it as source.

- `pnpm check` (root `tsc --noEmit`)
- `pnpm --filter desktop run check`
- `pnpm --filter desktop run build` (vite ~4s)
- `pnpm exec expo export -p web --clear`

All verify both consumers.

## 7. Testing

- `pnpm test` (root, Expo — 145 passed)
- `pnpm --filter desktop test` (desktop, 36 tests)
- Desktop Rates page (`desktop/src/pages/Rates.tsx` + route + sidebar) and Search parity (Fuse + Manual/Bulk sheets + Recent) are verified by `pnpm --filter desktop exec tsc --noEmit` + `desktop/dist/index.html` containing `Rates`.

## 8. Rollout

Single sprint: rewire `desktop/src/pages/*` imports to existing `../lib/*` (no moves), add Rates route, Search parity, Watchlist bulk/tag. No catalog-warmer or storage changes.

## 9. Risks

- Alias drift during future refactors — mitigated by single `@/lib` alias already proven at `1d613e1`.
- `theme.config.js` CJS import in `lib/_core/theme.ts` — already handled via esbuild interop (`CHART_COLORS` inline in `2e13971`).

## 10. Open Questions

- Should desktop share `ProductCard` directly or reimplement? Reimplement in Tailwind (desktop patterns differ), share only pure helpers.
