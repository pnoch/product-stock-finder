# Desktop Safety + Charts A11y Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Destructive delete needs typed confirmation; tour arrows work anywhere; charts announce summaries.

**Architecture:** Small additions in Settings (email-match gate), OnboardingModal (handler hoist), Compare/ProductDetail/Rates (svg labels). No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-safety-charts-design.md`

---

### Task 1: Guard tests for safety + charts

**Files:**
- Create: `tests/desktop-safety-charts.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop safety and charts", () => {
  it("gates account deletion on typed confirmation", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("deleteConfirmEmail");
    expect(text).toContain("Yes, delete everything");
  });

  it("navigates tour slides from anywhere in the dialog", async () => {
    const text = await readFile("desktop/src/components/OnboardingModal.tsx", "utf8");
    expect(text).toContain("onKeyDown");
    expect(text).not.toContain('role="group"\n          onKeyDown');
  });

  it("labels charts for screen readers", async () => {
    const compare = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const rates = await readFile("desktop/src/pages/Rates.tsx", "utf8");
    expect(compare).toContain("Price history,");
    expect(detail).toContain('role="img"');
    expect(rates).toContain('role="img"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-safety-charts.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — verify each string truly absent; the `not.toContain` with embedded newline must match the CURRENT dots-div markup exactly (read lines 92-94 first: `role="group"` newline + spaces + `onKeyDown` — copy the exact whitespace into the assertion; if it doesn't match, the negative assertion passes trivially and the test is weaker — still acceptable, report it).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-safety-charts.test.ts
git commit -m "test: guard desktop safety and charts a11y"
```

---

### Task 2: Two-step delete confirmation

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

Current block (lines ~1121-1156, read first): `!deleteConfirm` → Delete button; else warning copy + Yes/Cancel + error. `user` object in scope (signed-in branch) with `email: string | null`.

- [ ] **Step 1: Add email-match state + gate**

```tsx
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
```
In the confirm branch, after the warning `<p>`, insert:
```tsx
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.email
                      ? `Type your email (${user.email}) to confirm.`
                      : "Type DELETE to confirm."}
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    placeholder={user?.email ? "Your email address" : "DELETE"}
                    className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    aria-label="Type to confirm account deletion"
                  />
```
Verify `user` variable name in this file (signed-in branch uses `user` — confirm). Gate the Yes button: `disabled={deleting || !isDeleteConfirmed}` where (place above return of the branch or inline):
```tsx
  const deleteExpected = user?.email ?? "DELETE";
  const isDeleteConfirmed =
    user?.email != null
      ? deleteConfirmEmail.trim().toLowerCase() === user.email.toLowerCase()
      : deleteConfirmEmail.trim() === "DELETE";
```
Reset `setDeleteConfirmEmail("")` when opening confirm (in the Delete button onClick) and on Cancel.

- [ ] **Step 2: Verify**

Run: `pnpm vitest run tests/desktop-safety-charts.test.ts -t "typed confirmation"` (passes; others fail) and `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: typed confirmation for desktop account deletion. TypeScript: 0 errors."
```

---

### Task 3: Dialog-wide tour keys

**Files:**
- Modify: `desktop/src/components/OnboardingModal.tsx`

Current (lines ~80-97, read first): content `<div className="flex flex-col items-center text-center">`, dots div with `role="group"` + `onKeyDown` (ArrowRight/Left with bounds).

- [ ] **Step 1: Hoist the handler**

Move the existing `onKeyDown` (verbatim logic) from the dots div to the outer content div (`flex flex-col items-center text-center`). Dots div keeps `role="group"` + `aria-label` (remove ONLY the onKeyDown prop). Tab order, buttons, dots unchanged.

- [ ] **Step 2: Verify**

Run: `pnpm vitest run tests/desktop-safety-charts.test.ts -t "anywhere in the dialog"` — hmm, test names: second test is "navigates tour slides from anywhere in the dialog". Use `-t "anywhere in the dialog"` (passes) and `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/components/OnboardingModal.tsx
git commit -m "Fix: tour arrow keys work from anywhere in the dialog. TypeScript: 0 errors."
```

---

### Task 4: Chart labels

**Files:**
- Modify: `desktop/src/pages/Compare.tsx`, `desktop/src/pages/ProductDetail.tsx`, `desktop/src/pages/Rates.tsx`

- [ ] **Step 1: SeriesChart label**

Read SeriesChart (~lines 46-89): props `series: {label, color, data: {price, currency, date}[]}[]`, `displayCurrency`. It computes `sortedSeries` internally (read how). Add a memo:
```tsx
  const chartLabel = useMemo(() => {
    const downs = ...; // per-series first→last direction; count up/down/flat
    ...
    return `Price history, ${series.length} distributor${...}, trending ${...}`;
  }, [series]);
```
Keep it simple and truthful: count + overall direction by majority of per-series first→last moves (ties/flat → "mixed"). Read the data shape first (`sorted` arrays exist). Add to `<svg>`: `role="img"` + `aria-label={chartLabel}`. Verify `useMemo` imported.

- [ ] **Step 2: Sparkline labels**

ProductDetail sparkline (~line 75 `<svg width={w} height={h}>`): read surrounding data (trend values first/last in scope?) and add `role="img"` + `aria-label` with trend + first→last (e.g. `Price trend, up from X to Y` — use in-scope formatted values if available, else raw numbers; read first). Rates sparkline (~line 25-42): same treatment with its in-scope data.

- [ ] **Step 3: Verify**

Run: full guard file (all 3 pass) + `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Compare.tsx desktop/src/pages/ProductDetail.tsx desktop/src/pages/Rates.tsx
git commit -m "Feat: screen-reader labels for desktop charts. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 5 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
