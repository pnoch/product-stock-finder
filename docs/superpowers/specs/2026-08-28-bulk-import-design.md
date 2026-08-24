# Bulk Watchlist Import — Design Spec

**Date:** 2026-08-28
**Goal:** Let users paste a list of model numbers on the Search screen, preview how many match the catalog, and import all matched products into the watchlist in one action.

## Background

The catalog (`PRODUCT_CATALOG` in `lib/catalog.ts`, 17 products) is keyed by `modelNumber`. Single-product adding exists via Search; this feature adds paste-many. Import goes through existing `addToWatchlist` so change notifications fire and the sync engine picks up automatically.

## Pure Logic (lib/bulk-import.ts)

### `parseModelInput(text: string): string[]`
- Splits on newlines, commas, semicolons, tabs.
- Trims whitespace; strips one layer of wrapping quotes (`"CRS804"` → `CRS804`).
- Drops empty entries.
- Dedupes case-insensitively (first occurrence wins).
- Returns cleaned model strings (original casing preserved for display).

### `matchModels(models: string[], catalog: CatalogProduct[]): { matched, unmatched }`
- Case-insensitive exact equality against `catalog[].modelNumber`.
- `matched`: catalog entries in input order (deduped).
- `unmatched`: input strings with no catalog match (original casing, deduped).

Types: `CatalogProduct = typeof PRODUCT_CATALOG[number]`.

## UI (components/search/bulk-import-modal.tsx)

Bottom-sheet modal opened from an "Import list" icon button in the Search screen header:

- Multiline `TextInput` (autoFocus, monospace-friendly), placeholder showing example format.
- Live preview computed from current text:
  - "**N matched · M not found**"
  - Matched product names (truncated list, max ~5 visible + "+k more").
  - Unmatched lines listed verbatim so users can spot typos.
- **Import N products** button (disabled when matched ∩ not-tracked = 0):
  - For each matched catalog product whose id is not already tracked: `addToWatchlist(catalogProduct as Product)`.
  - Tracks counts: added vs already-tracked.
  - Success alert: "*X added · Y already in watchlist*" (+ unmatched count if > 0), then closes modal.
- Cancel / backdrop close.

The search screen already owns a tag-picker bottom-sheet pattern to follow (`TagPickerSheet` usage) — reuse its modal styling conventions.

## Entry Point

`app/search.tsx` header gains an icon button (e.g. `square.and.arrow.down.on.square` if mapped, else existing mapped import-ish icon) next to the title, opening the modal.

## Edge Cases

- Empty input / whitespace only → preview shows 0/0, import disabled.
- All inputs already tracked → import disabled ("All matched products are already tracked").
- Very large pastes (>500 lines) — parse is O(n); no artificial cap needed but preview truncates display.
- Products imported via bulk get standard `addToWatchlist` treatment (isWatched, addedAt, sync notify).

## Testing

`tests/bulk-import.test.ts`: parsing (separators, quotes, dedupe, empties), matching (case-insensitivity, order preservation, unmatched reporting). Existing tests unchanged.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/bulk-import.ts` | new (~70 lines) |
| `tests/bulk-import.test.ts` | new |
| `components/search/bulk-import-modal.tsx` | new (~180 lines) |
| `app/search.tsx` | modify (header button + modal state) |
| `todo.md` | append Phase 81 |
