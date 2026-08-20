# Health Alert Recovery Notifications (v5.12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify the user when a distributor recovers after being down (blocked or error) for 3 consecutive probes, completing the health-alert loop from Phase 63.

**Architecture:** Add a pure `detectHealthRecovery` helper in `lib/scrapers/health.ts` (symmetric to the existing `detectHealthAlert`), a `scheduleHealthRecovery` notification in `lib/notifications.ts`, and extend the existing `checkHealthAlerts()` loop in `lib/background-price-check.ts` to also fire recovery notifications. Both checks share the existing `healthAlerts` setting guard.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, expo-notifications, vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-health-alert-recovery-design.md`

---

### Task 1: `detectHealthRecovery` helper

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/scrapers/health.test.ts`, add `detectHealthRecovery` to the imports from `@/lib/scrapers/health` (the first import block, lines 2-12):

```ts
import {
  classifyProbeOutcome,
  classifyResult,
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  detectHealthAlert,
  detectHealthRecovery,
  groupSamplesByDay,
  pruneHealthHistory,
  timelineSegments,
} from "@/lib/scrapers/health";
```

Append a new describe block at the end of the file (after the existing `detectHealthAlert` describe block):

```ts
describe("detectHealthRecovery", () => {
  function sample(status: HealthStatus, at: string): HealthSample {
    return { status, at };
  }

  it("returns false with fewer than threshold + 1 samples", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("working", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("returns true when last working follows exactly 3 non-working", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("working", "2026-08-01T03:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(true);
  });

  it("returns true when last working follows a longer streak (4+ non-working)", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T04:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(true);
  });

  it("returns false when last sample is non-working", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("error", "2026-08-01T03:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("returns false when the preceding streak is shorter than threshold (blip)", () => {
    const samples = [
      sample("working", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("working", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("does not re-fire on consecutive working samples", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("error", "2026-08-01T02:00:00Z"),
      sample("working", "2026-08-01T03:00:00Z"),
      sample("working", "2026-08-01T04:00:00Z"),
    ];
    expect(detectHealthRecovery(samples)).toBe(false);
  });

  it("respects a custom threshold", () => {
    const samples = [
      sample("error", "2026-08-01T00:00:00Z"),
      sample("error", "2026-08-01T01:00:00Z"),
      sample("working", "2026-08-01T02:00:00Z"),
    ];
    expect(detectHealthRecovery(samples, 2)).toBe(true);
    expect(detectHealthRecovery(samples, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `detectHealthRecovery` is not exported.

- [ ] **Step 3: Implement `detectHealthRecovery`**

In `lib/scrapers/health.ts`, add immediately after the existing `detectHealthAlert` function (which ends around line 215):

```ts
export function detectHealthRecovery(
  samples: HealthSample[],
  threshold = HEALTH_ALERT_THRESHOLD,
): boolean {
  if (samples.length < threshold + 1) return false;
  const last = samples[samples.length - 1];
  const prevN = samples.slice(-(threshold + 1), -1);
  return (
    last.status === "working" &&
    prevN.every((s) => s.status !== "working")
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: detectHealthRecovery for outage-end detection"
```

---

### Task 2: `scheduleHealthRecovery` notification

**Files:**
- Modify: `lib/notifications.ts`

- [ ] **Step 1: Add `scheduleHealthRecovery`**

In `lib/notifications.ts`, add immediately after the existing `scheduleHealthAlert` function (which ends around line 107):

```ts
// ─── Schedule a distributor recovery notification ────────────────────────────
export async function scheduleHealthRecovery(
  distributorName: string,
  status: HealthStatus,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🟢 Distributor Recovered",
        body: `${distributorName} is back online after being ${status}`,
        data: { type: "health_recovery", distributorName, status },
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

`HEALTH_ALERT_THRESHOLD` and `HealthStatus` are already imported in this file (from Phase 63), so no import changes are needed.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 3: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: scheduleHealthRecovery notification"
```

---

### Task 3: Extend `checkHealthAlerts` for recovery

**Files:**
- Modify: `lib/background-price-check.ts`
- Test: `tests/price-check.test.ts`

- [ ] **Step 1: Update imports**

In `lib/background-price-check.ts`, add `detectHealthRecovery` to the import from `./scrapers/health`:

```ts
import {
  createHealthService,
  detectHealthAlert,
  detectHealthRecovery,
  DistributorHealth,
} from "./scrapers/health";
```

Add `scheduleHealthRecovery` to the import from `./notifications`:

```ts
import {
  requestNotificationPermissions,
  scheduleHealthAlert,
  scheduleHealthRecovery,
} from "./notifications";
```

- [ ] **Step 2: Write the failing tests**

In `tests/price-check.test.ts`:

1. Add `scheduleHealthRecovery` to the `../lib/notifications` mock factory:

```ts
vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => state.permissionGranted),
  scheduleHealthAlert: vi.fn(async () => "notif-id"),
  scheduleHealthRecovery: vi.fn(async () => "notif-id"),
}));
```

2. Add `scheduleHealthRecovery` to the existing import from `../lib/notifications`:

```ts
import { scheduleHealthAlert, scheduleHealthRecovery } from "../lib/notifications";
```

3. In the existing `checkHealthAlerts` describe block, add `scheduleHealthRecovery` to the `beforeEach` mockClear:

```ts
  beforeEach(() => {
    vi.mocked(scheduleHealthAlert).mockClear();
    vi.mocked(scheduleHealthRecovery).mockClear();
    state.settingsStore = {
      ...state.settingsStore,
      notificationsEnabled: true,
      healthAlerts: true,
    };
  });
```

4. Append new tests inside the existing `checkHealthAlerts` describe block (before its closing `});`):

```ts
  it("fires scheduleHealthRecovery when a distributor recovers", async () => {
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "error", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "working", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).toHaveBeenCalledTimes(1);
    expect(scheduleHealthRecovery).toHaveBeenCalledWith("Winncom", "error");
  });

  it("does not fire recovery when notificationsEnabled is false", async () => {
    state.settingsStore = {
      ...state.settingsStore,
      notificationsEnabled: false,
    };
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "error", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "working", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).not.toHaveBeenCalled();
  });

  it("does not fire recovery when healthAlerts is false", async () => {
    state.settingsStore = { ...state.settingsStore, healthAlerts: false };
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "error", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "working", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).not.toHaveBeenCalled();
  });

  it("does not fire recovery when no recovery in history", async () => {
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "working", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "error", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/price-check.test.ts`
Expected: FAIL — the new recovery tests fail because `checkHealthAlerts` doesn't call `scheduleHealthRecovery` yet.

- [ ] **Step 4: Implement the recovery check**

In `lib/background-price-check.ts`, replace the body of the `checkHealthAlerts` for-loop:

```ts
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
```

with:

```ts
    for (const [distributorId, samples] of Object.entries(history)) {
      const distributor = getDistributorById(distributorId);
      const name = distributor?.name ?? distributorId;
      if (detectHealthAlert(samples)) {
        const latest = samples[samples.length - 1];
        await scheduleHealthAlert(name, latest.status, latest.reason);
      }
      if (detectHealthRecovery(samples)) {
        const prev = samples[samples.length - 2];
        await scheduleHealthRecovery(name, prev.status);
      }
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/price-check.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 7: Commit**

```bash
git add lib/background-price-check.ts tests/price-check.test.ts
git commit -m "feat: recovery notifications in checkHealthAlerts"
```

---

### Task 4: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 798 + new detectHealthRecovery/checkHealthAlerts-recovery tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `/tmp/opencode/webpush/https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/settings`:
1. The "Health Alerts" toggle still renders and defaults to on.
2. No console errors during load/interaction.

NOTE: This feature adds no new UI, so the smoke test is a regression check only. If the smoke servers are not running or you cannot launch a headed browser, attempt to start them via the scripts in `/tmp/opencode/webpush/`. If you genuinely cannot complete the browser smoke test, report back clearly that it was skipped and why — do NOT fake results.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 64 section at the end of the file:

```markdown
## Phase 64: Health Alert Recovery Notifications (v5.12)

- [x] detectHealthRecovery: fires when last working follows 3+ non-working
- [x] scheduleHealthRecovery notification (web-guarded, immediate)
- [x] checkHealthAlerts fires recovery + outage alerts (shared healthAlerts toggle)
- [x] Tests: detectHealthRecovery, checkHealthAlerts recovery
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 64 health alert recovery (v5.12) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `detectHealthRecovery` (Task 1), `scheduleHealthRecovery` (Task 2), extended `checkHealthAlerts` loop + shared guard (Task 3), docs + verification (Task 4). All three decisions (stateless symmetric, shared toggle, simple message) are implemented.
- **Type consistency:** `detectHealthRecovery(samples, threshold = HEALTH_ALERT_THRESHOLD)` defined in Task 1, used identically in Task 3. `scheduleHealthRecovery(distributorName, status)` defined in Task 2, called in Task 3 with `(name, prev.status)` where `prev = samples[samples.length - 2]`. `HealthStatus` and `HEALTH_ALERT_THRESHOLD` are already imported in `lib/notifications.ts` from Phase 63 — no import changes needed in Task 2.
- **Test determinism:** `detectHealthRecovery` tests use fixed timestamps; `checkHealthAlerts` recovery tests use the existing hoisted `state.settingsStore` + mocked `scheduleHealthRecovery`, with `mockClear()` in `beforeEach` for order-independence.
- **No snapshot changes:** reads history + settings only; no schema, sync, storage-key, or settings-UI changes.