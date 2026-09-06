# Deprecated lib Shim Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete 4 pure re-export shims and convert currency/fx into documented live modules, with all importers repointed.

**Architecture:** Mechanical path-only rewrites per module (import shape preserved), verified by `tsc` (dangling imports fail the build) plus a new guard test. Replacement rules: `from "@/lib/X"` → `from "@shared/X"`; server `from "../lib/X"` → `from "../shared/src/X.js"`; lib-internal `from "./X"` → `from "@shared/X"`. Aliases resolve everywhere: tsconfig/vitest `@shared` → `shared/src`, desktop vite `@shared` → `../shared/src`, metro already handles `@shared` (used by `lib/fx.ts`).

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-shim-removal-design.md`

---

### Task 1: Guard test for shim removal

**Files:**
- Create: `tests/no-lib-shims.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

describe("no deprecated lib shims", () => {
  it("deletes the pure re-export shims", () => {
    for (const f of [
      "lib/distributors.ts",
      "lib/catalog.ts",
      "lib/trending.ts",
      "lib/compare-utils.ts",
    ]) {
      expect(existsSync(f), `${f} should be deleted`).toBe(false);
    }
  });

  it("converts currency and fx into documented live modules", async () => {
    const currency = await readFile("lib/currency.ts", "utf8");
    const fx = await readFile("lib/fx.ts", "utf8");
    expect(currency).not.toContain("Deprecated");
    expect(currency).not.toContain('from "@shared/currency"');
    expect(fx).not.toContain("Deprecated");
  });

  it("points biggest former importers at shared", async () => {
    const detail = await readFile("app/product/[id].tsx", "utf8");
    const warmer = await readFile("server/catalog-warmer.ts", "utf8");
    expect(detail).toContain("@shared/distributors");
    expect(warmer).toContain("../shared/src/catalog.js");
  });
});
```
NOTE: `lib/currency.ts` will still contain the substring `@shared/currency` inside `EXCHANGE_RATES` import? No — after Task 4 removes the pure re-exports, check: currency.ts imports `{ EXCHANGE_RATES } from "@shared/currency"` for the overlay base. That WOULD match `from "@shared/currency"` and fail the guard! Fix the assertion: use `not.toContain('export { CURRENCY_SYMBOLS')` and `not.toContain("export { EXCHANGE_RATES }")` instead. Corrected test:

```ts
  it("converts currency and fx into documented live modules", async () => {
    const currency = await readFile("lib/currency.ts", "utf8");
    const fx = await readFile("lib/fx.ts", "utf8");
    expect(currency).not.toContain("Deprecated");
    expect(currency).not.toContain("export { CURRENCY_SYMBOLS");
    expect(currency).not.toContain("export { EXCHANGE_RATES }");
    expect(currency).toContain("setExchangeRates");
    expect(fx).not.toContain("Deprecated");
    expect(fx).toContain("refreshFxRates");
  });
```
Use this corrected version (write it this way from the start).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/no-lib-shims.test.ts 2>&1 | tail -4`
Expected: FAIL (shims exist, headers present).

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/no-lib-shims.test.ts
git commit -m "test: guard deprecated lib shim removal"
```

---

### Task 2: Repoint distributors importers, delete shim

**Files:**
- Modify: the 31 files below (path string only, import shape preserved)
- Delete: `lib/distributors.ts`

- [ ] **Step 1: Repoint `@/lib/distributors` → `@shared/distributors` in these 21 files**

app/compare/[id].tsx, components/compare/current-prices-table.tsx, components/compare/cheapest-region-card.tsx, components/compare/distributor-selector.tsx, app/(tabs)/alerts.tsx, app/distributor-analysis.tsx, app/restock-watches.tsx, app/health/[id].tsx, app/w/[token].tsx, app/health.tsx, app/product/[id].tsx, components/settings/scraper-status-section.tsx, components/product/reminder-date-picker-modal.tsx, components/product/target-table-card.tsx, components/alerts/alert-card.tsx, components/product/price-chart-modal.tsx, components/alerts/triggered-alert-card.tsx, components/product/detail-header.tsx, components/best-distributor-card.tsx, components/product/distributor-listing-section.tsx, components/product/distributor-listing-card.tsx.

Change only the path: `from "@/lib/distributors"` → `from "@shared/distributors"`. For multi-line import blocks, change only the `from` line. Verify each file's edit with grep before moving on.

- [ ] **Step 2: Repoint server imports**

server/catalog-warmer.ts, server/price-insights.ts: `from "../lib/distributors"` → `from "../shared/src/distributors.js"`.

- [ ] **Step 3: Repoint lib-internal imports**

lib/watchlist-org.ts, lib/distributor-analysis.ts, lib/best-deal.ts, lib/region-filter.ts, lib/watchlist-stats.ts, lib/notifications.ts, lib/price-share.ts, lib/restock.ts: `from "./distributors"` → `from "@shared/distributors"`.

- [ ] **Step 4: Confirm zero importers, then delete**

Run: `rg -l '"@/lib/distributors"|"\.\./lib/distributors"|"\./distributors"' app components desktop/src lib server tests 2>/dev/null`
Expected: no output (only the shim file itself matched `./distributors`? No — the pattern `"./distributors"` matches the string `"./distributors"` in lib files; the shim doesn't import itself. Expect empty).
Then: `git rm lib/distributors.ts`

- [ ] **Step 5: Typecheck**

Run: `pnpm check 2>&1 | tail -1`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Refactor: repoint distributors importers to @shared, delete lib shim. TypeScript: 0 errors."
```
(Check `git status` before committing — only intended files.)

---

### Task 3: Repoint catalog/trending/compare-utils, delete shims

**Files:**
- Modify: the 14 files below
- Delete: `lib/catalog.ts`, `lib/trending.ts`, `lib/compare-utils.ts`

- [ ] **Step 1: Catalog — `@/lib/catalog` → `@shared/catalog`**

app/compare/[id].tsx, app/_layout.tsx, app/search.tsx, components/home/trending-section.tsx.

- [ ] **Step 2: Catalog — server + lib-internal**

server/catalog-warmer.ts, server/price-insights.ts, server/product-images.ts: `from "../lib/catalog"` → `from "../shared/src/catalog.js"`.
lib/bulk-import.ts: `from "./catalog"` → `from "@shared/catalog"`.

- [ ] **Step 3: Trending + compare-utils**

components/home/trending-section.tsx: `from "@/lib/trending"` → `from "@shared/trending"`.
app/compare/[id].tsx, components/compare/current-prices-table.tsx, components/compare/cheapest-region-card.tsx, components/compare/chart-card.tsx, components/compare/distributor-selector.tsx: `from "@/lib/compare-utils"` → `from "@shared/compare-utils"`.

- [ ] **Step 4: Confirm zero importers, then delete**

Run: `rg -l '"@/lib/(catalog|trending|compare-utils)"|"\.\./lib/(catalog|trending|compare-utils)"|"\./(catalog|trending|compare-utils)"' app components desktop/src lib server tests 2>/dev/null`
Expected: no output.
Then: `git rm lib/catalog.ts lib/trending.ts lib/compare-utils.ts`

- [ ] **Step 5: Typecheck + run the new guard's shim-absence test**

Run: `pnpm check 2>&1 | tail -1` (clean) and `pnpm vitest run tests/no-lib-shims.test.ts -t "deletes the pure" 2>&1 | tail -3` (passes; other guard tests still fail until Task 4).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Refactor: repoint catalog/trending/compare-utils importers to @shared, delete lib shims. TypeScript: 0 errors."
```

---

### Task 4: Convert currency/fx to live modules, move stragglers

**Files:**
- Modify: `lib/currency.ts`, `lib/fx.ts`, plus 4 straggler files

- [ ] **Step 1: Strip pure re-exports from lib/currency.ts**

Read the file top first. Delete the deprecation comment and these two lines:
```ts
export { CURRENCY_SYMBOLS, CURRENCIES, FX_TTL_MS, getCurrencySymbol, formatPrice } from "@shared/currency";
```
and
```ts
export { EXCHANGE_RATES };
```
Keep `import { EXCHANGE_RATES } from "@shared/currency";` (the overlay base). Keep `setExchangeRates`, `convertPrice`, `hasExchangeRate`, `getExchangeRate`, `getBestPrice` untouched. Replace the header comment with:
```ts
// Live-rate currency layer over @shared/currency: mutable FX overlay
// (setExchangeRates) + conversions. Pure formatting/constants live in
// @shared/currency — import those directly.
```

- [ ] **Step 2: Update lib/fx.ts header**

Read the file top first. Replace the deprecation comment with:
```ts
// FX persistence layer over @shared/fx: AsyncStorage caching + live
// overlay updates. Pure fetch/TTL live in @shared/fx.
```
Keep all exports and logic untouched.

- [ ] **Step 3: Move straggler pure imports to @shared/currency**

In each file, move ONLY `formatPrice` to the shared import; live names stay:
- app/compare/[id].tsx: read its currency import line first (mixed `convertPrice, formatPrice` single- or multi-line), split into `import { formatPrice } from "@shared/currency";` + `import { convertPrice } from "@/lib/currency";`.
- app/(tabs)/index.tsx: `import { formatPrice, getBestPrice } from "@/lib/currency";` → `import { formatPrice } from "@shared/currency";` + `import { getBestPrice } from "@/lib/currency";`.
- app/w/[token].tsx: same split as index.
- components/best-distributor-card.tsx: read its line first, same split pattern (`formatPrice` → shared, rest stays).

- [ ] **Step 4: Run guard + typecheck**

Run: `pnpm vitest run tests/no-lib-shims.test.ts 2>&1 | tail -3` (all 3 pass) and `pnpm check 2>&1 | tail -1` (clean).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Refactor: currency/fx become documented live modules, stragglers to @shared. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

Run: `pnpm lint 2>&1 | tail -2` (0 errors, no new warnings) and `pnpm test 2>&1 | grep -E "^ *(Test Files|Tests) "` (all pass, 0 failures; ~1422+ tests).

- [ ] **Step 2: Bundler checks (deletions touch all three platforms)**

Run with workdir `desktop/`: `pnpm build 2>&1 | tail -3` (exit 0). Run with workdir root: `pnpm expo export -p web 2>&1 | tail -3` (exports `dist`).

- [ ] **Step 3: Push**

Run: `git push origin main 2>&1 | tail -1` (`main -> main`). Confirm `git status --short` is empty.
