# Desktop Watchlist Table Accessibility — Design

Date: 2026-09-06. Scope: ARIA position, sort, trend, and toggle
states on the watchlist table (approved).

## Problem

Virtualization removed positional context for screen readers (only
a window of rows exists in the DOM); sort buttons expose no state;
trend icons are unlabeled images; filter toggles expose no pressed
state.

## Approach

Attribute-level additions in `desktop/src/pages/Watchlist.tsx`
only. No visual or structural changes.

## Virtual position

- `<table aria-rowcount={rows.length}>` (descriptor count, headers
  included — uniform with indexing below).
- Every rendered `<tr>` gets `aria-rowindex={vr.index + 1}`:
  header rows directly; product rows via the existing `virtual`
  measurement prop on `renderRow` (extend it with the index it
  already receives as `data-index` — single source, no new
  plumbing).

## Sort state

- The 4 sortable `<th>`s (Name/Price/Trend/Last Updated):
  `aria-sort={sortKey === key ? (sortAsc ? "ascending" :
  "descending") : "none"}`. Existing `aria-label`s unchanged.
  Non-sortable headers get nothing.

## Trend icons

- The icon `<span>` gains `role="img"` +
  `aria-label={\`Trend ${trend}\`}` ("Trend up"/"Trend down"/"Trend
  flat").

## Filter toggles

- Status pills, region selector, and in-stock toggle gain
  `aria-pressed` reflecting active state (read each control first;
  apply only where the control is a toggle — skip pure navigation
  or select-dropdown elements, which have their own semantics).

## Testing

- Source-guard tests: `aria-rowcount`, `aria-rowindex`,
  `aria-sort`, trend `role="img"`, `aria-pressed` on toggles.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.
- Screen-reader behavior itself is not automatable (no harness) —
  noted explicitly.

## Non-goals

- Visual changes, keyboard-navigation rework, row content changes.
- Mobile changes.
