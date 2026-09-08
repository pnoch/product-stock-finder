# Desktop Stats Parity 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stats gains basket alerts, keyboard calendar, formatted sparkline values, and an explicit share chooser.

**Architecture:** Basket sheet + threshold in Stats (same settings key); grid roles on the existing calendar markup; currency props on the two sparkline components; share handler split into two explicit actions. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-stats-parity2-design.md`

---

### Task 1: Guard tests for stats parity 2

**Files:**
- Create: `tests/desktop-stats-parity2.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop stats parity 2", () => {
  it("has basket alert threshold UI", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("basketAlertThreshold");
    expect(text).toContain("Set alert");
  });

  it("makes the drop calendar keyboard accessible", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain('role="grid"');
    expect(text).toContain('role="gridcell"');
  });

  it("formats sparkline values and offers share choice", async () => {
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const rates = await readFile("desktop/src/pages/Rates.tsx", "utf8");
    const stats = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(detail).toContain("formatPrice(first");
    expect(rates).toContain("formatPrice(first");
    expect(stats).toContain("Copy text");
    expect(stats).toContain("Save image");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-stats-parity2.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — verify each string truly absent; `formatPrice(first` must not already exist in those files).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-stats-parity2.test.ts
git commit -m "test: guard desktop stats parity 2"
```

---

### Task 2: Basket alert threshold

**Files:**
- Modify: `desktop/src/pages/Stats.tsx`

- [ ] **Step 1: Add threshold state + sheet**

Read loadStats + settings handling first. Add:
```tsx
  const [basketThreshold, setBasketThreshold] = useState<number | null>(null);
  const [basketSheetOpen, setBasketSheetOpen] = useState(false);
  const [basketDraft, setBasketDraft] = useState("");
```
Load: `setBasketThreshold(settings?.basketAlertThreshold ?? null)` where settings loads (mirror mobile `app/stats.tsx:81`). Save handler:
```tsx
  const handleSaveBasketAlert = useCallback(async (threshold: number | null) => {
    setBasketThreshold(threshold);
    const current = await storage.getSettings();
    if (!current) return;
    await storage.saveSettings({ ...current, basketAlertThreshold: threshold });
  }, []);
```
Verify `storage.getSettings/saveSettings` names + AppSettings has `basketAlertThreshold` (mobile uses it — check lib/types.ts). Mirror mobile `handleSaveBasketAlert` (`app/stats.tsx:109-116`) — read it first.

- [ ] **Step 2: Sheet modal + basket banner**

In the basket summary card (lines ~338-342, read exact markup): add "Set alert" button opening the sheet; when `basketThreshold != null && basket && basket.total < basketThreshold`, show banner line "Basket below alert threshold" (amber/red, small). Sheet modal: reuse the file's modal pattern if one exists (check for existing modal usage in Stats; else fixed overlay div like other desktop modals — read one, e.g. tag manager in Watchlist, and copy the pattern): input (draft init from threshold on open), validation `> 0`, Enable/Disable buttons calling handleSaveBasketAlert + close.

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-stats-parity2.test.ts -t "basket alert"` (passes; others fail) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Stats.tsx
git commit -m "Feat: desktop Stats basket alert threshold. TypeScript: 0 errors."
```

---

### Task 3: Calendar keyboard support

**Files:**
- Modify: `desktop/src/pages/Stats.tsx`

Current grid (lines ~540-560, read first): `grid grid-cols-7` div, day cells are plain divs with title tooltips.

- [ ] **Step 1: Grid roles + focusable drop days**

Change container to `role="grid"` + `aria-label="Price drop calendar, last 30 days"`. Drop-day cells (`hasDrops`) become `<button type="button">` keeping classes/title, adding `aria-label` with the SAME text as the title (date + count + biggest %). Empty days stay plain divs (add `aria-hidden="true"`? No — they show day numbers, meaningful content; leave them as-is without roles). No dialog opens (spec).

- [ ] **Step 2: Verify**

Run: guard `-t "keyboard accessible"` (passes) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Stats.tsx
git commit -m "Fix: keyboard-accessible drop calendar grid. TypeScript: 0 errors."
```

---

### Task 4: Formatted sparkline values + share chooser

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`, `desktop/src/pages/Rates.tsx`, `desktop/src/pages/Stats.tsx`

- [ ] **Step 1: Currency props + formatted labels**

ProductDetail `PriceSparkline({ history })`: add `currency` prop, call site passes `bestListing.currency` (verify name at line ~614). Label: `formatPrice(first, currency)` / `formatPrice(last, currency)` (verify formatPrice imported in ProductDetail; if not, add from the same specifier other desktop files use — check Home.tsx). Rates `Sparkline({ values, color })`: add `currency` prop, call site passes row `code`; label uses formatPrice similarly (check formatPrice import in Rates; add if missing).
Keep trend logic + role="img" from P3a work; only the value formatting changes.

- [ ] **Step 2: Share chooser**

Read current `handleShare` + header Share button first. Split into `handleCopyText` (clipboard path verbatim) and `handleSaveImage` (PNG path verbatim, failure → error toast, NO text fallback). Header: replace single Share button with two buttons "Copy text" (`aria-label="Copy stats as text"`) and "Save image" (`aria-label="Save stats as image"`), same styling family. Remove the old combined handler (or repurpose — no dead code left).

- [ ] **Step 3: Verify**

Run: full guard file (all 3 pass) + `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx desktop/src/pages/Rates.tsx desktop/src/pages/Stats.tsx
git commit -m "Feat: formatted sparkline values, explicit stats share chooser. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 4 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
