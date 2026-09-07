# Desktop Watchlist Group-By Headers — Design

Date: 2026-09-06. Scope: group-mode picker + section header rows in
the desktop watchlist table (approved).

## Problem

Desktop Watchlist renders one flat table. Mobile groups by tag /
status / region with section headers (`groupWatchlist` in
`lib/watchlist-org.ts`, persisted `watchlistGroup` key). Large
watchlists are hard to scan without grouping.

## Approach

Header rows in the single table (approved over separate tables:
sort, filters, totals, and row actions keep working untouched).

## State

- `groupMode: WatchlistGroup` (`"off" | "tag" | "status" |
  "region"` from `lib/types.ts`), default `"off"`.
- Picker beside the existing sort control, same styling (select
  with the four modes).
- Loaded from / persisted to `watchlistGroup` via settings, same
  pattern as the P2 persisted filters (load on mount with `?? "off"`,
  save effect).

## Render

- `sections = useMemo(() => groupWatchlist(filtered, groupMode,
  tagDefinitions), [...])` using the shared helper (first-tag
  dedupe, orphaned-id handling, empty-section filtering included).
  Tag definitions from the same source the desktop tag filter uses.
- `groupMode === "off"`: today's flat render byte-identical.
- Otherwise: per section, a header row
  (`<tr><td colSpan={columnCount}>`, muted uppercase title + count,
  mirroring mobile header copy) followed by that section's product
  rows in current sort order (existing row markup reused verbatim).
- Column count for `colSpan` derived from the table (read the thead
  first — do not hardcode a wrong span).

## Testing

- Source-guard tests: picker present, `groupWatchlist` used,
  `watchlistGroup` persistence wired.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Collapsible sections, drag-between-groups, per-section totals.
- Mobile code untouched.
