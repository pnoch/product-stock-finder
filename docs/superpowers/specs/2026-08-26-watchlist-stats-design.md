# Watchlist Statistics — Design Spec

**Date:** 2026-08-26
**Goal:** Add a Statistics screen reachable from the Watchlist summary card, showing price movers (7d/30d/All), basket value at best prices, stock health, and data freshness — all computed from local watchlist data in the user's display currency.

## Background

`computeWatchlistSummary` (lib/watchlist-summary.ts) already surfaces total value + stock counts on the Watchlist summary card. This feature adds a deeper, dedicated stats screen. All data is local-first (AsyncStorage watchlist with per-listing `priceHistory: PricePoint[]`) — no server dependency.

## Navigation & Entry Point

- Watchlist summary card (`components/watchlist/summary-card.tsx`) gains a tappable "View stats" row → `router.push("/stats")`.
- New route `app/stats.tsx` (Expo Router), header title "Statistics", back navigation to Watchlist.

## Stat Computations (lib/watchlist-stats.ts — pure functions)

All amounts converted to `displayCurrency` via existing `convertPrice`; listings without an FX rate are skipped using the same `hasExchangeRate` guard as the existing summary.

### 1. Movers — `computeMovers(watchlist, displayCurrency, days)`
- Window: `days = 7 | 30 | null` (null = all history).
- Per product+listing: filter price points to window; require ≥2 points; change% = (current − oldest) / oldest × 100; also record old/new prices converted to display currency.
- Returns `{ drops: PriceMove[], gainers: PriceMove[] }` — top 5 each sorted by magnitude (drops most negative first, gainers most positive first).
- `PriceMove = { productId, productName, distributorId, distributorName?, countryFlag?, oldPrice, newPrice, currency, changePct }`.

### 2. Basket Value — `computeBasketValue(watchlist, displayCurrency)`
- For each product: cheapest in-stock listing price > 0, converted.
- Returns `{ total, productCount, excludedCount }` — excluded = products with no in-stock listing or no convertible price.

### 3. Stock Health — `computeStockHealth(watchlist)`
- Returns `{ totalListings, inStockPct, fullyOutOfStock, backOrderOnly }`:
  - `inStockPct`: share of listings with status "in_stock" (0–100 rounded).
  - `fullyOutOfStock`: products where every listing is out_of_stock.
  - `backOrderOnly`: products where every listing is back_order.

### 4. Data Freshness — `computeDataFreshness(watchlist, now)`
- Returns `{ avgHistoryPoints, staleCount, neverCheckedCount, oldestCheck: string | null }`:
  - `avgHistoryPoints`: mean of `priceHistory.length` across listings (rounded to 1 decimal).
  - `staleCount`: listings whose `lastChecked` is older than 7 days.
  - `neverCheckedCount`: listings with no `lastChecked`.
  - `oldestCheck`: ISO date string of the earliest `lastChecked`, null if none.

Top-level convenience: `computeWatchlistStats(watchlist, displayCurrency, days, now)` returning all four.

## UI Components

```
app/stats.tsx                        composition root (~130 lines): loads watchlist +
                                     settings, days state, renders 4 cards, empty state
components/stats/
  movers-card.tsx                    segmented 7d/30d/All control; two ranked lists
                                     (▼ drops green, ▲ gainers red); rows show
                                     flag+name, old→new price, pct badge
  basket-value-card.tsx              big total, "N products · M excluded" caption
  stock-health-card.tsx              in-stock % + counts for fully-OOS / back-order-only
  data-freshness-card.tsx            avg points, stale count, never-checked, oldest check
```

Styling follows existing conventions: NativeWind classes + `useColors()` tokens, card pattern matching `components/watchlist/summary-card.tsx`. Haptics on segmented-control taps.

## Edge Cases

- Empty watchlist → friendly empty state ("Add products to see statistics").
- Listings with <2 points in window → excluded from movers.
- Missing FX rates → skipped from money math (never crash).
- Products with no listings → ignored by all computations.
- `now` injectable into freshness/movers for testability.

## Sync

Stats are derived data — nothing stored, nothing synced.

## Testing

`tests/watchlist-stats.test.ts`: unit tests for all four functions covering happy paths and edge cases above (window filtering, ranking order, exclusion rules, rounding). Existing tests must pass unchanged.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/watchlist-stats.ts` | new (~200 lines) |
| `tests/watchlist-stats.test.ts` | new |
| `app/stats.tsx` | new |
| `components/stats/movers-card.tsx` | new |
| `components/stats/basket-value-card.tsx` | new |
| `components/stats/stock-health-card.tsx` | new |
| `components/stats/data-freshness-card.tsx` | new |
| `components/watchlist/summary-card.tsx` | modify (add View-stats tap target) |
| `todo.md` | append Phase 79 |
