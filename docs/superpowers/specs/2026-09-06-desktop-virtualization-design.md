# Desktop Watchlist Table Virtualization — Design

Date: 2026-09-06. Scope: windowed rendering of the watchlist table
(approved: full virtualization over memoization-only).

## Problem

The grouped table renders every `<tr>` inside a `max-h-[60vh]`
scroll div with an unmemoized row renderer: large watchlists jank on
every keystroke/sort, and group-by multiplies row count. No
virtualizer installed; rows have variable heights (wrapping pills,
async images).

## Approach

Spacer-row virtualization in place with `@tanstack/react-virtual`
(same vendor as react-query, React 19 compatible, dynamic
measurement). Table, thead, logic, and row markup untouched.

## Data

- Flatten to row descriptors in a memo:
```ts
type Row = { kind: "header"; key: string; title: string; count: number }
  | { kind: "product"; product: Product };
```
  from `sections` (grouped) or `sorted` (off mode) — whichever the
  current render path uses.
- Always virtualized (no short-list fallback — the library handles
  small counts with negligible overhead and one code path beats
  two).

## Virtualizer

- `useVirtualizer({ count: rows.length, getScrollElement: () =>
  scrollRef.current, estimateSize: () => 76, overscan: 8 })` on the
  existing scroll div (which also drives the collapse effect —
  untouched).
- Dynamic heights via `measureElement` ref on each rendered row
  (tag-wrap + image loads); estimate 76px initial.
- Top/bottom spacers as `<tr aria-hidden="true">` with a single
  `<td colSpan={columnCount} style={{ height, padding: 0, border: 0 }}>`
  (same conditional span as headers). Sticky thead unchanged;
  columns stay driven by thead + visible rows.
- New dependency: `@tanstack/react-virtual` in `desktop/package.json`
  (+ lockfile).

## Render

- Header descriptors → existing header-row markup verbatim;
  product descriptors → existing `renderRow` verbatim.
- Empty states, footer totals, controls, selection, and all
  handlers unchanged (outside the scroll window or row-local).

## Testing

- Source-guard tests: virtualizer wiring (`useVirtualizer`,
  spacer rows, `measureElement`), flattened row list.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.
- Manual scroll verification noted (no desktop render harness to
  automate it).

## Non-goals

- Row content/height changes, sticky group headers, collapsing.
- Mobile changes.
