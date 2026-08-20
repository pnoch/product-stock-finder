# Full 30-Day Health History Window (v5.10) Design

## Goal

Fix the health history window so it covers a full 30 days at any cadence. Currently the 90-sample cap in `pruneHealthHistory` dominates at hourly cadence, shrinking the window to ~4 days (90 samples ÷ 24/day).

## Background

`lib/scrapers/health.ts` prunes per-distributor probe history on every append:

```ts
const HISTORY_MAX_SAMPLES = 90;
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function pruneHealthHistory(samples, now) {
  const cutoff = now - HISTORY_MAX_AGE_MS;
  const fresh = samples.filter((s) => new Date(s.at).getTime() >= cutoff);
  return fresh.slice(-HISTORY_MAX_SAMPLES);
}
```

- At hourly cadence (24 samples/day), the 90-sample cap keeps only ~4 days — the age cap never binds.
- At daily cadence (1 sample/day), the 30-day age cap keeps ~30 samples — the count cap never binds.

## Decisions (from brainstorming)

1. **Target window: full 30 days** at any cadence, matching the existing age cap.
2. **Implementation: fixed cap of 720** (30 days × 24 samples/day at hourly cadence).
3. **Constant expression: derived** — `const HISTORY_MAX_SAMPLES = 30 * 24;` to match the self-documenting style of `HISTORY_MAX_AGE_MS`.

## Architecture

### Change (modify `lib/scrapers/health.ts`)

```ts
const HISTORY_MAX_SAMPLES = 30 * 24;
```

- Evaluates to 720; intent is self-documenting.
- The 30-day age cap still applies first, so at daily cadence only ~30 samples are retained; the count cap now only matters at hourly cadence, where it preserves the full 30-day window.

### No other code changes

- `computeHealthStats` uses `samples.slice(-30)` for the sparkline — unaffected.
- The dashboard and drill-down render whatever history exists — unaffected.

### Storage note

At hourly cadence, 25 distributors × 720 samples × ~120 bytes ≈ 2.2MB in AsyncStorage (web localStorage has a ~5MB limit). Real but acceptable; history is one JSON key and coexists with the app's other data. If it becomes a problem, the constant is a one-line change.

## Testing

`tests/scrapers/health.test.ts` (the `pruneHealthHistory` describe block):

- Update "caps at 90 samples, keeping the newest" → "caps at 720 samples, keeping the newest": build 800 samples (1-minute apart), expect length 720, first = `samples[80]`, last = `samples[799]`.
- The other two tests are unchanged: "drops samples older than 30 days" and "returns an empty array when everything is stale".

Verification: `pnpm check`, `pnpm lint`, `pnpm test`.

Browser smoke: seed >720 samples in localStorage for one distributor → drill-down shows the newest 720 (30 days at hourly), day-grouped correctly.

## Out of Scope

- Adaptive/cadence-aware cap (fixed 720 chosen).
- Time-based-only pruning (count cap retained as a safety valve).
- Reducing storage footprint (e.g., downsampling old samples).