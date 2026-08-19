# Health Drill-Down View (v5.7) Design

## Goal

Let the user tap a distributor row on the health dashboard to see that distributor's full health history: a summary header (uptime %, trend, sample count, first/last probe, avg response time) plus a scrollable list of every recorded probe sample. This was deferred from the Phase 57 spec and is now more valuable because Phase 58's scheduled probes accumulate history automatically.

## Background

Phase 57 added rolling per-distributor health history (`distributor_health_history` AsyncStorage key) with `HealthSample = { status, reason?, responseTimeMs?, at }` and `computeHealthStats` (uptime %, trend, sparkline). Phase 58 added `HEALTH_PROBE_TASK` so all 25 distributors accumulate history on the `checkInterval` schedule. The dashboard (`app/health.tsx`) shows per-row uptime %, trend glyph, and sparkline, but there is no way to see the underlying samples.

## Decisions (from brainstorming)

1. **Content:** summary header + full sample list (status rows).
2. **List format:** one row per sample — status dot + date/time + status label, with reason/response time as secondary text when present.
3. **Navigation:** push a new stack screen `app/health/[id].tsx` via `router.push(\`/health/${id}\`)`; dashboard rows become tappable.
4. **Approach:** new route + a pure `computeHealthSummary` helper in `lib/scrapers/health.ts`.

## Architecture

### New route: `app/health/[id].tsx`

A stack screen mirroring `app/health.tsx` and `app/product/[id].tsx` conventions:

- `useLocalSearchParams<{ id: string }>()` to read the distributor id.
- `useColors()` for theme colors; `ScreenContainer` wrapper.
- Header: "‹ Back" (router.back) + distributor name (flag + name via `getDistributorById`).
- On mount, load `getHealthHistory()` and `getDistributorHealth()` from `createHealthService(AsyncStorage)`.
- Compute `computeHealthStats(history)[id]` (uptime %, trend, sparkline) and `computeHealthSummary(samples)`.

### Dashboard row tap (modify `app/health.tsx`)

Wrap each distributor row's `View` in a `TouchableOpacity` with `onPress={() => router.push(\`/health/${h.distributorId}\`)}`. No other dashboard changes.

### Pure helper: `computeHealthSummary` (modify `lib/scrapers/health.ts`)

```ts
export interface HealthSummary {
  count: number;
  firstAt: string | null;
  lastAt: string | null;
  avgResponseTimeMs: number | null;
}

export function computeHealthSummary(
  samples: HealthSample[],
): HealthSummary {
  if (samples.length === 0) {
    return { count: 0, firstAt: null, lastAt: null, avgResponseTimeMs: null };
  }
  const times = samples.map((s) => new Date(s.at).getTime());
  const firstAt = samples[times.indexOf(Math.min(...times))].at;
  const lastAt = samples[times.indexOf(Math.max(...times))].at;
  const withResponse = samples.filter(
    (s) => typeof s.responseTimeMs === "number",
  );
  const avgResponseTimeMs =
    withResponse.length > 0
      ? Math.round(
          withResponse.reduce((sum, s) => sum + (s.responseTimeMs ?? 0), 0) /
            withResponse.length,
        )
      : null;
  return { count: samples.length, firstAt, lastAt, avgResponseTimeMs };
}
```

## Screen Layout

Inside `ScreenContainer`:

1. **Header:** "‹ Back" + distributor name.
2. **Summary card:** current status dot + label (from `getDistributorHealth`), uptime %, trend glyph (▲/▼/–), sample count, first/last probe times (formatted), avg response time (or "–" when `null`).
3. **Sample list** (ScrollView): one row per sample, newest first — status dot (`statusColors`), formatted date/time, status label; secondary line with reason and/or response time when present.
4. **Empty state:** "No health history yet. Run Test All or wait for scheduled probes."
5. **Unknown id:** "Distributor not found" + back button.

## Data Flow

Dashboard row tap → `router.push("/health/<id>")` → drill-down mounts → `getHealthHistory()` + `getDistributorHealth()` → `computeHealthStats` + `computeHealthSummary` → render summary card + sample rows.

## Error Handling

- Unknown/absent `id` → "Distributor not found" + back button (guards stale deep links).
- Corrupt history JSON → `getHealthHistory()` returns `{}` (Phase 57) → empty state.
- `computeHealthSummary` is pure and never throws.

## Testing

- `tests/scrapers/health.test.ts`:
  - `computeHealthSummary` returns `{ count: 0, firstAt: null, lastAt: null, avgResponseTimeMs: null }` for an empty array.
  - Count matches sample count.
  - firstAt/lastAt are the oldest/newest `at` values.
  - avgResponseTimeMs averages only samples that have `responseTimeMs`; `null` when none do.
- Verification: `pnpm check`, `pnpm lint`, `pnpm test`.
- Browser smoke: seed history in localStorage, open `/health`, tap a row → drill-down shows summary + sample rows; empty distributor shows empty state; back returns to dashboard.

## Out of Scope

- Timeline chart visualization (status rows only).
- Day-grouped aggregation.
- Editing/deleting history.
- History sync to the backend (local-only, as in Phase 57).