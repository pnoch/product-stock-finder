# Scheduled Health Probes (v5.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically probe all 25 distributors on the existing `checkInterval` schedule so health history accumulates without manual "Test All" runs.

**Architecture:** Add a `HEALTH_PROBE_TASK` expo-background-task (registered alongside `PRICE_CHECK_TASK`) that runs `testAllDistributors()`. Upgrade `testAllDistributors()` to use `resilientFetch` (shared circuit-breaker store) via a new pure `classifyProbeOutcome` helper. History recording (`recordSample`) is unchanged from Phase 57.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, expo-background-task, expo-task-manager, AsyncStorage, vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-scheduled-health-probes-design.md`

---

### Task 1: `classifyProbeOutcome` helper

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/scrapers/health.test.ts`, update the imports at the top:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  classifyProbeOutcome,
  classifyResult,
  computeHealthStats,
  createHealthService,
  pruneHealthHistory,
} from "@/lib/scrapers/health";
import type {
  HealthHistory,
  HealthSample,
  HealthStatus,
} from "@/lib/scrapers/health";
import type { DistributorParser, ScrapeResult } from "@/lib/scrapers/types";
import { BLOCKED_MARKERS } from "@/lib/scrapers/resilient";
```

Append a new describe block at the end of the file:

```ts
describe("classifyProbeOutcome", () => {
  function mockParser(
    parsePrice: (html: string) => ScrapeResult | null,
  ): DistributorParser {
    return {
      id: "test-parser",
      baseUrl: "https://example.com",
      buildSearchUrl: () => "https://example.com/search?q=CRS326",
      parsePrice,
      rateLimitMs: 0,
    };
  }

  const workingParser = mockParser(() => ({
    price: 100,
    currency: "USD",
    stockStatus: "in_stock" as const,
    url: "x",
  }));

  it("maps ok outcome with a price to working", () => {
    expect(
      classifyProbeOutcome(
        { status: "ok", method: "plain", html: "<html></html>" },
        workingParser,
      ),
    ).toEqual({ status: "working" });
  });

  it("maps ok outcome without a price to error", () => {
    expect(
      classifyProbeOutcome(
        { status: "ok", method: "plain", html: "<html></html>" },
        mockParser(() => null),
      ),
    ).toEqual({ status: "error", reason: "no price found" });
  });

  it("maps blocked outcome to blocked", () => {
    expect(
      classifyProbeOutcome(
        { status: "blocked", method: "plain", error: "403 Forbidden" },
        workingParser,
      ),
    ).toEqual({ status: "blocked", reason: "403 Forbidden" });
  });

  it("maps skipped outcome to blocked with cooldown reason", () => {
    expect(
      classifyProbeOutcome({ status: "skipped", method: "none" }, workingParser),
    ).toEqual({ status: "blocked", reason: "in cooldown" });
  });

  it("maps error outcome to error", () => {
    expect(
      classifyProbeOutcome(
        { status: "error", method: "plain", error: "timeout" },
        workingParser,
      ),
    ).toEqual({ status: "error", reason: "timeout" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `classifyProbeOutcome` is not exported.

- [ ] **Step 3: Implement `classifyProbeOutcome`**

In `lib/scrapers/health.ts`, update the imports:

```ts
import type { DistributorParser, ScrapeResult } from "./types";
import { PARSERS } from "./registry";
import { fetchWithParser } from "./utils";
import { classifyFetchStatus } from "./resilient";
import type { FetchOutcome } from "./resilient";
import type { StorageAdapter } from "../storage";
```

Add after `classifyResult`:

```ts
export function classifyProbeOutcome(
  outcome: FetchOutcome,
  parser: DistributorParser,
): { status: HealthStatus; reason?: string } {
  if (outcome.status === "ok" && outcome.html) {
    const result = parser.parsePrice(outcome.html);
    const status = classifyResult(outcome.html, result);
    return { status, reason: status === "error" ? "no price found" : undefined };
  }
  if (outcome.status === "blocked") {
    return { status: "blocked", reason: outcome.error ?? "blocked by site" };
  }
  if (outcome.status === "skipped") {
    return { status: "blocked", reason: "in cooldown" };
  }
  return { status: "error", reason: outcome.error ?? "no price found" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: classifyProbeOutcome maps resilientFetch outcomes to health status"
```

---

### Task 2: Upgrade `testAllDistributors` to `resilientFetch`

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Update the module mock (failing test)**

In `tests/scrapers/health.test.ts`, replace the `vi.mock("@/lib/scrapers/utils", ...)` block:

```ts
vi.mock("@/lib/scrapers/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scrapers/utils")>();
  return {
    ...actual,
    fetchWithParser: vi.fn(async () => "<html>Access Denied</html>"),
  };
});
```

with:

```ts
vi.mock("@/lib/scrapers/resilient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/scrapers/resilient")>();
  return {
    ...actual,
    resilientFetch: vi.fn(async () => ({
      status: "ok",
      method: "plain",
      html: "<html>Access Denied</html>",
    })),
  };
});
```

Add `resilientFetch` to the imports from `@/lib/scrapers/resilient`:

```ts
import { BLOCKED_MARKERS, resilientFetch } from "@/lib/scrapers/resilient";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: FAIL — `testAllDistributors records history samples` fails because `testAllDistributors` still calls the real `fetchWithParser` (the utils mock was removed), hitting the network.

- [ ] **Step 3: Upgrade `testAllDistributors`**

In `lib/scrapers/health.ts`, update the imports (replace `import { fetchWithParser } from "./utils";` with the resilient imports):

```ts
import type { DistributorParser, ScrapeResult } from "./types";
import { PARSERS } from "./registry";
import {
  classifyFetchStatus,
  createStorageBreakerStore,
  resilientFetch,
} from "./resilient";
import type { FetchOutcome } from "./resilient";
import type { StorageAdapter } from "../storage";
```

Then replace the body of `testAllDistributors`:

```ts
  async function testAllDistributors(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DistributorHealth[]> {
    const results: DistributorHealth[] = [];
    const CONCURRENCY = 3;
    const total = PARSERS.length;
    const breakerStore = createStorageBreakerStore(adapter);

    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = PARSERS.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (parser) => {
          const start = Date.now();
          try {
            const url = parser.buildSearchUrl(PROBE_MODEL);
            const outcome = await resilientFetch({
              parser,
              url,
              state: breakerStore,
            });
            const { status, reason } = classifyProbeOutcome(outcome, parser);
            return {
              distributorId: parser.id,
              status,
              reason,
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            };
          } catch (error) {
            return {
              distributorId: parser.id,
              status: "error" as HealthStatus,
              reason: error instanceof Error ? error.message : String(error),
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            };
          }
        }),
      );
      results.push(...batchResults);
      onProgress?.(Math.min(i + CONCURRENCY, total), total);
    }

    await saveDistributorHealth(results);
    for (const r of results) {
      await recordSample(r.distributorId, r.status, r.reason);
    }
    return results;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS. The `testAllDistributors records history samples` test now uses the mocked `resilientFetch` (returns "Access Denied" html → all results `blocked`, and the assertion `samples[samples.length - 1].status === r.status` holds).

- [ ] **Step 5: Add an integration test for a blocked outcome**

Append inside the `createHealthService` describe block:

```ts
  it("testAllDistributors records blocked status for blocked outcome", async () => {
    vi.mocked(resilientFetch).mockImplementation(async () => ({
      status: "blocked",
      method: "plain",
      error: "403 Forbidden",
    }));
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    const results = await service.testAllDistributors();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.status === "blocked")).toBe(true);
    const history = await service.getHealthHistory();
    for (const r of results) {
      const samples = history[r.distributorId];
      expect(samples).toBeDefined();
      expect(samples[samples.length - 1].status).toBe("blocked");
    }
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/scrapers/health.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: testAllDistributors uses resilientFetch with shared circuit breakers"
```

---

### Task 3: `HEALTH_PROBE_TASK` + `registerHealthProbeTask`

**Files:**
- Modify: `lib/background-price-check.ts`
- Test: `tests/price-check.test.ts`

- [ ] **Step 1: Update the test mocks**

In `tests/price-check.test.ts`, update the hoisted state and `getSettings` mock so tests can control `checkInterval`. Add `settingsStore` to the hoisted state:

```ts
const state = vi.hoisted(() => ({
  alertsStore: [] as PriceAlert[],
  watchlistStore: [] as Product[],
  scheduledNotifications: [] as unknown[],
  permissionGranted: true,
  settingsStore: {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    priceAlerts: true,
    stockAlerts: true,
  },
}));
```

Replace the `getSettings` mock:

```ts
  getSettings: vi.fn(async () => state.settingsStore),
```

Update the `expo-task-manager` and `expo-background-task` mocks:

```ts
vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(async () => false),
}));
vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success", Failed: "failed" },
  registerTaskAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
}));
```

- [ ] **Step 2: Write the failing tests**

Update the import from `../lib/background-price-check`:

```ts
import {
  checkPriceDropsNow,
  createHealthCollector,
  registerHealthProbeTask,
} from "../lib/background-price-check";
import { createHealthService } from "../lib/scrapers/health";
import * as BackgroundTask from "expo-background-task";
```

Append a new describe block at the end of the file:

```ts
describe("registerHealthProbeTask", () => {
  beforeEach(() => {
    vi.mocked(BackgroundTask.registerTaskAsync).mockClear();
    vi.mocked(BackgroundTask.unregisterTaskAsync).mockClear();
  });

  it("registers with hourly interval when checkInterval is hourly", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "hourly" };
    await registerHealthProbeTask();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith("health-probe", {
      minimumInterval: 60,
    });
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it("registers with daily interval when checkInterval is daily", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "daily" };
    await registerHealthProbeTask();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith("health-probe", {
      minimumInterval: 1440,
    });
  });

  it("unregisters when checkInterval is manual", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "manual" };
    await registerHealthProbeTask();
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith("health-probe");
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/price-check.test.ts`
Expected: FAIL — `registerHealthProbeTask` is not exported from `../lib/background-price-check`.

- [ ] **Step 4: Implement the task + registration**

In `lib/background-price-check.ts`, add after `export const PRICE_CHECK_TASK = "price-drop-check";`:

```ts
export const HEALTH_PROBE_TASK = "health-probe";
```

Add after the `PRICE_CHECK_TASK` task definition (after the `TaskManager.defineTask(PRICE_CHECK_TASK, ...)` block):

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

Add after `registerPriceCheckTask`:

```ts
export async function registerHealthProbeTask() {
  if (Platform.OS === "web") return;
  try {
    const settings = await getSettings();
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(HEALTH_PROBE_TASK);

    if (settings.checkInterval === "manual") {
      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(HEALTH_PROBE_TASK);
      }
      return;
    }

    const intervalMinutes = settings.checkInterval === "hourly" ? 60 : 1440;

    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(HEALTH_PROBE_TASK, {
        minimumInterval: intervalMinutes,
      });
    } else {
      await BackgroundTask.unregisterTaskAsync(HEALTH_PROBE_TASK);
      await BackgroundTask.registerTaskAsync(HEALTH_PROBE_TASK, {
        minimumInterval: intervalMinutes,
      });
    }
  } catch {
    // Background tasks not available on simulator/web — silently ignore
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/price-check.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add lib/background-price-check.ts tests/price-check.test.ts
git commit -m "feat: scheduled health probe background task"
```

---

### Task 4: Wire registration into the app root

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update the import**

```ts
import {
  registerPriceCheckTask,
  registerHealthProbeTask,
  checkPriceDropsNow,
} from "@/lib/background-price-check";
```

- [ ] **Step 2: Call the registration**

In the `setupAndroidNotificationChannel().then(...)` block, add after `registerPriceCheckTask();`:

```ts
      registerPriceCheckTask();
      registerHealthProbeTask();
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: register health probe task on app launch"
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
Expected: all pass (existing 762 + new classifyProbeOutcome/registerHealthProbeTask tests).

- [ ] **Step 2: Update `todo.md`**

Append a Phase 58 section:

```markdown
## Phase 58: Scheduled Health Probes (v5.6)

- [x] HEALTH_PROBE_TASK background task probes all 25 distributors on the checkInterval schedule
- [x] testAllDistributors upgraded to resilientFetch with shared circuit-breaker store
- [x] classifyProbeOutcome maps fetch outcomes (ok/blocked/skipped/error) to health status
- [x] registerHealthProbeTask mirrors registerPriceCheckTask (manual unregisters, web no-op)
- [x] Tests: outcome mapping, task registration, history recording
```

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 58 scheduled health probes (v5.6) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `HEALTH_PROBE_TASK` + `registerHealthProbeTask` (Task 3), `testAllDistributors` resilientFetch upgrade (Task 2), shared breaker store via `createStorageBreakerStore(adapter)` (Task 2), registration wiring (Task 4), docs (Task 5). All four brainstorming decisions (client-side, reuse checkInterval, all distributors, resilientFetch) are implemented.
- **Type consistency:** `classifyProbeOutcome(outcome: FetchOutcome, parser: DistributorParser)` returns `{ status: HealthStatus; reason?: string }` — used identically in Task 2's `testAllDistributors`. `HEALTH_PROBE_TASK = "health-probe"` is defined once (Task 3) and referenced in both the task definition and registration. `state.settingsStore` shape matches the existing `getSettings` mock shape.
- **Test infra:** Task 2 replaces the `fetchWithParser` mock with a `resilientFetch` mock via `importOriginal` spread so `classifyFetchStatus` (used by `classifyResult`) stays real. Task 3 extends the existing `expo-task-manager`/`expo-background-task` mocks with `isTaskRegisteredAsync`/`unregisterTaskAsync` — backward-compatible with existing tests. The `testAllDistributors` integration test uses `vi.mocked(resilientFetch).mockImplementation` for a deterministic blocked outcome.
- **No snapshot changes:** `distributor_health`, `distributor_health_history`, and `distributor_breaker` keys are reused; no schema or sync changes.