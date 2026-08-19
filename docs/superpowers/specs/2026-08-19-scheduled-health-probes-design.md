# Scheduled Health Probes (v5.6) Design

## Goal

Automatically probe all 25 distributors on a schedule so health history accumulates without manual "Test All" runs. The Phase 57 health history (uptime %, trend, sparkline) becomes useful without user intervention.

## Background

Phase 57 (`2026-08-19-distributor-health-history-design.md`) added rolling per-distributor health history captured from two sources:
- The watchlist-driven `PRICE_CHECK_TASK` background task (records health only for distributors on the watchlist).
- The manual "Test All Distributors" button on the health screen (`testAllDistributors()`, all 25).

Gap: non-watchlist distributors only get history when the user manually runs Test All. This phase closes that gap with a scheduled full-catalog probe.

## Decisions (from brainstorming)

1. **Location:** client-side background task (expo-background-task), matching the existing `PRICE_CHECK_TASK` pattern. Local-first, no server infra.
2. **Schedule:** reuse the existing `AppSettings.checkInterval` (`manual` | `hourly` | `daily`). No new settings UI; `manual` disables probes.
3. **Scope:** all 25 distributors (fills the actual gap — watchlist distributors already get history from `PRICE_CHECK_TASK`).
4. **Fetch method:** `resilientFetch` (retry/backoff, circuit breakers, blocked detection, plain→browser escalation), shared with the price-check path.

## Architecture

### New background task: `HEALTH_PROBE_TASK`

Defined at module level in `lib/background-price-check.ts` (must be global scope, per expo-task-manager requirement):

```ts
export const HEALTH_PROBE_TASK = "health-probe";
```

```ts
TaskManager.defineTask(HEALTH_PROBE_TASK, async () => {
  try {
    await healthService.testAllDistributors();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
```

### New registration: `registerHealthProbeTask()`

Mirrors `registerPriceCheckTask()`:

- If `Platform.OS === "web"` → return early.
- Read `getSettings()`.
- If `checkInterval === "manual"` → unregister if registered, then return.
- `intervalMinutes` = 60 (hourly) or 1440 (daily).
- If not registered → `registerTaskAsync(HEALTH_PROBE_TASK, { minimumInterval: intervalMinutes })`.
- If registered → unregister then re-register (updates interval).
- Wrap in try/catch (silently ignore simulator/web errors).

Called from `app/_layout.tsx` alongside `registerPriceCheckTask()`.

### `testAllDistributors()` resilientFetch upgrade

In `lib/scrapers/health.ts`, replace the per-distributor fetch:

**Before:**
```ts
const url = parser.buildSearchUrl(PROBE_MODEL);
const html = await fetchWithParser(parser, url);
const result = parser.parsePrice(html);
const status = classifyResult(html, result);
```

**After:**
```ts
const url = parser.buildSearchUrl(PROBE_MODEL);
const outcome = await resilientFetch({ parser, url, state: breakerStore });
if (outcome.status === "ok" && outcome.html) {
  const result = parser.parsePrice(outcome.html);
  const status = classifyResult(outcome.html, result);
  return { distributorId: parser.id, status, reason: status === "error" ? "no price found" : undefined, ... };
}
if (outcome.status === "blocked") {
  return { distributorId: parser.id, status: "blocked", reason: outcome.error ?? "blocked by site", ... };
}
if (outcome.status === "skipped") {
  return { distributorId: parser.id, status: "blocked", reason: "in cooldown", ... };
}
return { distributorId: parser.id, status: "error", reason: outcome.error ?? "no price found", ... };
```

`breakerStore` is created once per `testAllDistributors` call:

```ts
const breakerStore = createStorageBreakerStore(adapter);
```

`createStorageBreakerStore` accepts `Pick<StorageAdapter, "getItem" | "setItem">`; the existing `adapter` satisfies this. It reads/writes the same `DISTRIBUTOR_BREAKER_KEY` as the price-check path, so breaker cooldowns are shared and consistent.

Unchanged: concurrency (3), progress callback, `saveDistributorHealth(results)`, per-result `recordSample(distributorId, status, reason)`, and the `catch` fallback (error status with message).

The manual "Test All" button on the health screen uses the same upgraded `testAllDistributors()` — manual and scheduled probes are consistent.

## Data Flow

OS fires `HEALTH_PROBE_TASK` (hourly/daily) → `testAllDistributors()` → probes all 25 with `resilientFetch` (concurrency 3) → `saveDistributorHealth(results)` + `recordSample(...)` per result → 30-day/90-sample history grows. Manual Test All uses the identical path.

## Error Handling

- `resilientFetch` handles retries/backoff/blocked detection; circuit breakers put blocked distributors into cooldown (`skipped`), so scheduled probes don't hammer blocked sites.
- `recordSample` never throws (Phase 57).
- The task catches errors and returns `Failed`.
- `registerHealthProbeTask` silently ignores errors (simulator/web), same as `registerPriceCheckTask`.

## Testing

- `tests/scrapers/health.test.ts`:
  - Rework the existing `testAllDistributors` test: mock `resilientFetch` (via `importOriginal` spread so `classifyFetchStatus` still works) instead of `fetchWithParser`.
  - New outcome-mapping tests: ok→working, blocked→blocked, skipped→blocked/"in cooldown", error→error.
- `tests/price-check.test.ts`:
  - New `registerHealthProbeTask` tests using existing `expo-task-manager` / `expo-background-task` mocks: manual unregisters, hourly/daily registers, web no-op.
- Verification: `pnpm check`, `pnpm lint`, `pnpm test`, browser smoke (health screen shows history after a probe; breaker cooldown respected).

## Out of Scope

- Server-side probing (client-only).
- A separate health-probe interval setting (reuses `checkInterval`).
- Probe history sync to the backend (local-only, same as Phase 57).
- Drill-down health detail view.