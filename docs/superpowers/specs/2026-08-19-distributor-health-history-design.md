# Distributor Health History & Trends (v5.5)

## Overview

The app already tracks a per-distributor health **snapshot** (`distributor_health`) with a
status list, filter chips, and a "Test All Distributors" button. This phase adds **history &
trends**: a rolling, capped per-distributor record of health samples, captured passively from
existing fetches, surfaced as uptime %, a trend arrow, and a status sparkline on the health
dashboard.

No new scraping is introduced. History is **local-only** (AsyncStorage), consistent with the
current health data — no backend/sync changes.

## Data Model & Storage

New AsyncStorage key: `distributor_health_history` (same `StorageAdapter` as the existing
`distributor_health` snapshot).

```ts
type HealthSample = {
  status: HealthStatus;          // "working" | "blocked" | "error"
  reason?: string;
  responseTimeMs?: number;
  at: string;                    // ISO timestamp
};
type HealthHistory = Record<string, HealthSample[]>;
```

**Pruning** (enforced on every append): drop samples older than 30 days, then cap at 90 samples
per distributor (oldest first). Both limits always applied, regardless of input.

### New `createHealthService` API (`lib/scrapers/health.ts`)

- `recordSample(distributorId, status, reason?)` — appends a sample, prunes, persists. Never
  throws to callers; storage failures are swallowed so health capture cannot break a price check.
- `getHealthHistory(): Promise<HealthHistory>` — returns the stored history; corrupt/missing
  JSON resolves to `{}` (matches `getDistributorHealth` behavior).
- `computeHealthStats(history): Record<string, HealthStats>` where
  `HealthStats = { uptimePct: number; trend: "up" | "down" | "flat"; sparkline: number[] }`
  - `uptimePct` = working samples ÷ total samples × 100, rounded to integer.
  - `trend` = compare uptime of the most-recent half of samples vs the earlier half; a change
    of ±10 percentage points or more → `"up"`/`"down"`, otherwise `"flat"`.
  - `sparkline` = last ~30 samples mapped to numeric (working=1, blocked=0.5, error=0).

## Capture Points

Both existing fetch paths record history through `recordSample`. One sample per distributor per
check run (not per product), so a 5-product × 10-distributor watchlist yields 10 samples per run.

1. **Passive capture (price checks)** — `lib/background-price-check.ts`'s `healthCollector`
   already records per-distributor status during `runPriceCheckCore`. Its `flush()` additionally
   calls `recordSample(...)` for each recorded entry. No new scraping.
2. **Manual runs** — `testAllDistributors()` in `lib/scrapers/health.ts` calls `recordSample(...)`
   for each distributor result, in addition to saving the current snapshot it already saves.

**Unchanged:** the snapshot format, the `distributor_health` key, resilientFetch/circuit-breaker
logic, and the health screen's existing filters/Test All flow.

## UI Changes (`app/health.tsx`)

Each distributor row gains a right-aligned stats block (next to the existing last-checked time):

- **Uptime %** — e.g. `92%`, colored by status tone (`colors.success`/`warning`/`error`).
- **Trend arrow** — `▲` improving / `▼` declining / `–` flat (existing glyph convention from
  `PriceSparkline`).
- **Sparkline** — a small hand-rolled SVG polyline (react-native-svg, same pattern as
  `PriceSparkline`), ~60×24, plotting the last ~30 status samples (working=1, blocked=0.5,
  error=0), stroke colored by current status.

Rows with no history yet show `–` for uptime and no sparkline. Filter chips, Test All button,
progress bar, and empty state are unchanged.

## Error Handling

- Storage read/write failures in `getHealthHistory`/`recordSample` → silently fall back to
  empty/ignore (matches existing snapshot behavior).
- Corrupt/malformed history JSON → treated as empty.
- `recordSample` never throws to callers.
- Pruning is defensive: always enforces both the 30-day age cap and the 90-count cap.

## Testing

Extend `tests/scrapers/health.test.ts` (mirroring existing style):

- `recordSample` appends and persists; `getHealthHistory` returns it.
- Pruning: appending >90 samples caps at 90; samples older than 30 days dropped.
- `computeHealthStats`: uptime % math; trend up/down/flat across the ±10pp threshold; sparkline
  numeric mapping (working/blocked/error → 1/0.5/0) and last-30 truncation.
- Capture integration: `testAllDistributors` records history samples; the background collector's
  `flush` records history samples.
- `classifyResult` unchanged (already tested).

## Out of Scope

- Backend/sync of health history (local-only).
- Scheduled dedicated health probes (passive capture only).
- Per-distributor drill-down detail view (row-level stats only).
- Changes to `classifyResult`, resilientFetch, or circuit-breaker logic.