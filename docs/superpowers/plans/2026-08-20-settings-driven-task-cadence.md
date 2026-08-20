# Settings-Driven Background Task Cadence (v5.9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply `checkInterval` changes immediately by re-registering both the price-check and health-probe background tasks when the user changes the setting.

**Architecture:** Add `syncBackgroundTasks()` to `lib/background-price-check.ts` that calls `registerPriceCheckTask()` + `registerHealthProbeTask()`; call it from the settings screen's `updateSetting` when `key === "checkInterval"`. Launch-time registration in `app/_layout.tsx` stays unchanged.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81, Expo Router 6, expo-background-task, expo-task-manager, vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-settings-driven-task-cadence-design.md`

---

### Task 1: `syncBackgroundTasks` helper

**Files:**
- Modify: `lib/background-price-check.ts`
- Test: `tests/price-check.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/price-check.test.ts`, add `syncBackgroundTasks` to the import from `../lib/background-price-check`:

```ts
import {
  checkPriceDropsNow,
  createHealthCollector,
  registerHealthProbeTask,
  syncBackgroundTasks,
} from "../lib/background-price-check";
```

Append a new describe block at the end of the file:

```ts
describe("syncBackgroundTasks", () => {
  beforeEach(() => {
    vi.mocked(BackgroundTask.registerTaskAsync).mockClear();
    vi.mocked(BackgroundTask.unregisterTaskAsync).mockClear();
    state.taskRegistered = false;
    state.settingsStore = { ...state.settingsStore, checkInterval: "manual" };
  });

  it("registers both tasks with hourly interval when checkInterval is hourly", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "hourly" };
    await syncBackgroundTasks();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "price-drop-check",
      { minimumInterval: 60 },
    );
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "health-probe",
      { minimumInterval: 60 },
    );
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it("registers both tasks with daily interval when checkInterval is daily", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "daily" };
    await syncBackgroundTasks();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "price-drop-check",
      { minimumInterval: 1440 },
    );
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "health-probe",
      { minimumInterval: 1440 },
    );
  });

  it("unregisters both tasks when checkInterval is manual", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "manual" };
    state.taskRegistered = true;
    await syncBackgroundTasks();
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(
      "price-drop-check",
    );
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(
      "health-probe",
    );
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/price-check.test.ts`
Expected: FAIL — `syncBackgroundTasks` is not exported.

- [ ] **Step 3: Implement `syncBackgroundTasks`**

In `lib/background-price-check.ts`, add after `registerHealthProbeTask`:

```ts
export async function syncBackgroundTasks() {
  await registerPriceCheckTask();
  await registerHealthProbeTask();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/price-check.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/background-price-check.ts tests/price-check.test.ts
git commit -m "feat: syncBackgroundTasks re-registers both background tasks"
```

---

### Task 2: Settings hook

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add the import**

In `app/(tabs)/settings.tsx`, add `syncBackgroundTasks` to the imports from `@/lib/background-price-check`. If there is no existing import from that module, add a new import line after the other `@/lib/...` imports:

```tsx
import { syncBackgroundTasks } from "@/lib/background-price-check";
```

- [ ] **Step 2: Add the checkInterval hook in `updateSetting`**

In `updateSetting`, change:

```tsx
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await saveSettings(updated);
    },
```

to:

```tsx
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await saveSettings(updated);
      if (key === "checkInterval") {
        void syncBackgroundTasks();
      }
    },
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: re-register background tasks when checkInterval changes"
```

---

### Task 3: Docs + full verification

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean (only pre-existing MODULE_TYPELESS warning).

Run: `pnpm test`
Expected: all pass (existing 786 + new syncBackgroundTasks tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), rebuild the web export and verify:

```bash
npx expo export -p web --clear
```

Then in headed Chromium at `https://localhost:8443/settings`:
1. Tap a different check interval row (e.g. switch from Manual to Hourly) — the app does not crash and the selected row updates.
2. Reload — the selected interval persists.
3. Confirm the change is a web no-op (no background-task registration happens on web).

NOTE: The smoke test requires a headed browser and the smoke servers. If the smoke servers are not running or you cannot launch a headed browser, attempt to start them via the scripts in `/tmp/opencode/webpush/`. If you genuinely cannot complete the browser smoke test, report back clearly that it was skipped and why — do NOT fake results.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 61 section at the end of the file:

```markdown
## Phase 61: Settings-Driven Background Task Cadence (v5.9)

- [x] syncBackgroundTasks: re-registers price-check + health-probe tasks
- [x] Settings hook: re-register on checkInterval change (manual/hourly/daily)
- [x] Tests: syncBackgroundTasks (hourly, daily, manual)
```

- [ ] **Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: Phase 61 settings-driven task cadence (v5.9) in todo.md"
```

---

## Self-Review Notes

- **Spec coverage:** `syncBackgroundTasks` (Task 1), settings hook on `checkInterval` change (Task 2), docs + verification (Task 3). All three brainstorming decisions (both tasks, combined helper, settings hook) are implemented.
- **Type consistency:** `syncBackgroundTasks` is defined in Task 1 and imported in Task 2 with the same name. Task names `"price-drop-check"` and `"health-probe"` in tests match the exported constants `PRICE_CHECK_TASK`/`HEALTH_PROBE_TASK` (lib/background-price-check.ts:31-32) and the existing `registerHealthProbeTask` tests.
- **Test determinism:** the `syncBackgroundTasks` describe block reuses the same `beforeEach` reset pattern as the existing `registerHealthProbeTask` block (clears mocks, resets `state.taskRegistered` and `state.settingsStore`), so tests are order-independent.
- **No snapshot changes:** reads settings only; no schema, sync, or storage changes.