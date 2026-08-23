# Phase 73: Search Screen Refactor — Design Spec

## Goal

Break `app/search.tsx` (417 lines) into smaller components following the same decomposition pattern used in Phases 68-72.

## Current State

`search.tsx` contains:
- 10 state hooks + 3 memos + 2 callbacks + 1 effect = 16 hooks total
- 1 inline sub-component (ProductImage)
- 6 render sections: Header, Search Bar, Tag Filter, FlatList (with empty state + product card), Pre-add TagPickerSheet, Post-add TagPickerSheet

## Approach: Full Decomposition

Extract 4 components + 1 custom hook into `components/search/` and `hooks/`. The main screen becomes a thin composition root (~130 lines).

## New Files

### `components/search/product-image.tsx`
- Product image with loading state
- Source: lines 27-45 (19 lines)
- Already a standalone function component — just move it

### `components/search/catalog-product-card.tsx`
- Product card with add/tracked/tag buttons
- Source: lines 279-383 (105 lines)
- Props: `product`, `trackedIds`, `adding`, `pendingTags`, `onAdd`, `onTagPress`

### `components/search/catalog-search-bar.tsx`
- Search input with magnifying glass + clear button
- Source: lines 174-209 (36 lines)
- Props: `query`, `onQueryChange`
- Separate from the watchlist SearchBar (different styling/placeholder)

### `components/search/search-empty-state.tsx`
- Empty/no-results state
- Source: lines 250-278 (28 lines)
- Props: `query`, `selectedTagIds`

### `hooks/use-search-data.ts`
- Custom hook: loadData + tag filtering memos
- Source: lines 66-85 (memos) + 128-144 (loadData + effect)
- Returns: `watchlist`, `trackedIds`, `tagDefinitions`, `tagFilteredResults`, `tagCounts`, `loadData`

## Main File After Refactor

`search.tsx` becomes ~130 lines:
- Imports + hook calls (~20 lines)
- handleAdd callback (~40 lines)
- JSX composition: Header (inline), CatalogSearchBar, TagFilterRow, FlatList shell (~30 lines), two TagPickerSheet bindings (~30 lines)

## Verification

1. `pnpm check` — 0 errors
2. `pnpm lint` — clean
3. `pnpm test` — all pass
4. `search.tsx` reduced from 417 → ~130 lines (69% reduction)
5. 4 new files in `components/search/` + 1 new hook in `hooks/`
