# Desktop Shared Page Upgrades — Design

Date: 2026-09-06. Scope: retry, display currency, per-item add,
CSV export on the shared watchlist page (approved).

## Problem

Desktop `SharedWatchlist.tsx` shows first-listing price in the
listing's own currency, has no retry on fetch failure, no per-item
add, and no export — mobile `w/[token]` has bulk add, CSV export,
and per-product history export.

## Approach

Reuse proven pieces (same query object, same normalize/add path,
mobile's web CSV download verbatim). Per-item add exceeds mobile —
justified by the existing per-item bulk results.

## Retry

- Error state gains Retry button calling the query's `refetch()`
  (same `useQuery` result already in the file) beside the existing
  Back link. Loading state while refetching.

## Display currency

- Load `displayCurrency` from `storage.getSettings()` on mount
  (USD fallback while loading), like other desktop pages.
- Row best price: `getBestPrice(listings, displayCurrency)` instead
  of first-listing currency. Distributor name + StockBadge stay on
  the first listing (unchanged).

## Per-item add

- Per-card "Add" button: same `normalizeSharedWatchlistProduct` +
  `storage.addToWatchlist` path as bulk-add (extract shared helper
  in-file to avoid duplication); per-item toasts ("Added X" /
  "Couldn't add X").
- Track added ids in a `Set<string>` state → added cards show
  "Added ✓" disabled state.

## Export CSV

- "Export CSV" button beside Add-all: `watchlistToDetailedCsv`
  over shared products (`lib/csv.ts`, pure, desktop-safe),
  Blob + anchor download as `shared-{token}.csv`
  (mobile's web path verbatim).

## Testing

- Source-guard tests: retry via `refetch`, display-currency best
  price, per-item add path, CSV export via `watchlistToDetailedCsv`.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Per-product history CSV (no history UI on desktop cards).
- Mobile/server changes.
