# Distributor Target Table — Design Spec

**Date:** 2026-09-09
**Goal:** A comparison table on product detail showing each distributor's current price against its scoped alert target, with quick-set buttons that open the pre-scoped alert modal.

## Concept

Reuses Phase 86 distributor-scoped alerts as the "targets" — no new storage, no server changes. The table makes per-distributor targets visible at a glance: current price vs target, distance-to-target %, and alert status.

## Pure Helper (lib/alert-scope.ts extension)

```typescript
export function scopedAlertFor(
  alerts: PriceAlert[],
  productId: string,
  distributorId: string,
): PriceAlert | null
```
- Returns the active scoped alert for that product+distributor (isActive, no triggeredAt), else null.
- TDD.

Also exported: `productWideAlert(alerts, productId)` — active unscoped alert for the "Any distributor" row.

## Card (components/product/target-table-card.tsx)

Props: `{ listings, currency, alerts, onSetTarget(distributorId | null) }`.

Rows (per listing):
- flag + distributor name
- current price (`formatPrice`, native currency)
- target column: scoped alert's target formatted in **alert currency**, or "+" quick-set button
- Δ% column: `(current - target) / target × 100` vs alert target converted to listing currency… simpler: compare both in listing currency via convertPrice; green when drop-alert satisfied (current ≤ target), red otherwise; rise alerts invert
- status dot: success = triggered, primary = active, muted border = none

"Any distributor" footer row when a product-wide alert exists (no quick-set).

Empty state (no listings with any relevant alerts): muted hint "Set per-distributor targets to compare them here."

Tap "+"/pencil → `onSetTarget(distributorId)`.

## Wiring (app/product/[id].tsx)

- State `alerts: PriceAlert[]`; loaded in `loadData` via `getAlerts()`.
- `handleSetTarget(distributorId)`: set scope + open modal (`setAlertDistributorId(distributorId); setAlertModalVisible(true);`) — reuses all Phase 86 modal wiring; also reset direction/price as the existing open path does.
- Render `<TargetTableCard>` between `<ActionButtons>` and `<DistributorListingSection>`.

## Testing

`tests/alert-scope.test.ts` extended: scopedAlertFor matching (active only, ignores triggered/other products/distributors); productWideAlert.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/alert-scope.ts` | extend (+2 helpers) |
| `tests/alert-scope.test.ts` | extend |
| `components/product/target-table-card.tsx` | new (~150 lines) |
| `app/product/[id].tsx` | modify (load alerts, render card, handler) |
| `todo.md` | append Phase 93 |
