# Phase 72: Compare Screen Refactor — Design Spec

## Goal

Break `app/compare/[id].tsx` (1,165 lines) into smaller components following the same decomposition pattern used in Phases 68-71.

## Current State

`compare/[id].tsx` contains:
- 2 in-file sub-components: MultiLineChart (186 lines), CheapestRegionCard (157 lines)
- 3 state hooks (selected, timeRange, sortBy)
- 1 useRef, 1 useEffect, 4 useCallback, 3 useMemo = 12 hooks total
- 8 render sections: Loading/NotFound, Header, Chart Card, Cheapest Region, Alert CTA, Prices Table, Distributor Selector
- 3 inline stock badge implementations (can reuse existing StockBadge)

## Approach: Full Decomposition

Extract 7 presentational components + 1 utility module into `components/compare/` and `lib/`. The main screen becomes a thin composition root (~100-120 lines).

## New Files

### `lib/compare-utils.ts`
- Pure constants and helper functions
- Source: lines 37-55 (19 lines)
- Exports: CHART_COLORS, TimeRange, SortBy, TIME_RANGES, TIME_RANGE_DAYS, filterByRange

### `components/compare/multi-line-chart.tsx`
- SVG multi-series line chart (already self-contained)
- Source: lines 57-242 (186 lines)
- Props: `series: Array<{label, color, data, currency}>`, `width: number`, `height: number`

### `components/compare/cheapest-region-card.tsx`
- Cheapest-per-region summary card (already self-contained)
- Source: lines 244-400 (157 lines)
- Props: `listings: DistributorListing[]`, `colors: ReturnType<typeof useColors>`

### `components/compare/compare-header.tsx`
- Back button, "Compare Prices" title + product name, refresh button
- Source: lines 606-670 (65 lines)
- Props: `productName: string`, `isRefreshing: boolean`, `onRefresh: () => void`, `onBack: () => void`

### `components/compare/chart-card.tsx`
- Time-range chips + chart + legend
- Source: lines 672-803 (132 lines)
- Props: `timeRange: TimeRange`, `onRangeChange: (range: TimeRange) => void`, `chartSeries`, `chartWidth: number`

### `components/compare/cross-alert-cta.tsx`
- Cross-distributor alert CTA card
- Source: lines 808-866 (59 lines)
- Props: `listings: DistributorListing[]`, `onPress: () => void`

### `components/compare/current-prices-table.tsx`
- Selected distributor prices with chart color dots
- Source: lines 868-987 (120 lines)
- Props: `listings: DistributorListing[]`, `selected: Set<string>`

### `components/compare/distributor-selector.tsx`
- Sort chips + checkbox list of distributors
- Source: lines 989-1160 (172 lines)
- Props: `sortedListings`, `selected`, `sortBy`, `onSortChange`, `onToggle`, `priceTrends`

## StockBadge Reuse

Replace 3 inline stock badge implementations with the existing `StockBadge` component from `components/stock-badge.tsx`.

## Main File After Refactor

`compare/[id].tsx` becomes ~100-120 lines:
- Imports + hook calls (~20 lines)
- Memoized computations (~40 lines)
- JSX composition (~40 lines)

State hooks stay in the main file (selected, timeRange, sortBy drive multiple sections).

## Verification

1. `pnpm check` — 0 errors
2. `pnpm lint` — clean
3. `pnpm test` — all pass
4. `compare/[id].tsx` reduced from 1,165 → ~100-120 lines (90% reduction)
5. 7 new files in `components/compare/` + 1 new util in `lib/`
