# Price vs Average — Design Spec

**Date:** 2026-09-12
**Goal:** Show how the current best price compares to its 30-day average on product detail, with a verdict indicator.

## Pure Module (lib/price-average.ts)

```typescript
export interface PriceVsAverage {
  current: number;
  average: number;
  percentVsAvg: number;
  verdict: "below" | "at" | "above";
}

export function computePriceVsAverage(
  listings: DistributorListing[],
  displayCurrency: string,
  windowDays = 30,
  now = Date.now(),
): PriceVsAverage | null
```

- current: cheapest in-stock converted price (FX-guarded).
- average: mean of merged sorted history points within `windowDays` of `now` (converted; FX-skipped).
- percentVsAvg rounded to 1 decimal.
- verdict thresholds: ≤ −3% below, ≥ +3% above, else at.
- null when no current price or fewer than 2 window points.

## Card (components/product/price-vs-avg-card.tsx)

Compact card after NotesCard on product detail:
- Label "vs 30-day average"
- Big % colored success/muted/error by verdict
- Sub-line: "30-day avg {formatPrice(average)}" + verdict copy ("Below average — good time to buy" / "Around its average" / "Above average")
- Returns null (parent hides) when computation is null

## Wiring

`app/product/[id].tsx`: memo over listings + displayCurrency; render after `<NotesCard>`.

## Testing

`tests/price-average.test.ts`: window filtering, verdict boundaries (exactly ±3%), FX skips, insufficient data → null, empty watchlist → null.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/price-average.ts` | new (~70 lines) |
| `tests/price-average.test.ts` | new |
| `components/product/price-vs-avg-card.tsx` | new (~90 lines) |
| `app/product/[id].tsx` | modify |
| `todo.md` | append Phase 96 |
