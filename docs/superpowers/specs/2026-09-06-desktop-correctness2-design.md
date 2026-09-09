# Desktop Correctness Follow-Ups 2 — Design

Date: 2026-09-06. Scope: per-row compare focus, honest product
refresh, first-load errors, digest helper (approved).

## Problem

1. Every distributor row links to the same compare page with
   identical labels — no per-row value.
2. ProductDetail Refresh re-reads storage but stamps "Updated X
   ago"; dead `buyNowLoading` state.
3. First-load storage failure shows empty instead of error.
4. Digest off-branch duplicates snapshot-building logic inline.

## Approach

Reuse proven pieces (Compare selector state, Watchlist refresh
constants/merge, shared helpers). No server changes.

## Per-row compare focus

- ProductDetail rows link to
  `/compare/{productId}?distributor={distributorId}` with
  `aria-label="View {distributor} price history"`.
- `desktop/src/pages/Compare.tsx`: initialize `selected` from the
  `distributor` search param (single preselected series; invalid
  ids ignored).

## Honest refresh

- ProductDetail Refresh: fetch live prices per listing via tRPC
  `prices.get` (concurrency 3, 20s timeout — same constants as the
  Watchlist helper, duplicated locally, not extracted), merge with
  `composeLiveListings`, persist via `storage.updateProductListings`,
  stamp `lastRefreshedAt` only on success (any fresh snapshot).
- Remove dead `buyNowLoading` state and its branches.
- Failures use the existing error block; spinner while fetching.

## First-load errors

- Watchlist: explicit probe-outcome tracking — failure before any
  success sets `listError` (banner + Retry); success clears it.
  Filter-empty stays distinct (banner only when the unfiltered
  list failed/empty, never on filter mismatch).

## Digest helper

- New pure `buildDigestSnapshot(products, displayCurrency)` in
  `lib/price-digest.ts` returning the snapshot object; desktop
  off-branch uses it; save failure dev-logged (gated logger).
  Mobile keeps its inline version (no behavior-change risk).

## Testing

- Unit tests for the snapshot helper; guards (distributor param,
  live refresh path, first-load banner).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Mobile adoption of the helper, compare preselect beyond
  single-series init, server changes.
