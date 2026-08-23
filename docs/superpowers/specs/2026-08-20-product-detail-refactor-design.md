# Product Detail Screen Refactor (v5.16)

## Goal

Break `app/product/[id].tsx` (2,347 lines) into focused, single-responsibility components. No behavior changes — pure structural refactoring.

## Current State

`product/[id].tsx` contains:
- 2 standalone components (`BestDistributorCard`, `PriceHistoryChart`)
- 1 duplicated component (`StockBadge` — exists in 3+ files)
- 1 utility function (`openListingUrl`)
- 1 massive main component (1,718 lines) with 14 state hooks, 8 callbacks, and all JSX

## Extraction Plan

### New shared components

| Component | Source | Lines | Destination |
|-----------|--------|-------|-------------|
| `StockBadge` | `product/[id].tsx:329-370` | 41 | `components/stock-badge.tsx` |
| `BestDistributorCard` | `product/[id].tsx:77-327` | 251 | `components/best-distributor-card.tsx` |
| `PriceHistoryChart` | `product/[id].tsx:2108-2347` | 239 | `components/price-history-chart.tsx` |
| `openListingUrl` + helpers | `product/[id].tsx:372-386` | 14 | `lib/listing-utils.ts` |

### StockBadge deduplication

After extraction, update imports in:
- `app/(tabs)/watchlist.tsx` — remove local StockBadge, import from `components/stock-badge.tsx`
- `app/(tabs)/index.tsx` — same
- `app/product/[id].tsx` — same

### Screen sub-components (co-located or inline)

| Component | Source lines | Size | Props |
|-----------|-------------|------|-------|
| `ProductInfoCard` | 816–1014 | 198 | product, listings, visibleListings, displayCurrency, lastUpdatedAt |
| `ActionButtons` | 1016–1218 | 200 | callbacks (onSetAlert, onRefresh, onShare, onCopyLink, onTestAlert, onCompare), isRefreshingAny |
| `DistributorListingCard` | 1466–1696 | 230 | listing, stockWatch, onToggleWatch, onViewChart, displayCurrency, shippingRegion |
| `DistributorListingSection` | 1219–1312 | 93 | visibleListings, regionFilter, bestInStockListing, product, etc. |
| `PriceAlertModal` | 1986–2103 | 117 | alertModalVisible, onClose, alertPrice, alertCurrency, onSetAlert, product |
| `ReminderDatePickerModal` | 1702–1830 | 128 | showDatePicker, onClose, reminderDate, onSetReminder, product |
| `PriceChartModal` | 1832–1984 | 152 | chartListing, onClose, chartWidth, chartHeight |

### Main component after refactor

`product/[id].tsx` becomes ~400 lines:
1. State declarations (~50 lines) — 14 useState hooks
2. Data loading — useFocusEffect + loadData
3. Derived state — sortedListings, bestInStockListing, bestDeal
4. Action callbacks — handleSetAlert, handleToggleStockWatch, etc.
5. JSX composition — imports all sub-components, passes props

## Prop Architecture

- Sub-components receive only the props they need
- No context providers needed — all state lives in the parent
- Stock watches state (`stockWatches`) stays in parent since it's shared across listing cards
- Modals receive open state + close callback + relevant data

## Testing

- Existing 828+ tests pass without modification (except possible import path updates)
- Add snapshot test for StockBadge in `tests/components/stock-badge.test.tsx`
- No new unit tests needed for extracted components (they render what parent passes)
- Verification: `pnpm check` (0 errors), `pnpm lint`, `pnpm test`

## Commit Plan

1. Extract shared components (StockBadge, BestDistributorCard, PriceHistoryChart, listing-utils)
2. Deduplicate StockBadge across tabs
3. Extract screen sub-components + modals
4. Refactor main component to composition root
5. Final verification pass
