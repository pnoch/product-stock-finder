# Desktop Navigation + Dead-Ends — Design

Date: 2026-09-06. Scope: actionable restock rows, sidebar
discovery, Rates refresh, best-price link (approved).

## Problem

1. Restock rows are inert (no product link) with silent load/remove
   failures and a button-less empty state — a restock alert leaves
   no next step.
2. `/restock-watches` and `/distributor-analysis` have no sidebar
   entry — undiscoverable via nav.
3. Rates says "Pull to refresh" (no pull gesture on desktop)
   despite owning a refresh function.
4. The Best-Price button is permanently disabled when not
   in-stock — except it also doubles as the loading spinner, so
   only the loaded out-of-stock/back-order case can change.

## Approach

Wire existing pieces; no new data layers. The loading-spinner use
of the disabled button is preserved.

## Actionable restock rows

- `desktop/src/pages/RestockWatches.tsx`: product name becomes a
  `Link` to `/product/{watch.productId}` (`productId` verified on
  `BackOrderReminder`).
- Load failure → error banner + Retry (established pattern);
  remove failure → error toast/message, watch stays in list.
- Empty state gains "Browse watchlist" CTA button → `/watchlist`
  (watches originate from product pages, so watchlist — not
  search — is the right next step).

## Sidebar entries

- `desktop/src/components/Sidebar.tsx`: add Restock Watches
  (`/restock-watches`) and Distributor Analysis
  (`/distributor-analysis`) entries with lucide icons (verify
  exports, e.g. bell-ring/building families — fall back to
  existing icon set style if unsure). Same NavLink
  styling/tooltip behavior.

## Rates refresh + best-price link

- Rates: replace "Pull to refresh" copy with a Refresh button
  wired to the existing `onRefresh` (keep the "base rates"
  explainer text, minus the pull reference).
- ProductDetail: ONLY the loaded out-of-stock/back-order branch
  becomes an `<a href={bestListing.url}>` (same URL pattern as
  row-level Visit links, `target="_blank" rel="noopener"`,
  keeping the icon + disabled-look classes? No — link styling
  matching Visit links; read both first). The
  `buyNowLoading || livePriceLoading` branch stays a disabled
  spinner button untouched.

## Testing

- Source-guard tests: product links, sidebar entries, refresh
  wiring, out-of-stock link vs loading spinner.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Reschedule/date editing, buy-flow changes, mobile changes.
