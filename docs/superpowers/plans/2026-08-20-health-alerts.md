# Health Alerts (v5.11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify the user when a distributor transitions to `blocked` or `error` for 3 consecutive probes, deduped per outage and re-armed on recovery.

**Architecture:** Add a pure `detectHealthAlert` helper in `lib/scrapers/health.ts`, a `scheduleHealthAlert` notification in `lib/notifications.ts`, and a `checkHealthAlerts()` orchestrator in `lib/background-price-check.ts` called from both probe paths. Add a `healthAlerts` setting (type + default + Settings toggle).

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, expo-notifications, vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-health-alerts-design.md`

---

### Task 1: `detectHealthAlert` helper

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/scrapers/health.test.ts`, add `detectHealthAlert` to the imports from `@/lib/scrapers/health`:

```ts
import {
  classifyProbeOutcome,
  classifyResult,
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  detectHealthAlert,
  groupSamplesByDay,
  pruneHealthHistory,
  timelineSegments,
} from "@/lib/scrapers/health";
```

Append a new describe block at the end of the file:

```ts
describe("detectHealthAlert", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns false with fewer than threshold + 1 samples", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(false);
  });

  it("returns true when exactly 3 consecutive non-working follow a working sample", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("blocked", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("blocked", "2026-08-01T03:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(true);
  });

  it("returns false when the streak is longer than threshold (no re-fire)", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("error", "2026-08-01T04:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(false);
  });

  it("returns true again after recovery and a new outage", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T04:00:00Z"),
      sample("blocked", "2026-08-01T05:00:00Z"),
      sample("error", "2026-08-01T06:00:00Z"),
      sample("blocked", "2026-08-01T07:00:00Z"),
    ];
    expect(detectHealthAlert(samples)).toBe(true);
  });

  it("respects a custom threshold", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthAlert(samples, 2)).toBe(true);
    expect(detectHealthAlert(samples, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `detectHealthAlert` is not exported.

- [ ] **Step 3: Implement `detectHealthAlert`**

In `lib/scrapers/health.ts`, add after `groupSamplesByDay`:

```ts
export const HEALTH_ALERT_THRESHOLD = 3;

export function detectHealthAlert(
  samples: HealthSample[],
  threshold = HEALTH_ALERT_THRESHOLD,
): boolean {
  if (samples.length < threshold + 1) return false;
  const lastN = samples.slice(-threshold);
  const before = samples[samples.length - threshold - 1];
  return (
    lastN.every((s) => s.status !== "working") &&
    before.status === "working"
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: detectHealthAlert for consecutive outage detection"
```

---

### Task 2: `scheduleHealthAlert` notification

**Files:**
- Modify: `lib/notifications.ts`

- [ ] **Step 1: Add the import**

In `lib/notifications.ts`, add `HEALTH_ALERT_THRESHOLD` and `HealthStatus` to the imports from `@/lib/scrapers/health`:

```ts
import { HEALTH_ALERT_THRESHOLD, HealthStatus } from "./scrapers/health";
```

- [ ] **Step 2: Add `scheduleHealthAlert`**

Add after `scheduleStockAlert` (which ends around line 81):

```ts
// ─── Schedule a distributor health alert ─────────────────────────────────────
export async function scheduleHealthAlert(
  distributorName: string,
  status: HealthStatus,
  reason?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title:
          status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down",
        body: `${distributorName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`,
        data: { type: "health_alert", distributorName, status },
        sound: "default",
      },
      trigger: null, // immediate
    });
    return id;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 4: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: scheduleHealthAlert notification"
```

---

### Task 3: `checkHealthAlerts` + wiring

**Files:**
- Modify: `lib/background-price-check.ts`
- Test: `tests/price-check.test.ts`

- [ ] **Step 1: Update imports**

In `lib/background-price-check.ts`:

1. Add `detectHealthAlert` to the import from `./scrapers/health`:

```ts
import {
  createHealthService,
  detectHealthAlert,
  DistributorHealth,
} from "./scrapers/health";
```

2. Add `getDistributorById` import from `./distributors`:

```ts
import { getDistributorById } from "./distributors";
```

3. Add `scheduleHealthAlert` to the import from `./notifications`:

```ts
import { requestNotificationPermissions, scheduleHealthAlert } from "./notifications";
```

- [ ] **Step 2: Write the failing tests**

In `tests/price-check.test.ts`:

1. Add `healthAlerts: true` to the hoisted `state.settingsStore`:

```ts
  settingsStore: {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
  },
```

2. Add `scheduleHealthAlert` to the `../lib/notifications` mock factory:

```ts
vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => state.permissionGranted),
  scheduleHealthAlert: vi.fn(async () => "notif-id"),
}));
```

3. Add `checkHealthAlerts` to the import from `../lib/background-price-check`:

```ts
import {
  checkHealthAlerts,
  checkPriceDropsNow,
  createHealthCollector,
  registerHealthProbeTask,
  syncBackgroundTasks,
} from "../lib/background-price-check";
```

4. Add a mock service helper after the `makeAlert` function:

```ts
function mockHealthService(history: Record<string, HealthSample[]>) {
  return {
    getHealthHistory: vi.fn(async () => history),
  } as unknown as ReturnType<typeof createHealthService>;
}
```

5. Append a new describe block at the end of the file:

```ts
describe("checkHealthAlerts", () => {
  beforeEach(() => {
    vi.mocked(scheduleHealthAlert).mockClear();
    state.settingsStore = {
      ...state.settingsStore,
      notificationsEnabled: true,
      healthAlerts: true,
    };
  });

  it("fires scheduleHealthAlert when a distributor triggers", async () => {
    const history = {
      "winncom-us": [
        { status: "working", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "error", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthAlert).toHaveBeenCalledTimes(1);
  });

  it("does not fire when notificationsEnabled is false", async () => {
    state.settingsStore = {
      ...state.settingsStore,
      notificationsEnabled: false,
    };
    await checkHealthAlerts(mockHealthService({}));
    expect(scheduleHealthAlert).not.toHaveBeenCalled();
  });

  it("does not fire when healthAlerts is false", async () => {
    state.settingsStore = { ...state.settingsStore, healthAlerts: false };
    await checkHealthAlerts(mockHealthService({}));
    expect(scheduleHealthAlert).not.toHaveBeenCalled();
  });

  it("does not fire when no distributor triggers", async () => {
    const history = {
      "winncom-us": [
        { status: "working", at: "2026-08-01T00:00:00Z" },
        { status: "working", at: "2026-08-01T01:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthAlert).not.toHaveBeenCalled();
  });
});
```

NOTE: `HealthSample` and `createHealthService` are already imported in this test file (line 93 imports `createHealthService`; `HealthSample` is imported from `../lib/types` or `../lib/scrapers/health` — if `HealthSample` is not already imported, add it to the `createHealthService` import line: `import { createHealthService } from "../lib/scrapers/health";` becomes `import { createHealthService, HealthSample } from "../lib/scrapers/health";`).

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/price-check.test.ts`
Expected: FAIL — `checkHealthAlerts` is not exported.

- [ ] **Step 4: Implement `checkHealthAlerts`**

In `lib/background-price-check.ts`, add after `syncBackgroundTasks`:

```ts
export async function checkHealthAlerts(
  service: ReturnType<typeof createHealthService> = healthService,
) {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !settings.healthAlerts) return;
    const history = await service.getHealthHistory();
    for (const [distributorId, samples] of Object.entries(history)) {
      if (!detectHealthAlert(samples)) continue;
      const distributor = getDistributorById(distributorId);
      const latest = samples[samples.length - 1];
      await scheduleHealthAlert(
        distributor?.name ?? distributorId,
        latest.status,
        latest.reason,
      );
    }
  } catch {
    // Ignore alert errors
  }
}
```

- [ ] **Step 5: Wire into the probe task**

In the `HEALTH_PROBE_TASK` body, change:

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

to:

```ts
TaskManager.defineTask(HEALTH_PROBE_TASK, async () => {
  try {
    await healthService.testAllDistributors();
    await checkHealthAlerts();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
```

- [ ] **Step 6: Wire into the collector flush**

In `createHealthCollector`'s `flush`, after the `recordSample` loop (after the `for (const [id, entry] of updates)` loop that calls `service.recordSample`), add:

```ts
        await checkHealthAlerts(service);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/price-check.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 9: Commit**

```bash
git add lib/background-price-check.ts tests/price-check.test.ts
git commit -m "feat: checkHealthAlerts fires on consecutive distributor outages"
```

---

### Task 4: `healthAlerts` setting

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/storage.ts`
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add the field to `AppSettings`**

In `lib/types.ts`, in the `AppSettings` interface, add after `priceAlerts: boolean;`:

```ts
  healthAlerts: boolean;
```

- [ ] **Step 2: Add the default**

In `lib/storage.ts`, in `DEFAULT_SETTINGS`, add after `priceAlerts: true,`:

```ts
    healthAlerts: true,
```

- [ ] **Step 3: Add the Settings toggle**

In `app/(tabs)/settings.tsx`, after the "Price Alerts" `SettingRow` (which ends around line 1093), add:

```tsx
          <SettingRow
            icon="exclamationmark.triangle.fill"
            label="Health Alerts"
            description="Notify when a distributor is blocked or down"
            right={
              <Switch
                value={settings.healthAlerts}
                onValueChange={(v) => updateSetting("healthAlerts", v)}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "88",
                }}
                thumbColor={
                  settings.healthAlerts ? colors.primary : colors.muted
                }
              />
            }
          />
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage.ts app/(tabs)/settings.tsx
git commit -m "feat: healthAlerts settings toggle"
```

---

### Task 5: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 789 + new detectHealthAlert/checkHealthAlerts tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/settings`:
1. The "Health Alerts" toggle renders with a warning icon and defaults to on.
2. Toggling it off and reloading persists the off state.
3. No console errors during the interaction.

NOTE: The smoke test requires a headed browser and the smoke servers. If the smoke servers are not running or you cannot launch a headed browser, attempt to start them via the scripts in `/tmp/opencode/webpush/`. If you genuinely cannot complete the browser smoke test, report back clearly that it was skipped and why — do NOT fake results.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 63 section at the end of the file:

```markdown
## Phase 63: Health Alerts (v5.11)

- [x] detectHealthAlert: fires on 3 consecutive blocked/error after working
- [x] scheduleHealthAlert notification (web-guarded, immediate)
- [x] checkHealthAlerts wired into probe task + collector flush
- [x] healthAlerts settings toggle (default on)
- [x] Tests: detectHealthAlert, checkHealthAlerts
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 63 health alerts (v5.11) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `detectHealthAlert` (Task 1), `scheduleHealthAlert` (Task 2), `checkHealthAlerts` + both call sites (Task 3), `healthAlerts` setting + toggle (Task 4), docs + verification (Task 5). All four brainstorming decisions (blocked+error, 3 consecutive, new toggle, Approach A) are implemented.
- **Type consistency:** `detectHealthAlert(samples, threshold = HEALTH_ALERT_THRESHOLD)` defined in Task 1, used identically in Task 3. `scheduleHealthAlert(distributorName, status, reason)` defined in Task 2, called in Task 3 with `(distributor?.name ?? distributorId, latest.status, latest.reason)`. `healthAlerts: boolean` added to `AppSettings` in Task 4, referenced in Task 3 (`settings.healthAlerts`) and Task 4's toggle.
- **Deviation from spec code:** the spec's `checkHealthAlerts()` used the module-level `healthService` with no parameter. The plan adds an optional `service` parameter (defaulting to `healthService`), mirroring the existing `createHealthCollector(service = healthService)` pattern, so tests can inject a mock service. The collector flush passes its own `service` so alerts use the same storage the collector just wrote.
- **Test determinism:** `detectHealthAlert` tests use fixed timestamps; `checkHealthAlerts` tests use the existing hoisted `state.settingsStore` + mocked `scheduleHealthAlert`, with `mockClear()` in `beforeEach` for order-independence.
- **No snapshot changes:** reads history + settings only; no schema, sync, or storage-key changes beyond the new settings field (backward compatible via `DEFAULT_SETTINGS` merge).