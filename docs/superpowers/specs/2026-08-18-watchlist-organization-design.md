# Design: Watchlist Organization — v5.3

Date: 2026-08-18
Status: Proposed

## Problem

The watchlist already has a summary card, a 3-mode sort bar (Recent / Best
Price / A–Z), region filter chips, and tag filter chips, but the list is still
a single flat list. Users cannot filter by stock status, search within the
watchlist, group products into meaningful sections, or act on multiple products
at once. This phase adds stock-status filtering, grouping, more sort modes,
watchlist search, and bulk actions.

## Approach

Pure-function logic in a new `lib/watchlist-org.ts` module (mirroring the
existing `lib/region-filter.ts` and `lib/tags.ts` patterns), fully unit-tested,
then an inline enhancement of the watchlist screen. View preferences (sort +
group mode) persist in `AppSettings` and sync through the existing `settings`
collection — no backend or schema changes. Filters, search, and selection are
transient view state.

Pipeline: `groupWatchlist(sortWatchlist(filterWatchlist(watchlist, filters),
sort), group, tagDefinitions)`.

## Changes

### 1. Logic layer (`lib/watchlist-org.ts` new module)

Types:

```ts
type WatchlistSort =
  | "recent"        // addedAt desc (existing)
  | "best_price"    // best in-stock USD price asc (existing)
  | "az"            // name asc (existing)
  | "price_drop"    // all-time % drop desc (new)
  | "status"        // in_stock → back_order → out_of_stock → unknown (new)
  | "region";       // region asc (new)

type WatchlistGroup = "off" | "tag" | "status" | "region";

type StatusFilter = "all" | StockStatus;

interface WatchlistFilters {
  region: string;      // "all" or a region name
  tagIds: string[];    // OR semantics
  status: StatusFilter;
  query: string;       // name + model substring, case-insensitive
}

interface WatchlistSection {
  key: string;
  title: string;
  products: Product[];
}
```

Functions:

- `productStatus(product): StockStatus` — best-status precedence generalized
  from the card component: `in_stock` if any listing is in stock, else
  `back_order` if any is back-ordered, else `out_of_stock` if any listing has a
  known status, else `unknown` (no listings or all unknown). Shared by the
  summary card, filter, sort, and grouping.
- `filterWatchlist(list, filters): Product[]` — AND across region, tag ids
  (OR), status, and query. Query matches name and model number as a
  case-insensitive substring.
- `sortWatchlist(list, sort): Product[]` — the existing three modes plus
  `price_drop`, `status`, and `region`. `price_drop` sorts by
  `priceDropPercent` descending (nulls last). `status` uses the status order
  above. `region` sorts by the product's region (first listing's region),
  alphabetical.
- `priceDropPercent(product): number | null` — `(maxPrice − currentBest) /
  maxPrice` over the full price history, where `currentBest` is the best
  in-stock price converted to USD (via `getBestPrice`) and `maxPrice` is the
  highest price in the product's history. `null` when there is no price
  history.
- `groupWatchlist(list, group, tagDefinitions): WatchlistSection[]`:
  - `off` → one section (`key: "all"`, title `"All"`).
  - `tag` → one section per tag in definition order, plus `"Untagged"` at the
    end. Products with no tags go in `"Untagged"`. Products with multiple tags
    appear in every matching section (duplicated).
  - `status` → sections In Stock / Back Order / Out of Stock / Unknown in that
    order; empty sections omitted.
  - `region` → one section per region present, alphabetical.

### 2. Data model (`lib/types.ts`)

- `AppSettings` gains `watchlistSort?: WatchlistSort` (default `"recent"`) and
  `watchlistGroup?: WatchlistGroup` (default `"off"`). Syncs automatically via
  the existing `settings` collection.
- Read/written via the existing `getSettings` / `updateSettings` storage
  helpers in `lib/storage.ts` (no new storage keys).

### 3. Watchlist screen (`app/(tabs)/watchlist.tsx`)

Controls, top to bottom:

1. **Header** (title, Check Now, Add) — unchanged.
2. **Summary card** — the In Stock / Back Order / Out of Stock counts become
   tappable status filters: single-select toggle, active one highlighted, tap
   again to clear. Total Value and Listings stay static. The card always
   summarizes the full watchlist.
3. **Search bar** — inline text input with an X to clear.
4. **Sort + Group row** — a `Sort: {current label}` button opening a dropdown
   menu with all six modes; next to it a compact group-chip row:
   Off / Tag / Status / Region.
5. **Region chips** — unchanged.
6. **Tag chips** — unchanged.

Grouped sections:

- Group mode **off** renders the flat list exactly as today.
- Active group modes render a sticky section header (`{title} · {count}`)
  above each section's cards. Tag headers show the tag color dot + name.
  Status headers use the matching badge color. Empty sections are omitted.
- Sorting applies within each section.

Bulk selection:

- **Long-press** a card enters selection mode: `selectedIds` Set; cards show a
  checkmark overlay; the header swaps to `N Selected` + **Delete** + **Tag** +
  **X**.
- In selection mode, tapping a card toggles its selection; **X** or tapping
  empty space exits and clears.
- **Delete**: `window.confirm` on web (existing pattern) / Alert on native,
  then `removeFromWatchlist` per selected product.
- **Tag**: opens the existing `TagPickerSheet` (multi-select); chosen tags are
  **added** to every selected product (dedupe, existing tags kept).
- Selection is transient and never persisted; filters/sort/group keep working
  while it is active.
- Empty filtered results show a "No products match" message with a
  clear-filters action (reusing the existing empty-state pattern).

### 4. Persistence

`watchlistSort` and `watchlistGroup` persist via `AppSettings` and sync through
the `settings` collection. Filters, search, and selection are not persisted.

## Testing

- New `tests/watchlist-org.test.ts`:
  - `productStatus` precedence (in_stock → back_order → out_of_stock).
  - `filterWatchlist` — each filter alone and AND composition; case-insensitive
    query matching name and model.
  - `sortWatchlist` — all six modes, including price-drop ordering (nulls last)
    and status precedence.
  - `priceDropPercent` — `null` with no history; correct percentage with
    history.
  - `groupWatchlist` — tag sections + untagged + multi-tag duplication; status
    sections omitted when empty; region alphabetical.
- Existing `watchlist-summary` and `tags` tests stay green.
- Manual browser smoke of the watchlist screen (sort, group, status filter,
  search, bulk delete/tag) using the existing HTTPS harness.
- `pnpm check`, `pnpm lint`, `pnpm test` before commit.

## Out of Scope

- Server-side view state (view does not follow the user across devices).
- Bulk tag removal / tag replacement (add-only per requirements).
- Persisting filters or search query.
- Grouping by price range or custom sections.