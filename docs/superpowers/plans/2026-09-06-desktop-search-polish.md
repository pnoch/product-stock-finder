# Desktop Search + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV export, smoother search flow, and three dead-end fixes on desktop.

**Architecture:** Small additions mirroring existing handlers (backup download, navigate, toasts, banners). Settings + Search + Health + RestockWatches only. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-search-polish-design.md`

---

### Task 1: Guard tests for search polish

**Files:**
- Create: `tests/desktop-search-polish.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop search polish", () => {
  it("exports CSV and navigates after add", async () => {
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const search = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(settings).toContain("watchlistToCsv");
    expect(search).toContain('navigate("/watchlist")');
  });

  it("prefills manual add and fixes dead ends", async () => {
    const search = await readFile("desktop/src/pages/Search.tsx", "utf8");
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const health = await readFile("desktop/src/pages/Health.tsx", "utf8");
    const restock = await readFile("desktop/src/pages/RestockWatches.tsx", "utf8");
    expect(search).toContain("setManualModel(query");
    expect(settings).not.toContain("play.google.com");
    expect(health).toContain("healthError");
    expect(restock).not.toContain("tap &quot;Watch");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-search-polish.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify each string/absence truly holds; if `healthError` already exists, report instead of committing).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-search-polish.test.ts
git commit -m "test: guard desktop search polish bundle"
```

---

### Task 2: CSV export + search flow

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`, `desktop/src/pages/Search.tsx`

- [ ] **Step 1: CSV button**

Read the Data Management block first. Add import `watchlistToCsv` from `"../../../lib/csv"` (verify path + export). Handler mirroring the backup download (Tauri save + Blob fallback; gather `storage.getWatchlist()` + displayCurrency from settings — read how backup handler gets currency first and mirror). Button "Export CSV" (`aria-label="Export CSV"`) beside backup buttons.

- [ ] **Step 2: Add-flow + prefill**

`handleAdd` success: after toast, `navigate("/watchlist")` (`useNavigate` exists at line 79 — verify `navigate` variable name). Manual Add open: set `manualModel` from `query` when opening (read the open-modal trigger first — set alongside `setManualOpen(true)`).

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-search-polish.test.ts -t "CSV and navigates"` (passes; other fails) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Settings.tsx desktop/src/pages/Search.tsx
git commit -m "Feat: desktop CSV export, search navigation and prefill. TypeScript: 0 errors."
```

---

### Task 3: Dead-end fixes

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`, `desktop/src/pages/Health.tsx`, `desktop/src/pages/RestockWatches.tsx`

- [ ] **Step 1: Rate row**

Remove the "Rate the App" row (Play Store link) from the About section (read exact block ~1572-1578 first). Support + Privacy untouched.

- [ ] **Step 2: Health error banner**

`runTest` outer catch (~line 116): replace bare `console.error` with error state + banner with Retry (`runTest`) — mirror the Alerts banner pattern (read one first). Keep inner best-effort catches as-is.

- [ ] **Step 3: Restock copy**

Empty text (~line 82): "tap" → click/select wording (read exact string first; keep the CTA button).

- [ ] **Step 4: Verify**

Run: full guard file (both pass) + `pnpm check` (clean).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Settings.tsx desktop/src/pages/Health.tsx desktop/src/pages/RestockWatches.tsx
git commit -m "Fix: desktop dead ends (rate row, health errors, restock copy). TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 5 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
