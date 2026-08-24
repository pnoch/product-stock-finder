# Distributor-Scoped Alerts — Design Spec

**Date:** 2026-09-02
**Goal:** Let users scope a price alert to a single distributor (or keep it product-wide), with the picker in the Set Price Alert modal, correct client-side evaluation, and scoped badges in the alerts list.

## Background

`PriceAlert.distributorId?` exists in the data model and the server evaluation already honors it (`server/notifications/build-events.ts` narrows to `[alert.distributorId]`). Gaps:

1. Client `runPriceCheckCore` computes best price across ALL listings — ignores scoping.
2. Neither creation path sets `distributorId`; notably `handleSetBestAlert` (per-distributor row button) creates product-wide alerts — arguably a bug.
3. No UI to choose a distributor; alerts list doesn't show scoping.

## Pure Helper (lib/alert-scope.ts)

```typescript
export function listingsForAlert<T extends { distributorId: string }>(
  listings: T[],
  distributorId?: string,
): T[]
```
- Scoped → only listings whose `distributorId` matches.
- Unscoped/undefined → all listings.
- Pure; trivially testable. Used by client evaluation and reusable elsewhere.

## Client Evaluation Fix

`lib/background-tasks/price-check.ts` — inside the active-alerts loop of `runPriceCheckCore`, replace direct use of `product.listings` with:

```typescript
const eligible = listingsForAlert(product.listings, alert.distributorId);
```

then apply the existing in-stock filter to `eligible`. Server path unchanged.

## Alert Modal Picker

`components/product/price-alert-modal.tsx` — new optional props:
- `distributors?: Array<{ id: string; name: string; countryFlag: string }>`
- `selectedDistributorId?: string | null`
- `onSelectDistributor?: (id: string | null) => void`

When `distributors` is non-empty, render a horizontal chip row between the suggestion chips and the price input: first chip "All distributors" (selected when null), then one chip per distributor (`flag name`). Tap → haptic + `onSelectDistributor`. Existing behavior unchanged when props absent.

## Creation Wiring

`app/product/[id].tsx`:
- State: `alertDistributorId` (string | null), reset to null whenever the modal opens.
- Compute `alertDistributors` via useMemo from `visibleListings` (dedupe by id, resolve names/flags via `getDistributorById`).
- Pass three new props to `<PriceAlertModal>`.
- `handleSetAlert`: include `distributorId: alertDistributorId ?? undefined` in the PriceAlert.
- **Bug fix:** `handleSetBestAlert` includes `distributorId: listing.distributorId`.
- Success alert copy mentions the distributor when scoped ("at {name}").

## Alerts List Badge

In the alerts tab's alert card component (`components/alerts/*`): when `alert.distributorId` is set, render a small muted badge under the title: `{flag} {distributorName}` (resolved via `getDistributorById`, fallback to raw id).

## Sync

No schema change — `distributorId` already syncs as part of PriceAlert.

## Testing

- `tests/alert-scope.test.ts`: scoped filtering, unscoped passthrough, no-match → empty.
- Full suite must pass; existing tests unchanged.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/alert-scope.ts` | new (~15 lines) |
| `tests/alert-scope.test.ts` | new |
| `lib/background-tasks/price-check.ts` | modify (use helper) |
| `components/product/price-alert-modal.tsx` | modify (chip row) |
| `app/product/[id].tsx` | modify (state + wiring + bug fix) |
| `components/alerts/*` | modify (badge) |
| `todo.md` | append Phase 86 |
