# Recent Searches — Design Spec

**Date:** 2026-09-05
**Goal:** Remember recent search queries on the Search screen and surface them as tappable chips when the query is empty.

## Module (lib/recent-searches.ts)

Device-local UI state (not synced) — standalone module with its own AsyncStorage key `recent_searches`, dependency-injectable for tests:

```typescript
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export async function getRecentSearches(store = AsyncStorage): Promise<string[]>
export async function recordSearch(query: string, store = AsyncStorage): Promise<string[]>
export async function clearRecentSearches(store = AsyncStorage): Promise<void>
```

`recordSearch` rules: trim; ignore empty; dedupe case-insensitively (existing entry removed, moved to front); cap at 8 entries; persists JSON array; returns the updated list.

## UI (components/search/recent-searches.tsx)

Chip row shown under the search bar only when `query.length === 0` and recents exist:
- "Recent" muted label + horizontally wrapping chips (most recent first).
- Tap chip → `onSelect(chip)` fills the search input.
- Small "Clear" text button on the label row → `clearRecentSearches()` + refresh local state.

## Wiring

- `CatalogSearchBar`: new optional prop `onSearchSubmit?: (query: string) => void`, called from `onSubmitEditing` with the current trimmed query.
- `app/search.tsx`: state `recentSearches`; load on mount via `getRecentSearches()`; `handleSearchSubmit` → `recordSearch(query)` → update state; render `<RecentSearches>` between the search bar and results when query empty.

## Testing

`tests/recent-searches.test.ts` with an in-memory store: record ordering/dedupe/cap/trim/empty-ignored; get round-trip; clear.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/recent-searches.ts` | new (~60 lines) |
| `tests/recent-searches.test.ts` | new |
| `components/search/recent-searches.tsx` | new (~70 lines) |
| `components/search/catalog-search-bar.tsx` | modify (+onSearchSubmit) |
| `app/search.tsx` | modify (state + wiring) |
| `todo.md` | append Phase 89 |
