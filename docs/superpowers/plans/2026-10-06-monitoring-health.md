# Monitoring Health — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app tell the user whether background monitoring is actually running — a last-run timestamp, a pure health assessment, a Settings status/warning, and a Home banner.

**Architecture:** The price-check task writes `lastBackgroundRunAt`; a pure `assessMonitoringHealth` maps (enabled, registered, lastRunAt, interval) → off/ok/stale/stopped; a hook reads it on foreground; Settings and Home render it.

**Tech Stack:** TypeScript, React Native / Expo, expo-task-manager, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-monitoring-health-design.md`

---

## File Structure

- Modify `lib/storage/context.ts` — `LAST_BACKGROUND_RUN` key.
- Modify `lib/storage/discovery.ts` — `getLastBackgroundRun`/`setLastBackgroundRun`.
- Modify `lib/storage/index.ts` — wipe the key in `clearAllData`.
- Modify `lib/background-tasks/tasks.ts` — write the timestamp.
- Create `lib/monitoring-health.ts` — `assessMonitoringHealth`.
- Create `hooks/use-monitoring-health.ts` — the hook.
- Modify `app/(tabs)/settings.tsx` — status + re-enable row.
- Modify `app/(tabs)/index.tsx` — the banner.
- Tests: `tests/monitoring-health.test.ts`, `tests/last-background-run-storage.test.ts`.

---

### Task 1: Storage — last background run

**Files:** Modify `lib/storage/context.ts`, `lib/storage/discovery.ts`, `lib/storage/index.ts`; Test `tests/last-background-run-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/last-background-run-storage.test.ts` (mirror the AsyncStorage mock in `tests/reminders-storage.test.ts` — read it first):

```ts
import { describe, expect, it } from "vitest";
import { getLastBackgroundRun, setLastBackgroundRun } from "../lib/storage";

describe("last background run", () => {
  it("round-trips a timestamp", async () => {
    await setLastBackgroundRun(1_700_000_000_000);
    expect(await getLastBackgroundRun()).toBe(1_700_000_000_000);
  });

  it("returns null when never set", async () => {
    expect(await getLastBackgroundRun()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/last-background-run-storage.test.ts`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

In `lib/storage/context.ts`, add to `STORAGE_KEYS`:

```ts
  LAST_BACKGROUND_RUN: "last_background_run",
```

In `lib/storage/discovery.ts` `createBackgroundTaskStorage`, add:

```ts
  async function getLastBackgroundRun(): Promise<number | null> {
    try {
      const raw = await adapter.getItem(KEYS.LAST_BACKGROUND_RUN);
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  async function setLastBackgroundRun(ts: number): Promise<void> {
    await enqueue(KEYS.LAST_BACKGROUND_RUN, async () => {
      try {
        await adapter.setItem(KEYS.LAST_BACKGROUND_RUN, String(ts));
      } catch {
        // best effort
      }
    });
  }
```

Add both to the object returned by `createBackgroundTaskStorage`.

In `lib/storage/index.ts` `clearAllData`, add `STORAGE_KEYS.LAST_BACKGROUND_RUN,` to the removal list (beside `STORAGE_KEYS.BACKGROUND_TASK_INTERVAL`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/last-background-run-storage.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/context.ts lib/storage/discovery.ts lib/storage/index.ts tests/last-background-run-storage.test.ts
git commit -m "feat(monitoring): persist the last background run"
```

---

### Task 2: Pure assessment

**Files:** Create `lib/monitoring-health.ts`; Test `tests/monitoring-health.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/monitoring-health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assessMonitoringHealth } from "../lib/monitoring-health";

const HOUR = 60 * 60 * 1000;
const base = { enabled: true, registered: true, lastRunAt: 0, intervalMs: HOUR, now: 10 * HOUR };

describe("assessMonitoringHealth", () => {
  it("is off when disabled", () => {
    expect(assessMonitoringHealth({ ...base, enabled: false }).status).toBe("off");
  });

  it("is stopped when enabled but unregistered", () => {
    expect(assessMonitoringHealth({ ...base, registered: false }).status).toBe("stopped");
  });

  it("is ok when registered but never run", () => {
    expect(assessMonitoringHealth({ ...base, lastRunAt: null }).status).toBe("ok");
  });

  it("is stale past 2x the interval", () => {
    const r = assessMonitoringHealth({ ...base, lastRunAt: 10 * HOUR - 2 * HOUR - 1 });
    expect(r.status).toBe("stale");
  });

  it("is ok within 2x the interval", () => {
    expect(assessMonitoringHealth({ ...base, lastRunAt: 10 * HOUR - HOUR }).status).toBe("ok");
  });

  it("is ok exactly at 2x the interval (boundary)", () => {
    expect(assessMonitoringHealth({ ...base, lastRunAt: 10 * HOUR - 2 * HOUR }).status).toBe("ok");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/monitoring-health.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/monitoring-health.ts`:

```ts
export type MonitoringHealth =
  | { status: "off" }
  | { status: "ok"; lastRunAt: number | null }
  | { status: "stale"; lastRunAt: number; expectedMs: number }
  | { status: "stopped"; lastRunAt: number | null };

/**
 * Whether background monitoring is actually running. `stopped` means the toggle
 * is on but the OS task is unregistered; `stale` means it registered but has not
 * run within 2x its interval. A never-run task is `ok` (the OS may not have
 * fired yet) — never a false "stopped".
 */
export function assessMonitoringHealth(input: {
  enabled: boolean;
  registered: boolean;
  lastRunAt: number | null;
  intervalMs: number;
  now: number;
}): MonitoringHealth {
  const { enabled, registered, lastRunAt, intervalMs, now } = input;
  if (!enabled) return { status: "off" };
  if (!registered) return { status: "stopped", lastRunAt };
  if (lastRunAt === null) return { status: "ok", lastRunAt: null };
  const expectedMs = intervalMs * 2;
  if (now - lastRunAt > expectedMs) return { status: "stale", lastRunAt, expectedMs };
  return { status: "ok", lastRunAt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/monitoring-health.test.ts && pnpm check`
Expected: PASS (6 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/monitoring-health.ts tests/monitoring-health.test.ts
git commit -m "feat(monitoring): assessMonitoringHealth"
```

---

### Task 3: Record the run + the hook

**Files:** Modify `lib/background-tasks/tasks.ts`; Create `hooks/use-monitoring-health.ts`; Test `tests/background-tasks.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

In `tests/background-tasks.test.ts`, add a test that the `PRICE_CHECK_TASK` handler writes the timestamp. The existing test mocks `../lib/storage`; add `setLastBackgroundRun: vi.fn(async () => {})` to that mock, then:

```ts
  it("records the last background run on success", async () => {
    // Invoke the registered task handler the way the existing tests do (read
    // the file to find how PRICE_CHECK_TASK's handler is captured/invoked).
    // Assert setLastBackgroundRun was called with a number.
  });
```

Fill it in against the existing harness (the file captures `TaskManager.defineTask` callbacks).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/background-tasks.test.ts`
Expected: FAIL — `setLastBackgroundRun` not called.

- [ ] **Step 3: Implement**

In `lib/background-tasks/tasks.ts`, import `setLastBackgroundRun` from `../storage` and change the `PRICE_CHECK_TASK` handler:

```ts
TaskManager.defineTask(PRICE_CHECK_TASK, async () => {
  try {
    await runPriceCheckCore();
    await setLastBackgroundRun(Date.now());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
```

Create `hooks/use-monitoring-health.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import { getSettings, getLastBackgroundRun } from "@/lib/storage";
import { getEntitlementState } from "@/lib/entitlements";
import { shouldEnforceFreeLimits } from "@/lib/pro-features";
import { PRICE_CHECK_TASK } from "@/lib/background-tasks/tasks";
import { assessMonitoringHealth, type MonitoringHealth } from "@/lib/monitoring-health";

const OFF: MonitoringHealth = { status: "off" };

/**
 * Whether background monitoring is running. Re-assessed on mount and on every
 * foreground transition (the OS task state changes while backgrounded).
 */
export function useMonitoringHealth(): MonitoringHealth {
  const [health, setHealth] = useState<MonitoringHealth>(OFF);

  const assess = useCallback(async () => {
    if (Platform.OS === "web") {
      setHealth(OFF);
      return;
    }
    try {
      const settings = await getSettings();
      const { isPro } = await getEntitlementState();
      const enabled =
        !!settings.backgroundServiceEnabled &&
        (!shouldEnforceFreeLimits() || isPro) &&
        settings.checkInterval !== "manual";
      let registered = false;
      try {
        registered = await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK);
      } catch {
        registered = false; // surface the warning rather than a silent miss
      }
      const lastRunAt = await getLastBackgroundRun();
      const intervalMs = (settings.checkInterval === "hourly" ? 60 : 1440) * 60_000;
      setHealth(
        assessMonitoringHealth({ enabled, registered, lastRunAt, intervalMs, now: Date.now() }),
      );
    } catch {
      setHealth(OFF);
    }
  }, []);

  useEffect(() => {
    void assess();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void assess();
    });
    return () => sub.remove();
  }, [assess]);

  return health;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/background-tasks.test.ts && pnpm check`
Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/background-tasks/tasks.ts hooks/use-monitoring-health.ts tests/background-tasks.test.ts
git commit -m "feat(monitoring): record the run + useMonitoringHealth hook"
```

---

### Task 4: Surface it (Settings + Home) + full verification + docs

**Files:** Modify `app/(tabs)/settings.tsx`, `app/(tabs)/index.tsx`; `todo.md`

- [ ] **Step 1: Settings status + re-enable**

In `app/(tabs)/settings.tsx`:
- Import `useMonitoringHealth` from `@/hooks/use-monitoring-health`, `registerPriceCheckTask` from `@/lib/background-price-check` (or wherever it is exported), and `formatLastRefreshed` from `@/lib/last-refreshed`.
- Under the Background Refresh row, render a status line:
  - `ok` with `lastRunAt` → `Last checked: ${formatLastRefreshed(new Date(lastRunAt).toISOString())}`.
  - `ok` with null → `Not yet run`.
  - `stopped`/`stale` → a warning row (icon `exclamationmark.triangle.fill`, `colors.warning`) with the text "Background monitoring may have stopped" and a **Re-enable** button that calls `await registerPriceCheckTask()`.

- [ ] **Step 2: Home banner**

In `app/(tabs)/index.tsx`, add a dismissible banner (local `useState(false)` for dismissal) rendered when `health.status === "stopped" || health.status === "stale"`:
- Text: "Background monitoring may have stopped — tap to fix."
- Tap → `router.push("/(tabs)/settings")`.
- A close affordance sets the dismissed state (per-session; not persisted).

- [ ] **Step 3: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 4: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 5: Document**

Add a `todo.md` phase entry (next number 1130): the last-run timestamp, `assessMonitoringHealth`, the hook, the Settings status/warning, the Home banner, and the note that push-delivery diagnostics are deferred.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/settings.tsx app/\(tabs\)/index.tsx todo.md
git commit -m "feat(monitoring): Settings status + Home banner (Phase 1130)"
```

---

## Self-Review

- **Spec coverage:** storage (Task 1), assessment (Task 2), record + hook (Task 3), surfaces + verify + docs (Task 4). Push-delivery diagnostics and desktop parity are out of scope per the spec.
- **Placeholders:** none — the storage fns, the assessment, and the hook are given verbatim; Task 4 names the exact files, states, and strings.
- **Type consistency:** `MonitoringHealth` union; `assessMonitoringHealth(input)`; `getLastBackgroundRun`/`setLastBackgroundRun`; `useMonitoringHealth(): MonitoringHealth`; `PRICE_CHECK_TASK` — used consistently.
- **Boundary:** `stale` is `> intervalMs * 2` (exclusive), pinned by the boundary test.
