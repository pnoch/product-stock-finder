# Watchlist Share — Design Spec

**Date:** 2026-08-31
**Goal:** Share the whole watchlist summary (basket value, top drops, stock health) as formatted text from a share button on the Statistics screen.

## Pure Module (lib/watchlist-share.ts)

### `buildWatchlistShareText(input): string`

```typescript
interface WatchlistShareInput {
  watchlist: Product[];
  displayCurrency: string;
  days: MoversWindow;
  now?: number;
}
```

Output format:

```
My Watchlist — 12 products

Basket value: $4,231.50 (10 products)

Biggest drops (30d):
🇩🇪 MikroTik CRS518 — -18%
🇺🇸 CCR2216 — -9%

Stock health: 72% in stock · 2 fully out of stock

via Product Stock Finder
```

Rules:
- Composes existing pure functions from `lib/watchlist-stats.ts`: `computeMovers`, `computeBasketValue`, `computeStockHealth`.
- Header always present; product count = `watchlist.length`.
- Basket section omitted when `productCount === 0`.
- Drops section: top 3 from `computeMovers(...).drops`, label includes window ("7d"/"30d"/"all time"); omitted when empty.
- Stock health line omitted when `totalListings === 0`.
- Footer always: `via Product Stock Finder`.
- Never throws.

## UI

`app/stats.tsx` header gains a share icon button (`square.and.arrow.up`, already mapped) after the title: haptics guard → `Share.share({ message: buildWatchlistShareText({ watchlist, displayCurrency, days }), title: "My Watchlist" })` wrapped in try/catch. Uses the screen's existing state.

## Testing

`tests/watchlist-share.test.ts`: full output with all sections; sections dropped when data missing; window label variants; empty watchlist minimal output; movers truncation to 3.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/watchlist-share.ts` | new (~70 lines) |
| `tests/watchlist-share.test.ts` | new |
| `app/stats.tsx` | modify (header share button) |
| `todo.md` | append Phase 84 |
