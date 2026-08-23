# Product Detail Sub-Components Refactor — Design Spec

**Date:** 2026-08-21
**Goal:** Break `app/product/_components.tsx` (1,507 lines, 7 components) into individual files under `components/product/`, reducing the main file to ~100 lines.

## Architecture

Extract each component to its own file in `components/product/`. The existing `_components.tsx` becomes a thin barrel re-export (or is deleted entirely if the main file imports directly from `components/product/`).

### Components to Extract

| Component | Current Lines | File | Responsibility |
|-----------|---------------|------|----------------|
| `ProductInfoCard` | ~210 | `product-info-card.tsx` | Product header with brand badge, description, stats (distributors/in-stock/best price), last-refreshed indicator, currency converter widget |
| `ActionButtons` | ~220 | `action-buttons.tsx` | Primary row (Set Alert, Refresh) + secondary row (Share, Test Alert, Copy Link) + Compare button |
| `DistributorListingCard` | ~235 | `distributor-listing-card.tsx` | Single distributor row: name, country, stock badge, price, sparkline, Visit button, payment methods, last-checked, Watch for Restock |
| `DistributorListingSection` | ~255 | `distributor-listing-section.tsx` | Container: section header, empty states, BestDistributorCard, AI insight, region filter chips, BestDeal card, renders DistributorListingCard list |
| `PriceAlertModal` | ~135 | `price-alert-modal.tsx` | Bottom-sheet modal: currency picker, price input, Set Alert / Cancel |
| `ReminderDatePickerModal` | ~155 | `reminder-date-picker-modal.tsx` | Bottom-sheet modal: date display, DateTimePicker, Set Reminder / Cancel |
| `PriceChartModal` | ~175 | `price-chart-modal.tsx` | Bottom-sheet modal: PriceHistoryChart, current price summary, % change vs oldest |

### File Structure After Refactor

```
components/product/
  product-info-card.tsx          (~210 lines)
  action-buttons.tsx             (~220 lines)
  distributor-listing-card.tsx   (~235 lines)
  distributor-listing-section.tsx (~255 lines)
  price-alert-modal.tsx          (~135 lines)
  reminder-date-picker-modal.tsx (~155 lines)
  price-chart-modal.tsx          (~175 lines)

app/product/
  _components.tsx                (~0-10 lines — barrel re-export or deleted)
  [id].tsx                       (unchanged — imports from components/product/)
```

### Import Strategy

Each extracted component imports only what it needs from `@/hooks/use-colors`, `@/lib/*`, `@/components/ui/*`, etc. — no cross-dependencies between the extracted components except:
- `DistributorListingSection` imports `DistributorListingCard`
- `DistributorListingCard` uses `PriceSparkline` (already extracted)
- `DistributorListingSection` uses `BestDistributorCard` (already extracted)
- `PriceChartModal` uses `PriceHistoryChart` (already extracted)

### Testing

No new tests needed — these are pure UI extractions with no logic changes. Existing product detail tests cover the composed output.

### Key Metrics

- `_components.tsx`: 1,507 → ~10 lines (barrel) or deleted
- 7 new files in `components/product/`
- Same pattern as watchlist/alerts/settings/compare/search refactors
