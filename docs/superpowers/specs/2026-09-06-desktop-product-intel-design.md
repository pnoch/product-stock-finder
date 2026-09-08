# Desktop Product Intelligence — Design

Date: 2026-09-06. Scope: price-vs-average card, per-listing
history links, product refresh on desktop detail (approved).

## Problem

Desktop ProductDetail can't answer "is this a good deal", offers
no per-listing history without leaving context, and loads once —
stale prices have no in-place recourse (mobile has all three).

## Approach

Mirror mobile logic with desktop UI. No new data layers.

## Price-vs-average card

- `desktop/src/pages/ProductDetail.tsx`:
  `computePriceVsAverage(listings, displayCurrency)` from
  `lib/price-average.ts` (imports verified desktop-safe) in a
  memo; render card when non-null — current best vs 30-day
  average + verdict chip (Below emerald / At gray / Above red,
  same copy as mobile `PriceVsAvgCard`), hidden when null like
  mobile.

## Per-listing history links

- Distributor rows gain a Chart icon-link to
  `/compare/{productId}` beside Watch/Bell/Visit (same destination
  mobile navigates to; no modal, no preselect). Icon: chart-line
  family already in use (verify export, else reuse an existing
  imported icon).

## Product refresh

- Header Refresh button re-running existing `loadProduct` with
  spinner state while loading; "Updated X ago" label from a new
  `lastRefreshedAt` state stamped on successful load completion
  (via existing `formatLastRefreshed`).
- Failures use the existing error block (mobile's "server
  unreachable" equivalent already exists).

## Testing

- Source-guard tests: vs-average card, chart links, refresh
  control with updated label.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Compare distributor preselect param, live-price streaming.
- Mobile changes.
