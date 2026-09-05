# Rates Live-FX Parity Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile Rates screen auto-refreshes stale FX rates on mount (desktop parity) and imports `EXCHANGE_RATES` from `@shared/currency`.

**Architecture:** Two-line change in `app/(tabs)/rates.tsx` mirroring `desktop/src/pages/Rates.tsx:62-65`, plus a source-guard test in the style of `tests/shared-desktop-criticals.test.ts`. No new modules, no behavior changes beyond the mount refresh.

**Tech Stack:** Expo/React Native, TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-rates-live-fx-parity-design.md`

---

### Task 1: Guard test for mobile Rates parity

**Files:**
- Modify: `tests/shared-desktop-criticals.test.ts` (append new `it` inside the top-level `describe`, after the "uses live-rate currency" test)

- [ ] **Step 1: Write the failing test**

Append this test after the "uses live-rate currency on desktop pricing pages" test (after its closing `});`, still inside `describe("shared/desktop release blockers", ...)`):

```ts
  it("auto-refreshes stale FX rates on mobile Rates mount", async () => {
    const text = await readFile("app/(tabs)/rates.tsx", "utf8");
    expect(text).toContain("maybeRefreshFxRates");
    expect(text).not.toContain("@/lib/currency");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/shared-desktop-criticals.test.ts 2>&1 | tail -5`
Expected: FAIL — `expected '...' to contain 'maybeRefreshFxRates'` (the mobile screen currently imports only `refreshFxRates`).

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/shared-desktop-criticals.test.ts
git commit -m "test: guard mobile Rates mount FX refresh"
```

---

### Task 2: Mount refresh + shared import in mobile Rates

**Files:**
- Modify: `app/(tabs)/rates.tsx:7` (import line)
- Modify: `app/(tabs)/rates.tsx:10` (import line)
- Modify: `app/(tabs)/rates.tsx:24-26` (mount effect)

- [ ] **Step 1: Swap the EXCHANGE_RATES import to @shared/currency**

Old (`app/(tabs)/rates.tsx:7`):
```ts
import { EXCHANGE_RATES } from "@/lib/currency";
```
New:
```ts
import { EXCHANGE_RATES } from "@shared/currency";
```

- [ ] **Step 2: Import maybeRefreshFxRates from lib/fx**

Old (`app/(tabs)/rates.tsx:10`):
```ts
import { refreshFxRates } from "@/lib/fx";
```
New:
```ts
import { maybeRefreshFxRates, refreshFxRates } from "@/lib/fx";
```

- [ ] **Step 3: Fire mount refresh mirroring desktop**

Old (`app/(tabs)/rates.tsx:24-26`):
```ts
  useEffect(() => {
    loadData();
  }, [loadData]);
```
New:
```ts
  useEffect(() => {
    void maybeRefreshFxRates().catch(() => {});
    void loadData();
  }, [loadData]);
```

This matches `desktop/src/pages/Rates.tsx:62-65` exactly: concurrent fire-and-forget, errors swallowed, cached history renders immediately.

- [ ] **Step 4: Run the guard test to verify it passes**

Run: `pnpm vitest run tests/shared-desktop-criticals.test.ts 2>&1 | tail -4`
Expected: `Test Files 1 passed`, all tests pass.

- [ ] **Step 5: Typecheck**

Run: `pnpm check 2>&1 | tail -1`
Expected: clean (exit 0, no `error TS` lines).

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/rates.tsx" tests/shared-desktop-criticals.test.ts
git commit -m "Fix: auto-refresh stale FX on mobile Rates mount, EXCHANGE_RATES from @shared/currency. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm lint 2>&1 | tail -2`
Expected: no new warnings (pre-existing: `app/(tabs)/alerts.tsx:118`, `app/compare/[id].tsx:108`, `app/search.tsx` exhaustive-deps warnings — acceptable).

- [ ] **Step 2: Run full test suite**

Run: `pnpm test 2>&1 | grep -E "^ *(Test Files|Tests) "`
Expected: `Test Files 166+ passed`, `Tests 1361+ passed` (counts grow by the 1 new guard test).

- [ ] **Step 3: Push**

Run: `git push origin main 2>&1 | tail -1`
Expected: `main -> main` fast-forward.
