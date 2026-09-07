# Desktop Shared Filter Unification — Design

Date: 2026-09-06. Scope: replace the hand-rolled desktop filter
with `filterWatchlist`; sort model untouched (approved).

## Problem

Desktop `Watchlist.tsx` hand-rolls filtering while mobile uses the
shared `filterWatchlist` (`lib/watchlist-org.ts`): same query gives
different results (desktop matches name/model only; shared also
matches brand/category), and two predicate implementations can drift
(the tag-counts pre-filter already duplicated the memo once).

## Approach

Replace the filter body with the shared helper; keep the desktop
column-toggle sort exactly as decided (no `sortWatchlist`).

## Filtered memo

- `desktop/src/pages/Watchlist.tsx`: replace the 7-clause inline
  body with:
```tsx
filterWatchlist(products, {
  region: regionFilter,
  tagIds: selectedTagIds,
  tagMatchMode,
  status: filter as StatusFilter,
  query,
  priceRange,
  inStockOnly,
  displayCurrency,
})
```
  (extend the existing watchlist-org import with `filterWatchlist`
  and the `StatusFilter` type; the `as` cast is safe — desktop
  `FilterKey` is a subset lacking only `"unknown"`, and no pill
  produces it. Do NOT widen the pills.)
- Dep array mirrors the fields.
- Intended behavior changes: query gains brand/category matching;
  status becomes null-safe (`productStatus` vs `getDominantStatus`,
  same precedence). Everything else identical.

## Tag counts

- Replace the hand-rolled pre-filter + `countTagMatches` combo with
  the same shared predicate so list and counts can never disagree
  (read the current `tagCounts` memo first; minimal restructure —
  if it already delegates cleanly, only swap its pre-filter body).

## Untouched

- `sorted` memo, toggles, persistence, grouping, summary.
- `getDominantStatus` helper stays (still used by the row
  `StockBadge`).

## Testing

- Unit tests: brand/category query match on desktop path,
  null-listings safety, tag-count/list agreement.
- Source-guard: `filtered` memo delegates to `filterWatchlist`.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Sort unification, filter UI changes, mobile changes.
