# Design: Multi-Tag Filtering — v5.4

Date: 2026-08-19
Status: Proposed

## Problem

Phase 54 added per-product colored tags and a tag chip row on the watchlist
screen with OR semantics (`matchesTagFilter` uses `some()`). Phase 55 added the
watchlist-org filter pipeline (`filterWatchlist`) which reuses that OR-only
matching. Two gaps remain:

1. **No AND semantics** — a user cannot narrow to products that carry *every*
   selected tag (e.g. "CoreRouter" AND "InStock"). Only "any of" is possible.
2. **No counts and no way to assign tags while adding products** — chips show
   no product counts, there is no clear-all affordance, and the Add Product
   (search) screen has no tag filtering or tag assignment at all.

## Approach

Extend the existing, already-tested filter pipeline in `lib/watchlist-org.ts`
with a `tagMatchMode` ("any" | "all") and a dynamic per-tag count helper. Extract
the watchlist's inline tag chip row into a shared `components/tag-filter-row.tsx`
component (chips + counts + inline Any/All toggle + clear-all) reused by both the
watchlist screen and the Add Product screen. Add tag assignment to the Add
Product screen: a tag icon per result row (pending tags applied on add) plus a
post-add tag sheet that opens only when pending tags exist.

No backend or schema changes — tags already sync via the `settings` and
`watchlist` collections. All new logic is pure functions with unit tests.

## Changes

### 1. Logic layer

**`lib/watchlist-org.ts`**

- Add `tagMatchMode: "any" | "all"` to `WatchlistFilters`.
- `filterWatchlist` applies tag matching per mode:
  - `"any"` — current OR behavior (product has at least one selected tag).
  - `"all"` — product has every selected tag id.
- New pure helper `countTagMatches(products, filters)` returning
  `Record<tagId, number>` for **dynamic counts**: for each tag id, count
  products that pass the region + status + query filters (tag selection
  ignored) and carry that tag. This shows "what you'd get if you tapped it".

**`lib/tags.ts`**

- Add `matchesTagFilterMode(product, selectedTagIds, mode)` implementing OR/AND.
- Keep `matchesTagFilter` as a thin `"any"`-mode wrapper (existing callers).

### 2. Shared component (`components/tag-filter-row.tsx`, new)

Props:

```ts
interface Props {
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  counts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeMode: (mode: "any" | "all") => void;
  onClearAll: () => void;
}
```

Renders:

- The chip row (color dot + tag name + count), same visual style as the current
  watchlist chip row.
- An inline **Any / All** segmented control, right-aligned, visible only when
  ≥2 tags are selected.
- A **Clear** affordance (an `×` / "Clear all") when any tag is selected.
- Empty `tagDefinitions` → renders nothing.

Behavior:

- Tapping a chip toggles it. Tapping a segment switches mode.
- Removing the last selected tag hides the mode control; the mode value persists
  so re-selecting 2 tags restores it.
- Counts are dynamic (respect region/status/query, ignore tag selection).

### 3. Watchlist screen (`app/(tabs)/watchlist.tsx`)

- Add `const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any")`.
- Pass `tagMatchMode` into the `filterWatchlist` call.
- Replace the inline chip row (lines ~1059-1100) with `<TagFilterRow>`.
- Compute `counts` via `countTagMatches(watchlist, { region, status, query,
  tagIds: [] })` in a `useMemo`.
- Keep `toggleTagFilter`, summary card, sort, group, search, and bulk-selection
  logic unchanged.

### 4. Add Product screen (`app/search.tsx`)

**4a. Tag filter row**

- Load `tagDefinitions` from storage on mount.
- Add `selectedTagIds` + `tagMatchMode` state (default `"any"`).
- Render `<TagFilterRow>` above the results list when `tagDefinitions` is
  non-empty.
- Filter results: catalog products carry no tags, so tag filtering surfaces
  only products already in the watchlist carrying the selected tag(s). Combined
  with the text query (AND).
- Counts: `countTagMatches` over the watchlist with the current text query
  applied (region/status not applicable here) — the number of watchlist
  products carrying each tag.
- Empty-state hint when tag filters exclude everything: "No products match
  these tags."

**4b. Tag assignment**

- Each result row gets a small tag icon button (left of the `+`).
- Tapping the tag icon opens `TagPickerSheet` for that catalog item. Since
  catalog items aren't in storage, tag selections are held in local state
  (`pendingTags: Record<productId, string[]>`).
- On `addToWatchlist` success: apply pending tags to the added product, then
  open `TagPickerSheet` for the newly added product **only if pending tags
  exist** (quick adds stay one tap). "Done" dismisses.
- `TagPickerSheet` gains an optional `onApply` mode so it can operate on a
  product not yet in storage (no `setProductTags` call) — used for the row-icon
  flow; the post-add flow uses the existing storage-backed path.

## Error Handling

- Tag filter row renders nothing when no tag definitions exist (both screens).
- If `countTagMatches` or the AND filter receives a stale/orphaned tag id, it is
  silently ignored (existing orphan-tag convention).
- Pending tags that reference a deleted tag definition are dropped on apply.

## Testing

- `lib/watchlist-org.ts`: extend `tests/watchlist-org.test.ts` with AND-mode
  filter cases and `countTagMatches` cases (static fixtures, no DB).
- `lib/tags.ts`: extend `tests/tags.test.ts` (if present) or add cases for
  `matchesTagFilterMode` OR/AND.
- `components/tag-filter-row.tsx`: render smoke test (visible chips, counts,
  Any/All visibility rule, clear-all).
- `app/search.tsx`: tag filter + pending-tag assignment covered via the existing
  component test patterns where feasible; otherwise manual/browser verification.
- Browser smoke test (headed Chromium, DB-backed server) covering: Any/All
  toggle on watchlist, dynamic counts, search-screen tag filter, row-icon tag
  assignment, post-add sheet.

## Files

- Modify: `lib/watchlist-org.ts`, `lib/tags.ts`,
  `app/(tabs)/watchlist.tsx`, `app/search.tsx`,
  `components/tag-picker-sheet.tsx`, `tests/watchlist-org.test.ts`
- New: `components/tag-filter-row.tsx`