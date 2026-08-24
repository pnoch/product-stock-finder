# Watchlist Insight Chips — Design Spec

**Date:** 2026-09-14
**Goal:** Surface per-product price insights (all-time-low, active drop streak) as small chips on watchlist cards.

## Data

`computeProductInsights(watchlist, displayCurrency)` (Phase 95) already returns per-product `atAllTimeLow` and `dropStreak`. The watchlist screen computes it once (memoized on `[watchlist, displayCurrency]`) and passes each card its insight via a Map lookup.

## UI (components/watchlist/product-card.tsx)

New optional prop `insight?: { atAllTimeLow: boolean; dropStreak: number }`.

Chip row rendered under the existing price/status area when either flag applies:
- 🏅 **All-time low** pill — success tint (`colors.success + "22"`, success text)
- ▼ **Dropping ×N** pill — primary tint (N = dropStreak)
- Row absent when neither applies; `selectionMode` unaffected.

## Wiring

`app/(tabs)/watchlist.tsx`: memo + Map build; pass `insight={insightMap.get(item.id)}` in renderItem.

## Testing

Metrics already unit-tested (Phase 95). Suite green; no new tests.

## File Summary

| File | Modify |
|------|--------|
| `components/watchlist/product-card.tsx` | chip row |
| `app/(tabs)/watchlist.tsx` | memo + prop |
| `todo.md` | append Phase 98 |
