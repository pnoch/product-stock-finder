# Search Improvement — Fuse.js Fuzzy Matching

**Date:** 2026-09-21
**Status:** Approved

## Problem

The current `searchCatalog()` in `lib/catalog.ts` uses simple case-insensitive substring matching against `name`, `modelNumber`, `brand`, and `category`. This fails for:

- **Model number variants:** "crs804" doesn't match "CRS804-4DDQ-hRM" (no hyphen normalization)
- **Multi-word queries:** "ubiquiti switch" only matches if both words appear in the same field verbatim
- **Typos:** "ubiquiti swtich" matches nothing
- **Description not searched:** product descriptions are excluded from search

## Solution

Replace the hand-rolled `searchCatalog()` with a Fuse.js instance configured for fuzzy matching with weighted fields.

## Changes

### `lib/catalog.ts`

- Add `fuse.js` import
- Create a module-level `Fuse` instance over `PRODUCT_CATALOG`
- Replace `searchCatalog()` to use `fuse.search()` and return the original `PRODUCT_CATALOG` items (Fuse returns scored results; we extract the `.item` property)
- Configuration:
  - `keys`: `["modelNumber", "name", "brand", "category", "description"]`
  - `weights`: modelNumber 0.4, name 0.3, brand 0.15, category 0.1, description 0.05
  - `threshold`: 0.4 (moderate fuzziness — allows typos but not total mismatches)
  - `includeScore`: true
  - `minMatchCharLength`: 2 (ignore single-character queries)
  - `ignoreLocation`: true (match anywhere in the string)

### `app/search.tsx`

- No changes — already calls `searchCatalog(query)` and renders results

### `package.json`

- Add `fuse.js` dependency (`pnpm add fuse.js`)

## What stays the same

- All UI components (`CatalogProductCard`, `RecentSearches`, `TagFilterRow`, `SearchEmptyState`)
- Tag filtering, bulk import, manual add flows
- `app/search.tsx` calling convention

## Testing

### `tests/catalog-search.test.ts`

- Exact match: "CRS804" → CRS804-4DDQ-hRM
- Fuzzy match: "crs804" → CRS804-4DDQ-hRM (case-insensitive, hyphen-tolerant)
- Typo: "ubiquiti swtich" → Ubiquiti switches
- Multi-word: "mikrotik router" → MikroTik routers
- Relevance: modelNumber matches rank higher than description matches
- Empty query: returns full catalog (matches current behavior where `query.length === 0` shows all products)
- No match: "xyznonexistent" → empty array
- Brand search: "netgear" → NETGEAR M4300-96X
