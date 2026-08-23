# Watchlist Screen Refactor (v5.18)

## Goal

Break `app/(tabs)/watchlist.tsx` (1,240 lines) into focused, single-responsibility components. No behavior changes — pure structural refactoring.

## Current State

`watchlist.tsx` contains:
- 1 local component (`ProductCard`, 251 lines)
- 1 massive main component with 17 state hooks, 9 callbacks, and all JSX
- 32 total hooks (17 useState, 5 useMemo, 9 useCallback, 1 useFocusEffect)

## Extraction Plan

### New shared components

| Component | Source | Lines | Destination |
|-----------|--------|-------|-------------|
| `ProductCard` | `watchlist.tsx:62-312` | 251 | `components/watchlist/product-card.tsx` |

### Screen sub-components

| Component | Source lines | Size | Props |
|-----------|-------------|------|-------|
| `SummaryCard` | 722–823 | 102 | summary, displayCurrency, statusFilter, onStatusToggle |
| `WatchlistHeader` | 535–720 | 186 | mode, selectedCount, watchlistLength, isRefreshingAny, checking, checkProgress, callbacks |
| `SearchBar` | 825–866 | 42 | query, onQueryChange |
| `ProgressBar` | 868–881 | 14 | progress, visible |
| `SortGroupBar` | 883–999 | 116 | sortMode, groupMode, sortMenuOpen, onChange callbacks |
| `RegionFilterRow` | 1001–1037 | 37 | regions, regionFilter, onRegionChange |
| `EmptyState` | 1066–1149 | 84 | query, statusFilter, regionFilter, selectedTagIds, onClearFilters, onAddProduct |

### Main component after refactor

`watchlist.tsx` becomes ~440 lines:
1. State declarations (~40 lines) — 17 useState hooks
2. Data loading — loadData, useFocusEffect
3. Derived state — filteredWatchlist, tagCounts, sections, summary
4. Callbacks — toggleTagFilter, toggleSelection, handleDelete, handleCheckNow, etc.
5. JSX composition — imports all sub-components, passes props

## Prop Architecture

- `sortMode`, `groupMode`, `sortMenuOpen` stay in parent (shared between Header, SortGroupBar, and persistViewPrefs)
- `selectionMode`, `selectedIds` stay in parent (shared between Header and SectionList)
- `tagDefinitions` stays in parent (used by ProductCard, TagFilterRow, SectionList headers)
- All other state is passed down as props

## Testing

- Existing 837+ tests pass without modification
- Verification: `pnpm check` (0 errors), `pnpm lint`, `pnpm test`

## Commit Plan

1. Extract ProductCard to components/
2. Extract SummaryCard, SearchBar, ProgressBar
3. Extract WatchlistHeader
4. Extract SortGroupBar, RegionFilterRow, EmptyState
5. Refactor main component to composition root
6. Update todo.md + final verification
