# Health Drill-Down Polish (v5.8) Design

## Goal

Enhance the health drill-down screen (`app/health/[id].tsx`, added in v5.7) with a **status timeline strip** in the summary card and a **day-grouped sample list**, so the user can see status history at a glance and per-day structure.

## Background

v5.7 added the drill-down: a summary card (current status, uptime %, trend, sample count, first/last probe, avg response time) plus a flat, newest-first list of probe samples. The dashboard already renders a small 60×24 SVG `HealthSparkline` polyline per row. This phase adds richer history visualization to the drill-down only.

## Decisions (from brainstorming)

1. **Add both** a status timeline strip and a day-grouped list.
2. **Timeline strip segments are time-proportional** — each segment's width equals the actual elapsed time it covers (from its sample to the next probe), so gaps in probing are visible.
3. **Approach A:** two pure, unit-testable helpers in `lib/scrapers/health.ts`; the strip is a View-based flexbox bar (no SVG); the flat list becomes day-grouped.

## Architecture

### Pure helpers (add to `lib/scrapers/health.ts`)

```ts
export interface TimelineSegment {
  status: HealthStatus;
  weight: number;
}

export function timelineSegments(samples: HealthSample[]): TimelineSegment[]
```

- `[]` → `[]`.
- Single sample → `[{ status, weight: 1 }]`.
- Otherwise: sort ascending by `at`; span[i] = `time[i+1] − time[i]`; the last span reuses the previous span (or 1 if the previous is 0); weights = `span / total`. If total is 0 (all identical timestamps), fall back to equal weights.
- Weights sum to 1; zero-length spans yield 0-width (invisible) segments, correct for duplicate-timestamp probes.

```ts
export interface DayGroup {
  day: string;
  samples: HealthSample[];
}

export function groupSamplesByDay(samples: HealthSample[]): DayGroup[]
```

- `day` = local `YYYY-MM-DD` built from `getFullYear/getMonth/getDate` (locale-independent).
- Sorted newest day first; within a day, samples newest-first.
- Empty → `[]`.

### Screen changes (modify `app/health/[id].tsx` only)

1. **Summary card** gains the timeline strip at the bottom, rendered only when `segments.length > 0`:

   ```tsx
   <View
     style={{
       flexDirection: "row",
       height: 8,
       borderRadius: 4,
       overflow: "hidden",
       marginTop: 12,
     }}
   >
     {segments.map((seg, i) => (
       <View
         key={i}
         style={{
           flex: seg.weight,
           backgroundColor: statusColors[seg.status],
         }}
       />
     ))}
   </View>
   ```

2. **Sample list becomes day-grouped.** For each group: a header row — formatted day label + `· N samples · X% working` — then the existing status rows (status dot, date/time, reason/response time) underneath. The empty state text is unchanged.

### UI formatting (in the screen, not the helpers)

- Day header label: `new Date(day + "T00:00:00")` → `toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })` (e.g. "Wed, Aug 19").
- Working % per day: `Math.round(working / count * 100)`.

## Data Flow

Drill-down mounts → `getHealthHistory()` + `getDistributorHealth()` → `computeHealthStats` + `computeHealthSummary` (existing) → `timelineSegments(samples)` + `groupSamplesByDay(samples)` → render strip in summary card + day-grouped rows.

## Error Handling

- All new helpers are pure and never throw.
- Empty/absent history → existing empty state (no strip, no groups).
- Single sample → full-width single-color strip.
- Duplicate timestamps → 0-width segments for the duplicates; equal-weight fallback if all identical.

## Testing

`tests/scrapers/health.test.ts`:

- `timelineSegments`:
  - `[]` → `[]`.
  - Single sample → `[{ status, weight: 1 }]`.
  - Two samples → weights proportional to the time gap.
  - Last segment reuses the previous span.
  - All-identical timestamps → equal weights.
  - Weights sum to 1 (for a multi-sample case).
- `groupSamplesByDay`:
  - `[]` → `[]`.
  - Groups by local day (samples with noon-UTC timestamps so the local date is stable across timezones).
  - Newest day first.
  - Samples newest-first within a day.

Verification: `pnpm check`, `pnpm lint`, `pnpm test`.

Browser smoke: seed mixed-status history across two days in localStorage, open `/health/<id>` → timeline strip shows proportional colored segments; day headers show count + working %; rows grouped correctly; empty distributor still shows the empty state.

## Out of Scope

- Timeline strip on the dashboard rows (dashboard keeps its sparkline).
- Interactive/hover tooltips on strip segments.
- Editing/deleting history.
- Backend sync of history.