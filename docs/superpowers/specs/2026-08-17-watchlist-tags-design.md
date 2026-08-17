# Design: Watchlist Tags — v5.2

Date: 2026-08-17
Status: Proposed

## Problem

The watchlist is a flat list of products with only a region filter and sort
modes. Users who track products across projects (home network, lab, client
orders, budget builds) have no way to group or label products. This phase adds
colored tags that can be applied to products and used to filter the watchlist.

## Approach

Tags are many-per-product colored labels. Products carry an array of tag ids;
tag definitions (id, name, color) live in `AppSettings`. Both sync through the
existing `watchlist` and `settings` collections — no backend or schema changes.
Tag assignment happens from a quick action on each watchlist card; filtering
happens via a chip row above the list (OR semantics). Tag management (rename,
recolor, delete) is sheet-based — no dedicated screen.

## Changes

### 1. Data model (`lib/types.ts`)

- `Product` gains `tags?: string[]` — array of tag ids. Syncs automatically via
  the existing `watchlist` collection (products are already serialized whole).
- New `TagDefinition` interface:
  ```ts
  export interface TagDefinition {
    id: string;
    name: string;
    color: string;
  }
  ```
- `AppSettings` gains `tagDefinitions?: Record<string, TagDefinition>` keyed by
  tag id (JS object key order preserves insertion order, giving a stable display
  order). Syncs automatically via the existing `settings` collection.
- Tag ids: `crypto.randomUUID()` when available, else a
  `Date.now().toString(36)` + random fallback — same pattern as
  `lib/device-id.ts` `generateId()`. Extract/reuse a shared `generateId`
  helper if convenient.
- Tag names: trimmed, non-empty, unique case-insensitively. Creating a duplicate
  shows an inline error in the picker sheet.

### 2. Tag colors (`lib/tags.ts` new module)

- Fixed palette of 10 colors drawn from the theme tokens:
  `["#0F52BA", "#00C896", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899",
  "#14B8A6", "#F97316", "#6366F1", "#64748B"]`.
- `nextTagColor(defs)` returns the first palette color not already in use
  (falls back to cycling if all 10 are used). New tags auto-assign this color;
  the user can change it in the manage sheet.
- Helper functions: `getTagById(defs, id)`, `tagColor(defs, id)`.
- **Orphaned tag ids:** a product may reference a tag id that no longer exists
  in definitions (e.g. sync race after a delete). Rendering and filtering must
  silently ignore unknown ids — never crash, never show a blank chip.

### 3. Storage layer (`lib/storage.ts`)

- `getTagDefinitions(): Promise<Record<string, TagDefinition>>` — reads the
  `tagDefinitions` slice from settings, defaults to `{}`.
- `saveTagDefinitions(defs)` — merges the slice into settings without clobbering
  other settings fields (uses the existing `saveSettings` path) and notifies
  `"settings"` so open sheets/screens can refresh.
- `setProductTags(productId, tags: string[])` — updates a watchlist product's
  `tags` array, mirroring the existing `updateProductListings` pattern
  (enqueue + save + `notify("watchlist", productId)`).
- `createTag(name, color)` / `renameTag(id, name)` / `setTagColor(id, color)` /
  `deleteTag(id)`:
  - `createTag` generates the id, adds to definitions, persists.
  - `renameTag` validates uniqueness then updates the definition.
  - `deleteTag` removes the definition AND strips the id from every watchlist
    product's `tags` array (persist both).

### 4. Watchlist screen — filter bar (`app/(tabs)/watchlist.tsx`)

- A horizontal scrollable chip row below the existing region filter. Each chip
  shows a colored dot + tag name; tap toggles selection; a trailing manage icon
  (SF Symbol `slider.horizontal.3` / Material `tune`) opens the manage sheet.
- **OR semantics:** a product matches if it has *any* selected tag. Combined
  with the region filter via AND.
- The row is hidden entirely when no tags are defined.
- Selection is component state (like `regionFilter` today) — resets on screen
  mount.

### 5. Watchlist screen — card changes (`ProductCard`)

- A tag icon button (SF Symbol `tag.fill` / Material `tag`) in the card's bottom
  row, left of the trash icon. Tapping it opens the tag picker sheet for that
  product (does not navigate).
- Tag chips rendered under the top row (colored dot + name), up to 3 then a
  `+N` overflow label. Hidden when the product has no tags.

### 6. Tag picker sheet (`components/tag-picker-sheet.tsx` new)

- Bottom sheet (RN `Modal`, consistent with the app's existing sheet patterns).
- Lists all tags with a checkbox (checked = on this product); tapping toggles
  the tag on/off for the product via `setProductTags`.
- Inline "New tag" input (name + auto-assigned color, tap to create via
  `createTag` and immediately apply to the product). Duplicate names show an
  inline error.
- Done button closes the sheet.

### 7. Manage sheet (`components/tag-manage-sheet.tsx` new)

- Opened from the filter bar's manage icon.
- Lists all tags with name, color swatch, rename (inline edit), recolor
  (palette picker), and delete (with confirm). Uses `renameTag`,
  `setTagColor`, `deleteTag`.
- No dedicated management screen — this is the lightweight inline management.

### 8. Filtering logic (`app/(tabs)/watchlist.tsx`)

- Extend `filteredWatchlist`:
  ```ts
  const selectedTags = new Set(selectedTagIds);
  const matchesTags =
    selectedTagIds.length === 0 ||
    (product.tags ?? []).some((id) => selectedTags.has(id));
  ```
- Applied in addition to the existing region filter (AND). Sort modes
  unaffected.

## Out of scope

- No product-detail Tags row, no bulk-tag mode (per user choices).
- No dedicated manage-tags screen.
- No backend/schema changes — tags sync via the existing collections.

## Testing

- `lib/tags.ts`: unit tests for `nextTagColor`, `getTagById`, `tagColor`.
- `lib/storage.ts`: unit tests for `createTag`/`renameTag`/`deleteTag`/
  `setProductTags` (including delete stripping ids from products and
  `saveTagDefinitions` not clobbering other settings).
- Watchlist screen: filter OR-semantics logic covered by a unit test on the
  predicate (extract it if needed for testability).
- Manual: tag a product from the card, filter by tag, rename/recolor/delete a
  tag, verify sync round-trips tags and definitions when signed in.

## Version

Next phase (Phase 54), version bump to v5.2 in `todo.md`; package/app version
stays at 4.7.2 (matches Phase 50 consolidation).