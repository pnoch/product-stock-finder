# Stock-Like Price Chart with Tap-to-Inspect Design Spec

**Date:** 2026-08-10
**Status:** Approved
**Scope:** Enhance the mobile Product Detail price history chart with tap-to-inspect (crosshair + tooltip showing exact price/date), and add a price history chart with hover/tap inspection to the desktop Product Detail screen.

## Overview

The app's core value is checking a specific item's price globally. The mobile Product Detail already has a price history chart (gridlines, axis labels, LOW/HIGH markers, trend coloring). This feature makes it stock-like by adding tap-to-inspect: tapping anywhere on the chart shows a crosshair + tooltip with the exact price and date at the nearest data point. The desktop Product Detail currently has no price chart, so this feature adds one using Recharts (already a dependency) with its built-in tooltip.

## Architecture

### Mobile: Enhance `PriceHistoryChart` in `app/product/[id].tsx`

The existing `PriceHistoryChart` (around line 2022) is an SVG chart. Add tap-to-inspect:

- Wrap the SVG in a `Pressable` (or use `PanResponder`) to capture taps
- On tap, compute the nearest data point by x-position
- Set `selectedIndex` state
- Render a vertical crosshair line + tooltip at that point showing the exact price and date
- Tapping again (or a close button) dismisses the tooltip

**Tooltip content:** date, price, and the point's position relative to the range (e.g. "LOW", "HIGH", or percentage from min).

### Desktop: Add Price History Chart to `desktop/src/pages/ProductDetail.tsx`

The desktop Product Detail has no price chart. Add a "Price History" section:

- Use Recharts (already a dependency via the Compare screen's `MultiLineChart`)
- Render a `LineChart` with the selected listing's `priceHistory`
- Recharts' built-in `Tooltip` provides hover/tap inspection (price + date)
- Place it in a collapsible "Price History" section on the Product Detail screen

**Shared behavior** — both charts show:

- Price line with trend coloring (up = red, down = green, matching the app)
- Gridlines + axis labels
- Tap/hover to see exact price + date at a point

## Data Flow

1. **Mobile** — the `PriceHistoryChart` receives `data` (price history), `currency`, `width`, `height`. A tap handler computes the nearest data point by x-position, sets `selectedIndex` state, and renders a crosshair line + tooltip at that point. Tapping again (or a close button) dismisses it.
2. **Desktop** — the Product Detail screen loads the product's listings, and the Price History section renders a Recharts `LineChart` with the selected listing's `priceHistory`. Recharts' `Tooltip` shows price + date on hover.

## Error Handling

- Fewer than 2 price points → chart shows "Not enough data" (existing behavior)
- Tap outside the data range → no tooltip (or nearest point)
- Empty price history → chart hidden

## Testing

- Unit tests for the tap-to-inspect logic (nearest-point computation)
- Component tests for the mobile chart (renders tooltip on tap)
- Component tests for the desktop chart (renders with Recharts)

## Files

**Modified:**

- `app/product/[id].tsx` — enhance `PriceHistoryChart` with tap-to-inspect tooltip
- `desktop/src/pages/ProductDetail.tsx` — add Price History section with Recharts chart

**New:**

- `tests/price-chart.test.ts` — unit tests for nearest-point logic
- `desktop/tests/price-chart.test.tsx` — component tests for the desktop chart
