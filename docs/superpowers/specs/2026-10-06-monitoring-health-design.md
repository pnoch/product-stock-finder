# Monitoring Health — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Let the app tell the user whether background monitoring is actually running — so
"get told the second it restocks or drops" can't silently become "it stopped
checking days ago."

## Problem

The promise breaks silently when the OS stops the background task (Doze, battery
optimization, OEM task-killers, reboot). The Background Refresh toggle can read
**on** while `TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK)` is false, and
there is no "last checked" timestamp. A user who gets no alert assumes nothing
happened — when monitoring may have died. This is the false-alert trust failure
from the opposite direction: a *silent* miss.

## Scope

**In scope:** a `lastBackgroundRunAt` timestamp, a pure `assessMonitoringHealth`,
a Settings status/warning + re-enable action, a Home banner, and tests.

**Out of scope:** push-delivery diagnostics (a later refinement); desktop parity
(desktop has no background task).

## Architecture

### 1. Record the last run — `lib/background-tasks/tasks.ts`

In the `PRICE_CHECK_TASK` handler, after a successful `runPriceCheckCore()`,
write the current epoch ms. Add to `lib/storage/` (mirroring
`getBackgroundTaskInterval`):

```ts
export async function getLastBackgroundRun(): Promise<number | null>;
export async function setLastBackgroundRun(ts: number): Promise<void>;
```

Backed by a dedicated key `LAST_BACKGROUND_RUN` (a single number, not the
interval map — it is one value, and `clearAllData` must wipe it).

### 2. Pure assessment — `lib/monitoring-health.ts` (new)

```ts
export type MonitoringHealth =
  | { status: "off" }
  | { status: "ok"; lastRunAt: number | null }
  | { status: "stale"; lastRunAt: number; expectedMs: number }
  | { status: "stopped"; lastRunAt: number | null };

export function assessMonitoringHealth(input: {
  enabled: boolean;
  registered: boolean;
  lastRunAt: number | null;
  intervalMs: number;
  now: number;
}): MonitoringHealth;
```

Rules (in order):
- `!enabled` → `{ status: "off" }`.
- `enabled && !registered` → `{ status: "stopped", lastRunAt }`.
- `enabled && registered && lastRunAt === null` → `{ status: "ok", lastRunAt: null }`
  (never run yet — the OS may not have fired; not a failure).
- `enabled && registered && now - lastRunAt > intervalMs * 2` →
  `{ status: "stale", lastRunAt, expectedMs: intervalMs * 2 }`.
- else → `{ status: "ok", lastRunAt }`.

### 3. Assessment wiring — `hooks/use-monitoring-health.ts` (new)

A hook that, on mount and on every foreground transition, reads the four inputs
and returns the `MonitoringHealth`:

```ts
export function useMonitoringHealth(): MonitoringHealth;
```

- `enabled` = `settings.backgroundServiceEnabled` (and, when limits are enforced,
  `isPro`).
- `registered` = `await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK)`
  (web → `false`).
- `lastRunAt` = `getLastBackgroundRun()`.
- `intervalMs` = `(settings.checkInterval === "hourly" ? 60 : 1440) * 60_000`.
- Re-assess on `AppState` `active` (the OS state changes while backgrounded).

### 4. Surface it

- **Settings** — under Background Refresh, a status line: "Last checked: X ago"
  (via `formatLastRefreshed`) or "Not yet run". When `stopped`/`stale`, a warning
  row (icon `exclamationmark.triangle.fill`, `colors.warning`) with a
  **"Re-enable"** action calling `registerPriceCheckTask()` then re-assessing.
- **Home** — a dismissible banner when `stopped` or `stale`:
  *"Background monitoring may have stopped — tap to fix."* Tapping opens
  Settings. Dismissal is per-session (state, not persisted) so it reappears if
  the problem persists.

## Data Flow

1. The background task runs → `setLastBackgroundRun(now)`.
2. On foreground, `useMonitoringHealth` reads enabled/registered/lastRunAt/interval.
3. `assessMonitoringHealth` returns a status; the banner and Settings render it.
4. "Re-enable" re-registers the task and re-assesses.

## Error Handling

- Web / no TaskManager → `registered: false`, but `enabled` is also false on web
  (the toggle is mobile-only), so the status is `off` — no false alarm.
- `isTaskRegisteredAsync` throws → treat as `registered: false` (surface the
  warning; a false positive is safer than a silent miss).
- `lastRunAt` null + registered → `ok` (never a false "stopped").

## Testing

- `tests/monitoring-health.test.ts` — every branch: off; stopped; ok-never-run;
  stale at `> 2×`; ok within `2×`; boundary exactly at `2×` (not stale).
- `tests/last-background-run-storage.test.ts` — set/get round-trip; wiped by
  `clearAllData`.
- A source-guard test that the `PRICE_CHECK_TASK` handler calls
  `setLastBackgroundRun`, and that Settings/Home render the status.
- Existing background-task tests stay green.

## Success Criteria

- With the toggle on and the task unregistered, Settings and Home show a
  re-enable warning.
- With the task running and fresh, no warning; Settings shows "Last checked: X ago".
- Web shows nothing (status `off`).
- `pnpm verify` stays green.

## Risks

- **False "stopped"** → `registered` is read live; a throw is treated as
  unregistered (surface, not silence). `lastRunAt === null` is `ok`, never
  `stopped`.
- **Banner fatigue** → per-session dismissal; it only appears on a real problem.
- **Extra foreground reads** → four cheap storage/TaskManager calls per foreground.
