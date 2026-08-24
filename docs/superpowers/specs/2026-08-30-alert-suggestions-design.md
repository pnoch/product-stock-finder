# Alert Price Suggestions — Design Spec

**Date:** 2026-08-30
**Goal:** Show tappable suggested target prices in the Set Price Alert modal, computed from the product's price history (near-low, below-average, under-current strategies).

## Background

`components/product/price-alert-modal.tsx` collects a target price + currency. Users currently guess. Alerts are product-wide: the background check fires when the best in-stock price across any distributor drops below target — so suggestions must be computed from all listings' history merged.

## Pure Module (lib/alert-suggestions.ts)

### `suggestAlertPrices(listings, currency): AlertSuggestion[]`

```typescript
interface AlertSuggestion {
  key: "near_low" | "below_avg" | "under_current";
  label: string;
  price: number;
}
```

Strategies (each converted to `currency`, FX-guarded via `hasExchangeRate`; non-convertible points skipped):

1. **near_low** — "Near low": minimum of every price point across all listings' merged history.
2. **below_avg** — "Below avg": mean of price points from the last 30 days × 0.90.
3. **under_current** — "Under current": cheapest current in-stock listing price × 0.95.

Rules:
- All prices rounded to 2 decimals (`Math.round(v * 100) / 100`).
- Drop suggestions ≤ 0; drop strategies whose inputs are missing (no history / no in-stock).
- Dedupe by rounded value (first strategy wins); preserve strategy order; return up to 3.
- Pure; never throws on empty listings (returns []).

## Modal Wiring

- New optional prop `suggestions?: AlertSuggestion[]`.
- When non-empty, render a chip row between the currency picker and the price input: rounded pills with label + formatted price (`formatPrice(price, alertCurrency)`).
- Tap → haptic (existing guard pattern) + `setAlertPrice(String(suggestion.price))`.
- No changes to existing modal behavior when prop is absent.

## Screen Wiring

`app/product/[id].tsx` computes suggestions with `useMemo` from `product.listings ?? []` and `alertCurrency`, passing them into `<PriceAlertModal>`. Recomputes automatically when the user switches alert currency.

## Testing

`tests/alert-suggestions.test.ts`:
- near_low picks minimum across merged multi-currency history (converted).
- below_avg uses only last-30-day points and applies 0.90.
- under_current uses cheapest in-stock × 0.95 (ignores OOS).
- Dedupe by value; ≤0 dropped; empty listings → []; FX-less points skipped.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/alert-suggestions.ts` | new (~90 lines) |
| `tests/alert-suggestions.test.ts` | new |
| `components/product/price-alert-modal.tsx` | modify (chips row) |
| `app/product/[id].tsx` | modify (compute + pass suggestions) |
| `todo.md` | append Phase 83 |
