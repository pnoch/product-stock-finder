# Desktop Navigation + Dead-Ends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restock rows link onward, hidden pages join the nav, Rates refreshes by button, and the dead best-price button becomes a link.

**Architecture:** Small additions across 4 desktop files reusing existing routes, handlers, and link patterns. No server or mobile changes.

**Tech Stack:** React, react-router, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-navigation-design.md`

---

### Task 1: Guard tests for navigation fixes

**Files:**
- Create: `tests/desktop-navigation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop navigation fixes", () => {
  it("links restock rows to products with load error handling", async () => {
    const text = await readFile("desktop/src/pages/RestockWatches.tsx", "utf8");
    expect(text).toContain("/product/${");
    expect(text).toContain("loadError");
  });

  it("lists hidden pages in the sidebar", async () => {
    const text = await readFile("desktop/src/components/Sidebar.tsx", "utf8");
    expect(text).toContain("/restock-watches");
    expect(text).toContain("/distributor-analysis");
  });

  it("refreshes rates by button and links out-of-stock best price", async () => {
    const rates = await readFile("desktop/src/pages/Rates.tsx", "utf8");
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(rates).toContain("onRefresh");
    expect(rates).not.toContain("Pull to refresh");
    expect(detail).toContain("Out of Stock <ExternalLink");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-navigation.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — verify each string truly absent; `onRefresh` likely EXISTS in Rates already (it has a refresh button per exploration line 26-33!) — if so, drop that assertion before committing and report it. Read Rates.tsx first: if a header Refresh button already calls onRefresh, the remaining fix is copy-only ("Pull to refresh" text).)

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-navigation.test.ts
git commit -m "test: guard desktop navigation fixes"
```

---

### Task 2: Restock rows + sidebar entries

**Files:**
- Modify: `desktop/src/pages/RestockWatches.tsx`, `desktop/src/components/Sidebar.tsx`

- [ ] **Step 1: Actionable rows with error handling**

Read RestockWatches.tsx fully first (loadWatches with silent catch, handleRemove with silent catch, rows, empty text). Apply:
1. Import `Link` from `react-router` (check existing imports — `useNavigate` is there; add Link).
2. Product name → `<Link to={\`/product/${watch.productId}\`} className="...">` (keep text classes; add hover:underline).
3. Load: add `loadError` state + error banner with Retry (established pattern: `loadWatches` useCallback already exists — add try/catch setting error, banner above list).
4. Remove: on failure show error toast/message (check for existing toast pattern in file; else inline red message state cleared on next action), watch stays.
5. Empty state: add "Browse watchlist" CTA button → `/watchlist` (Link, secondary style) under the existing text.

- [ ] **Step 2: Sidebar entries**

In `navItems` (after Alerts — read exact array first): add `{ to: "/restock-watches", icon: <BellRing?> , label: "Restock" }` and `{ to: "/distributor-analysis", icon: <...>, label: "Analysis" }`. Verify lucide exports (`BellRing`, `Building2` — check `lucide-react` package; fall back to `Bell`/`Activity` already imported if unsure — do NOT invent names, grep the package first). Placement: Restock after Alerts; Analysis after Health (read array order and choose sensible spots).

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-navigation.test.ts -t "restock rows"` + `-t "sidebar"` (pass; third fails) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/RestockWatches.tsx desktop/src/components/Sidebar.tsx
git commit -m "Feat: actionable restock rows with error handling, sidebar discovery entries. TypeScript: 0 errors."
```

---

### Task 3: Rates refresh copy + best-price link

**Files:**
- Modify: `desktop/src/pages/Rates.tsx`, `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Rates copy**

Line 138 (read first): "No cached history yet. Showing base rates. Pull to refresh." → "No cached history yet. Showing base rates." + ensure a Refresh affordance exists nearby (a header Refresh button calling `onRefresh` already exists per exploration — verify; if yes, copy-only change; if no, add one mirroring it).

- [ ] **Step 2: Best-price out-of-stock link**

Read the disabled-button block first (lines ~616-638: loading branch with spinner vs out-of-stock/back-order branch). Convert ONLY the loaded out-of-stock/back-order branch from `<button disabled>` to:
```tsx
            <a
              href={bestListing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 bg-gray-600 text-white hover:bg-gray-500 cursor-pointer"
              aria-label={`Buy ${product.name} at ${bestDistributor.name} (currently ${bestListing.stockStatus === "back_order" ? "on back order" : "out of stock"})`}
            >
              {bestListing.stockStatus === "back_order" ? (
                <>Back Order <ExternalLink className="w-3.5 h-3.5" /></>
              ) : (
                <>Out of Stock <ExternalLink className="w-3.5 h-3.5" /></>
              )}
            </a>
```
Keep the `buyNowLoading || livePriceLoading` spinner-button branch byte-identical. Verify `bestListing.url` + `bestDistributor.name` in scope (used by the Buy Now branch — yes). Match gray button classes to file conventions (read first; the `bg-gray-600/hover:bg-gray-500` above is a best guess — adjust to file).

- [ ] **Step 3: Verify**

Run: full guard file (all 3 pass) + `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Rates.tsx desktop/src/pages/ProductDetail.tsx
git commit -m "Fix: Rates refresh copy, out-of-stock best price links out. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 4 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
