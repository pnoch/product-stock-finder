# Desktop Table Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Screen readers get position, sort, trend, and toggle state from the watchlist table.

**Architecture:** Attribute-only additions in `desktop/src/pages/Watchlist.tsx` (table, thead, row renderer, toggles). No visual or structural changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-table-a11y-design.md`

---

### Task 1: Guard tests for table ARIA

**Files:**
- Create: `tests/desktop-table-a11y.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop table accessibility", () => {
  it("exposes virtual row position", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("aria-rowcount");
    expect(text).toContain("aria-rowindex");
  });

  it("exposes sort, trend, and toggle states", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("aria-sort");
    expect(text).toContain("Trend ");
    expect(text).toContain("aria-pressed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-table-a11y.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent; `aria-pressed` especially must not already exist in the file).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-table-a11y.test.ts
git commit -m "test: guard desktop table accessibility"
```

---

### Task 2: ARIA attributes

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

Read each site first; if markup differs materially, NEEDS_CONTEXT instead of guessing.

- [ ] **Step 1: Row position**

`<table ...>` → add `aria-rowcount={rows.length}` (verify `rows` is the descriptor array in scope at the table). Header branch: add `aria-rowindex={vr.index + 1}` on the header `<tr>` (the `vr` loop variable is in scope). `renderRow`: extend its `virtual` param usage — it already receives `{ ref, index }`; add `aria-rowindex={virtual ? virtual.index + 1 : undefined}` on the root `<tr>` (undefined → attribute omitted for any non-virtual callers, of which there should be none — verify).

- [ ] **Step 2: Sort state**

The 4 sortable `<th>`s (Name/Price/Trend/Last Updated, each wrapping a `handleSort("...")` button): add `aria-sort={sortKey === "<key>" ? (sortAsc ? "ascending" : "descending") : "none"}` with the matching key literal per header. Non-sortable headers untouched.

- [ ] **Step 3: Trend icons**

The trend `<span className="inline-flex items-center gap-1 text-sm">` → add `role="img"` + `aria-label={\`Trend ${trend}\`}` (`trend` is "up"|"down"|"flat" in scope).

- [ ] **Step 4: Filter toggles**

Status pills, region control, and in-stock toggle: add `aria-pressed={...active condition...}` matching each control's existing active check (read each one; apply ONLY to toggle-style buttons — skip `<select>` dropdowns or navigation links, which have native semantics).

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/desktop-table-a11y.test.ts` (both pass) and `pnpm check` (clean).

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Feat: table ARIA position, sort, trend, and toggle states. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Watchlist.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
