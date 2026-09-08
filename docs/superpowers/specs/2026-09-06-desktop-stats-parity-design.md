# Desktop Stats Parity — Design

Date: 2026-09-06. Scope: digest/insights/calendar cards, movers
switcher, slice disclosure on desktop Stats (approved).

## Problem

Desktop Stats renders 4 summaries; mobile has 7 cards (Digest,
Insights, DropCalendar + Movers, Basket, StockHealth, Freshness).
Movers window is frozen at 30 (mobile switches 7/30), and chart
data silently truncates to 3 products.

## Approach

Tailwind ports reusing the mobile compute functions (all verified
desktop-safe: types + live currency only). No new data layers.

## Digest card

- `computeDigest(previous, watchlist, settings, alerts)` from
  `lib/price-digest.ts`, mirroring mobile's snapshot flow
  (`app/stats.tsx:74-82`): load previous via
  `storage.getPriceDigestSnapshot()`, compute, save new snapshot.
  Render summary counts + top drop/rise rows in a desktop card.

## Insights card

- `computeProductInsights(watchlist, displayCurrency)` from
  `lib/product-insights.ts`: render all-time-low count, dropping
  count, volatility highlights list.

## Drop calendar

- `computeDropCalendar(watchlist, displayCurrency, 30)` from
  `lib/drop-calendar.ts`: Tailwind month grid (7-col), day cells
  showing drop counts with title tooltips (date + biggest drop %),
  total-drops header.

## Movers switcher + slice disclosure

- 7/30/90 segmented control wired to existing `setDays` (the
  `days === 90 → null` compute path already exists).
- Caption above the chart block: "Top 3 of N by value" (N =
  watchlist length) when truncated.

## Testing

- Source-guard tests: three cards + switcher + caption present
  with the compute-function wirings.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- PNG export of new cards, snapshot-frequency settings, mobile
  changes.
