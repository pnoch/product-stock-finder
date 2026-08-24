# Drop Calendar — Design Spec

**Date:** 2026-09-13
**Goal:** A heatmap calendar on the Stats screen showing which recent days had price drops across the watchlist, with tappable day details.

## Pure Module (lib/drop-calendar.ts)

```typescript
export interface DropEvent {
  productId: string;
  name: string;
  from: number;
  to: number;
  percent: number; // negative
}

export interface DropDay {
  dateKey: string; // YYYY-MM-DD (UTC)
  dropCount: number;
  biggestPct: number | null; // most negative single-drop percent
  drops: DropEvent[];
}

export interface DropCalendarResult {
  byDay: Map<string, DropDay>;
  totalDrops: number;
}

export function computeDropCalendar(
  watchlist: Product[],
  displayCurrency: string,
  days = 30,
  now = Date.now(),
): DropCalendarResult
```

Logic:
- Per listing: sort merged history by date; consecutive pairs where `to < from` produce a DropEvent attributed to `to`'s UTC date key.
- Percent = `(to − from) / from × 100` in display currency (FX-guarded conversion for both sides; pair skipped if either side non-convertible).
- Only pairs whose date key falls within `[now − days, now]` are kept.
- Group into byDay map with dropCount + biggestPct (min of percents) + event list.

## Card (components/stats/drop-calendar-card.tsx)

Props `{ result, days }`. Rendered on Stats after InsightsCard:
- Summary line: "{totalDrops} price drops in the last {days} days"
- Grid: last `days` days as rows-of-weeks layout (simplest robust: 7-column grid ending today, leading blanks for weekday offset). Cell shows day number; background tint intensity: 0 → transparent w/ border; 1–2 → success+33; ≥3 → success solid-ish (+77); today outlined.
- Tap cell with drops → toggles selection; detail list below grid shows that day's DropEvents (`name: from → to (−N%)`).
- Weekday initial header row.

## Wiring

`app/stats.tsx`: memo `computeDropCalendar(watchlist, displayCurrency, 30)`; render after InsightsCard.

## Testing

`tests/drop-calendar.test.ts`: pair detection (drops only), day grouping via UTC keys, window clamping (old pairs excluded), FX skip, empty watchlist, biggestPct correctness.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/drop-calendar.ts` | new (~90 lines) |
| `tests/drop-calendar.test.ts` | new |
| `components/stats/drop-calendar-card.tsx` | new (~150 lines) |
| `app/stats.tsx` | modify |
| `todo.md` | append Phase 97 |
