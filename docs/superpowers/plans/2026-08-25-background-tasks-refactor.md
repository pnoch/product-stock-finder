# Background Tasks Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `lib/background-price-check.ts` (430 lines) into a thin barrel at the same path backed by a `lib/background-tasks/` directory of focused modules, preserving the public API byte-for-byte.

**Architecture:** Six modules under `lib/background-tasks/` (instances, health-alerts, health-collector, refresh-listing, price-check, tasks); the original file becomes a ~10-line barrel re-exporting the same 9 public names. Extraction order follows the dependency chain so every commit is green.

**Tech Stack:** React Native, Expo (TaskManager + BackgroundTask), TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/background-tasks/instances.ts` | Shared `healthService` + `breakerStore` singletons |
| `lib/background-tasks/health-alerts.ts` | `checkHealthAlerts` |
| `lib/background-tasks/health-collector.ts` | `createHealthCollector` |
| `lib/background-tasks/refresh-listing.ts` | `refreshListing` |
| `lib/background-tasks/price-check.ts` | `runPriceCheckCore`, `checkPriceDropsNow` |
| `lib/background-tasks/tasks.ts` | Task-name consts, both module-level `defineTask`s, register/sync functions |
| `lib/background-price-check.ts` | Barrel re-export (~10 lines, final task) |

**Public API invariant:** `@/lib/background-price-check` always exports exactly: `PRICE_CHECK_TASK`, `HEALTH_PROBE_TASK`, `createHealthCollector`, `runPriceCheckCore`, `registerPriceCheckTask`, `registerHealthProbeTask`, `syncBackgroundTasks`, `checkHealthAlerts`, `checkPriceDropsNow`.

**Dependency chain (no cycles):** instances ← health-alerts ← health-collector ← {refresh-listing, price-check} ← tasks. Each moved symbol is immediately re-imported into `lib/background-price-check.ts` so consumer imports stay valid at every commit.

---

## Task 1: Scaffold instances + health-alerts

**Files:**
- Create: `lib/background-tasks/instances.ts`
- Create: `lib/background-tasks/health-alerts.ts`
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Create `lib/background-tasks/instances.ts`**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createHealthService } from "../scrapers/health";
import { createStorageBreakerStore } from "../scrapers/resilient";

export const healthService = createHealthService(AsyncStorage);
export const breakerStore = createStorageBreakerStore(AsyncStorage);
```

- [ ] **Step 2: Create `lib/background-tasks/health-alerts.ts`**

Move `checkHealthAlerts` VERBATIM from `lib/background-price-check.ts` (keep the dynamic `import("./server-notifications")` calls exactly as-is):

```typescript
import { getSettings } from "../storage";
import {
  createHealthService,
  detectHealthAlert,
  detectHealthRecovery,
} from "../scrapers/health";
import { getDistributorById } from "../distributors";
import {
  scheduleHealthAlert,
  scheduleHealthRecovery,
} from "../notifications";
import { healthService } from "./instances";

export async function checkHealthAlerts(
  service: ReturnType<typeof createHealthService> = healthService,
) {
  // ... paste the function body verbatim from lines 380-419 ...
}
```

- [ ] **Step 3: Rewire `lib/background-price-check.ts`**

1. Delete the local `healthService`/`breakerStore` const declarations and the `checkHealthAlerts` function.
2. Add:
```typescript
import { healthService, breakerStore } from "./background-tasks/instances";
import { checkHealthAlerts } from "./background-tasks/health-alerts";
export { checkHealthAlerts } from "./background-tasks/health-alerts";
```
(The plain import is needed because `createHealthCollector`'s default arg and the HEALTH_PROBE_TASK body reference `healthService`/`checkHealthAlerts`; the re-export keeps the public surface.)
3. Remove now-unused imports (`detectHealthAlert`, `detectHealthRecovery`, `scheduleHealthAlert`, `scheduleHealthRecovery`, `getDistributorById` — verify each is truly unused first).

- [ ] **Step 4: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/background-tasks lib/background-price-check.ts && git commit -m "refactor: scaffold background-tasks directory (instances, health alerts)"
```

---

## Task 2: Extract health-collector

**Files:**
- Create: `lib/background-tasks/health-collector.ts`
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Create `lib/background-tasks/health-collector.ts`**

Move `createHealthCollector` VERBATIM:

```typescript
import { createHealthService, DistributorHealth } from "../scrapers/health";
import { healthService as defaultHealthService } from "./instances";
import { checkHealthAlerts } from "./health-alerts";

export function createHealthCollector(
  service: ReturnType<typeof createHealthService> = defaultHealthService,
) {
  // ... paste the function body verbatim (record + flush) ...
}
```

- [ ] **Step 2: Rewire `lib/background-price-check.ts`**

1. Delete the local `createHealthCollector`.
2. Add: `export { createHealthCollector } from "./background-tasks/health-collector";`
   plus a plain import IF remaining code references it (`runPriceCheckCore` does — it calls `createHealthCollector()`; keep both import and re-export).
3. Remove now-unused imports (`createHealthService` type usage, `DistributorHealth` — verify).

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/background-tasks lib/background-price-check.ts && git commit -m "refactor: extract health collector"
```

---

## Task 3: Extract refresh-listing

**Files:**
- Create: `lib/background-tasks/refresh-listing.ts`
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Create `lib/background-tasks/refresh-listing.ts`**

Move `refreshListing` VERBATIM (private helper — not exported publicly, but export from this module for price-check to import):

```typescript
import {
  fetchServerPrice,
  uploadServerHistory,
} from "../server-prices";
import { getParserByDistributorId } from "../scrapers/registry";
import { resilientFetch } from "../scrapers/resilient";
import type { DistributorListing, PricePoint, Product } from "../types";
import { appendPricePoint, mergePriceHistory } from "../price-history";
import { PRICE_HISTORY_DAYS } from "@/shared/const";
import { breakerStore } from "./instances";
import type { createHealthCollector } from "./health-collector";

export async function refreshListing(
  product: Product,
  listing: DistributorListing,
  healthCollector: ReturnType<typeof createHealthCollector>,
): Promise<DistributorListing> {
  // ... paste the function body verbatim (server-first + scrape fallback) ...
}
```

- [ ] **Step 2: Rewire `lib/background-price-check.ts`**

1. Delete the local `refreshListing`.
2. Add plain import (NOT re-exported — it was private): `import { refreshListing } from "./background-tasks/refresh-listing";`
3. Remove now-unused imports (`fetchServerPrice` stays if used elsewhere — it isn't; `uploadServerHistory`, `getParserByDistributorId`, `resilientFetch`, `appendPricePoint`, `mergePriceHistory`, `PRICE_HISTORY_DAYS`, possibly `PricePoint` — verify each against remaining code).

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/background-tasks lib/background-price-check.ts && git commit -m "refactor: extract listing refresh"
```

---

## Task 4: Extract price-check core

**Files:**
- Create: `lib/background-tasks/price-check.ts`
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Create `lib/background-tasks/price-check.ts`**

Move `runPriceCheckCore` AND `checkPriceDropsNow` VERBATIM:

```typescript
import * as Notifications from "expo-notifications";
import {
  getAlerts,
  getSettings,
  getWatchlist,
  deactivateAlert,
  updateProductListings,
  getPriceDigestSnapshot,
  savePriceDigestSnapshot,
} from "../storage";
import { convertPrice, formatPrice } from "../currency";
import { requestNotificationPermissions } from "../notifications";
import { checkRestocks } from "../restock";
import { maybeSendDigest } from "../price-digest";
import { syncServerNotifications } from "../server-notifications";
import type { DistributorListing } from "../types";
import { createHealthCollector } from "./health-collector";
import { refreshListing } from "./refresh-listing";

export async function runPriceCheckCore(opts?: {
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  // ... paste the body verbatim (batched scrape loop, restocks, digest, alert evaluation) ...
}

export async function checkPriceDropsNow(
  onProgress?: (current: number, total: number) => void,
) {
  // ... paste the body verbatim ...
}
```

- [ ] **Step 2: Rewire `lib/background-price-check.ts`**

1. Delete both functions.
2. Add:
```typescript
import {
  runPriceCheckCore,
  checkPriceDropsNow,
} from "./background-tasks/price-check";
export {
  runPriceCheckCore,
  checkPriceDropsNow,
} from "./background-tasks/price-check";
```
(Plain import needed: the PRICE_CHECK_TASK definition body calls `runPriceCheckCore()`.)
3. Remove now-unused imports (`getWatchlist`, `deactivateAlert`, `updateProductListings`, digest fns, `convertPrice`, `formatPrice`, `requestNotificationPermissions`, `Notifications`, `checkRestocks`, `maybeSendDigest`, `syncServerNotifications`, `DistributorListing` — verify each; `getSettings` STAYS for the register functions).

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/background-tasks lib/background-price-check.ts && git commit -m "refactor: extract price check core"
```

---

## Task 5: Extract tasks + convert to barrel + push

**Files:**
- Create: `lib/background-tasks/tasks.ts`
- Modify: `lib/background-price-check.ts` (becomes barrel)
- Modify: `todo.md`

- [ ] **Step 1: Create `lib/background-tasks/tasks.ts`**

Move the task-name consts, BOTH `TaskManager.defineTask` calls, and the three registration functions VERBATIM. The `defineTask` calls MUST remain at module top level (global scope):

```typescript
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";
import { getSettings } from "../storage";
import { healthService } from "./instances";
import { checkHealthAlerts } from "./health-alerts";
import { runPriceCheckCore } from "./price-check";

export const PRICE_CHECK_TASK = "price-drop-check";
export const HEALTH_PROBE_TASK = "health-probe";

// Must be defined in global scope, outside any component
TaskManager.defineTask(PRICE_CHECK_TASK, async () => {
  try {
    await runPriceCheckCore();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

TaskManager.defineTask(HEALTH_PROBE_TASK, async () => {
  try {
    await healthService.testAllDistributors();
    await checkHealthAlerts();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerPriceCheckTask() {
  // ... paste verbatim ...
}

export async function registerHealthProbeTask() {
  // ... paste verbatim ...
}

export async function syncBackgroundTasks() {
  // ... paste verbatim ...
}
```

- [ ] **Step 2: Convert `lib/background-price-check.ts` to a barrel**

Replace the ENTIRE file content with:

```typescript
export {
  PRICE_CHECK_TASK,
  HEALTH_PROBE_TASK,
  registerPriceCheckTask,
  registerHealthProbeTask,
  syncBackgroundTasks,
} from "./background-tasks/tasks";
export { createHealthCollector } from "./background-tasks/health-collector";
export {
  runPriceCheckCore,
  checkPriceDropsNow,
} from "./background-tasks/price-check";
export { checkHealthAlerts } from "./background-tasks/health-alerts";
```

This preserves all 9 public exports. Importing the barrel still evaluates `tasks.ts` module scope, so `defineTask` registration timing is unchanged.

- [ ] **Step 3: Full verification**

```bash
pnpm check   # 0 errors
pnpm lint    # no new errors
pnpm test    # all pass
wc -l lib/background-price-check.ts lib/background-tasks/*.ts
```

- [ ] **Step 4: Update `todo.md`**

Append Phase 78 section:

```markdown
## Phase 78: Background Tasks Refactor (v5.26)

- [x] Scaffold lib/background-tasks/ (shared singletons, health alerts)
- [x] Extract health collector
- [x] Extract listing refresh
- [x] Extract price check core (+ foreground entry)
- [x] Extract task definitions + registration, convert original to barrel
- [x] Public API unchanged (9 exports)
```

- [ ] **Step 5: Commit and push**

```bash
git add lib/background-tasks lib/background-price-check.ts todo.md && git commit -m "refactor: extract background task definitions, finalize barrel"
git push origin main
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| `lib/background-price-check.ts` | 430 lines / 1 file | ~10-line barrel + 6 focused modules |
| Public API | 9 exports | Identical |
| Consumer changes | — | 0 expected |
