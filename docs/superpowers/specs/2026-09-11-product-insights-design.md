# Product Insights — Design Spec

**Date:** 2026-09-11
**Goal:** Add a "Product Insights" card to the Stats screen summarizing per-product price behavior: all-time-low count, active drop streaks, and volatility distribution.

## Pure Module (lib/product-insights.ts)

```typescript
export interface ProductInsight {
  productId: string;
  name: string;
  atAllTimeLow: boolean;
  dropStreak: number;
  volatility: "low" | "medium" | "high" | null; // null when <3 points
}

export interface ProductInsightsResult {
  products: ProductInsight[];
  allTimeLows: number;
  droppingCount: number;
  volatility: { low: number; medium: number; high: number };
}

export function computeProductInsights(
  watchlist: Product[],
  displayCurrency: string,
): ProductInsightsResult
```

Per product — merge all listings' price points, convert to display currency (FX-guarded skip), sort by date:
- **atAllTimeLow**: current best in-stock listing price (converted) equals the merged-history minimum.
- **dropStreak**: count of consecutive strictly-decreasing steps at the end of the merged history.
- **volatility**: coefficient of variation (std/mean) of history prices — `<0.05` low, `<0.15` medium, else high; `null` when fewer than 3 points.

Aggregates: counts over products with ≥1 converted point.

## Card (components/stats/insights-card.tsx)

Props `{ result }`. Rendered on Stats after DigestCard/MoversCard:
- Title "Product Insights"
- Three stat columns: At all-time low / Dropping now / Volatility ("2 · 3 · 5" style low-med-high)
- Up to 3 highlight rows for all-time-low products: 🏅 flag/name
- Hidden when watchlist empty (parent controls)

## Wiring

`app/stats.tsx`: memo `computeProductInsights(watchlist, displayCurrency)`; render after MoversCard.

## Testing

`tests/product-insights.test.ts`: all-time-low detection, streak counting (incl. non-consecutive resets), volatility buckets + null, FX skips, empty watchlist.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/product-insights.ts` | new (~110 lines) |
| `tests/product-insights.test.ts` | new |
| `components/stats/insights-card.tsx` | new (~100 lines) |
| `app/stats.tsx` | modify |
| `todo.md` | append Phase 95 |
