# Chart Scrubbing — Design Spec

**Date:** 2026-09-04
**Goal:** Add drag/tap scrubbing to both price charts: continuous tooltip tracking on the product-detail chart and a multi-distributor crosshair tooltip on the compare chart.

## Current State

- `components/price-history-chart.tsx` (single-series): tap selects the nearest point (dashed line + price/date tooltip); no drag support. X positions are index-based.
- `components/compare/multi-line-chart.tsx` (multi-series): pure SVG, no interaction. X positions are **date-based** — each series has its own coord array; dates may not align across series.
- `lib/price-chart.ts`: exports `findNearestIndex(percent, count)`.

## Pure Helpers (lib/price-chart.ts)

```typescript
export function indexForLocationX(
  locationX: number,
  width: number,
  padL: number,
  padR: number,
  count: number,
): number
// Maps a touch location to the nearest point index using findNearestIndex;
// clamps percent into [0, 100].

export function nearestByX<T extends { x: number }>(
  coords: T[],
  targetX: number,
): T | null
// Linear scan for the coord with minimal |x - targetX|; null for empty array.
```

## Product Chart Drag (price-history-chart.tsx)

Replace the `Pressable onPress` wrapper with a `View` using the RN responder system:

- `onStartShouldSetResponder` / `onMoveShouldSetResponder` → true.
- `onResponderGrant`: compute idx via `indexForLocationX`; if idx equals current selection → deselect (toggle), else select.
- `onResponderMove`: update selection to `indexForLocationX(e.nativeEvent.locationX)` (continuous scrubbing).
- `onResponderRelease`: no-op (selection persists).

Existing tooltip/crosshair rendering reused unchanged.

## Compare Chart Scrubbing (multi-line-chart.tsx)

Wrap the `<Svg>` in a responder `View` with the same grant/move pattern:

- State `scrubX: number | null`; on grant/move set it to `locationX` clamped into `[padL, width - padR]`.
- Tap (grant+release without movement) while `scrubX != null` clears it.
- When set, render:
  - vertical dashed line at `scrubX` from padT to padT+usableH;
  - per-series highlighted dot at `nearestByX(series.coords, scrubX)` (radius 5);
  - tooltip box at top-left of plot area (surface fill, border): date header (from the first series' nearest point) + one row per series: colored dot + label + formatted USD price (`$usd.toFixed(2)` matching axis style). Rows capped at 6 with "+N more" if series exceed that.

Track "moved" via a ref set in move handler, reset on grant, checked on release.

## Testing

`tests/price-chart.test.ts` (extend existing file if present):
- `indexForLocationX`: left edge → 0, right edge → count-1, midpoint rounding, clamping out-of-range x.
- `nearestByX`: exact match, nearest neighbor, empty array.

Full suite must pass.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/price-chart.ts` | modify (+2 helpers) |
| `tests/price-chart.test.ts` | new or extend |
| `components/price-history-chart.tsx` | modify (responder drag) |
| `components/compare/multi-line-chart.tsx` | modify (crosshair + tooltip) |
| `todo.md` | append Phase 88 |
