# Desktop Stats Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop Stats gains digest, insights, and drop-calendar cards plus a movers switcher and slice disclosure.

**Architecture:** Three Tailwind cards in `desktop/src/pages/Stats.tsx` reusing mobile compute functions and snapshot flow; switcher wires existing `setDays`; caption above chart. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-stats-parity-design.md`

---

### Task 1: Guard tests for stats parity

**Files:**
- Create: `tests/desktop-stats-parity.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop stats parity", () => {
  it("has digest, insights, and drop-calendar cards", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("computeDigest");
    expect(text).toContain("computeProductInsights");
    expect(text).toContain("computeDropCalendar");
  });

  it("has a movers window switcher and slice disclosure", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("setDays");
    expect(text).toContain("Top 3 of");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-stats-parity.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — `setDays` may already exist as state setter? Current code has `const [days] = useState(30)` with NO setter (destructured without setDays) — verify; if `setDays` string already appears, report instead of committing a passing test. Same for "Top 3 of").

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-stats-parity.test.ts
git commit -m "test: guard desktop stats parity cards"
```

---

### Task 2: Digest card

**Files:**
- Modify: `desktop/src/pages/Stats.tsx`

- [ ] **Step 1: Read mobile flow + result shape first**

Read `app/stats.tsx:70-130` (load: getWatchlist/getSettings/getAlerts/getPriceDigestSnapshot, computeDigest, save snapshot) and `lib/price-digest.ts:28-60` (DigestResult: summary, valueDelta, newProducts, removedProducts, priceChanges, stockChanges, alertTargetsHit). Verify desktop `storage` exposes `getAlerts`, `getPriceDigestSnapshot`, `savePriceDigestSnapshot` (via createStorage — check desktop/src/storage.ts).

- [ ] **Step 2: Load + compute in loadStats**

Extend the existing `loadStats` (read exact code ~lines 84-97): alongside watchlist/settings, also `storage.getAlerts()` and `storage.getPriceDigestSnapshot()`; compute `computeDigest(snapshot, watchlist, settings, alerts)`; save the new snapshot via `storage.savePriceDigestSnapshot(...)` — read mobile's exact save call (what it stores: the new snapshot object from computeDigest? check `DigestResult` vs snapshot type — mobile saves `snapshot` var; mirror exactly). Store result in `digest` state.

- [ ] **Step 3: Render card**

New card after existing summaries (read render order; place digest first among new cards): title "Digest", valueDelta line (`formatPrice(from) → formatPrice(to)` + signed percent, red/green), lists for priceChanges/stockChanges/alertTargetsHit/new/removed (top 3 each with "+N more" counts), empty → "No changes in this period." Use existing card classes (copy from a sibling summary card verbatim). `formatPrice` + `displayCurrency` already in file — verify.

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/desktop-stats-parity.test.ts -t "digest, insights"` (passes — contains computeDigest; others fail) and `pnpm check` (clean).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Stats.tsx
git commit -m "Feat: desktop Stats digest card. TypeScript: 0 errors."
```

---

### Task 3: Insights card

**Files:**
- Modify: `desktop/src/pages/Stats.tsx`

- [ ] **Step 1: Compute + render**

`computeProductInsights(watchlist, displayCurrency)` from `lib/product-insights.ts` (verify import path from desktop: `../../../lib/product-insights`). Compute in `loadStats` or a memo off `products` (prefer memo: `useMemo(() => products ? computeProductInsights(products, displayCurrency) : null, ...)` — no storage involved). Render card "Product Insights": three stats (At all-time low / Dropping now / volatility low·med·high) + top-3 lows list (mirror mobile insights-card rows). Card classes copied from sibling.

- [ ] **Step 2: Verify**

Run guard file (digest+insights assertions pass; calendar/switcher fail) + `pnpm check` clean.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Stats.tsx
git commit -m "Feat: desktop Stats insights card. TypeScript: 0 errors."
```

---

### Task 4: Drop calendar + switcher + caption

**Files:**
- Modify: `desktop/src/pages/Stats.tsx`

- [ ] **Step 1: Calendar card**

`computeDropCalendar(watchlist, displayCurrency, 30)` from `lib/drop-calendar.ts` (memo off products). Render "Drop Calendar" card: total-drops header + 7-col Tailwind grid of last 30 days (dateKey → day number; cell shows drop count badge when >0, `title` tooltip with date + biggest drop %; empty days muted). Mobile uses screen-width cell math — desktop: fixed small cells (`w-8 h-8` grid, no measurement).

- [ ] **Step 2: Movers switcher**

Change `const [days] = useState(30)` to `const [days, setDays] = useState<MoversWindow>(30);` — check `MoversWindow` import (already imported per exploration line 25 — verify). Render segmented 7/30/90 control above movers (match `TimeRangeChips` if that component fits — check `desktop/src/components/TimeRangeChips.tsx` props first; use it if compatible, else three buttons). Existing `days === 90 → null` compute path already handles 90.

- [ ] **Step 3: Slice caption**

Above the chart block using `products.slice(0, 3)`: add caption `Top 3 of {products.length} by value` (only when `products.length > 3`).

- [ ] **Step 4: Verify**

Run: full guard file (all pass) + `pnpm check` clean.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Stats.tsx
git commit -m "Feat: desktop Stats drop calendar, movers switcher, slice caption. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Stats.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
