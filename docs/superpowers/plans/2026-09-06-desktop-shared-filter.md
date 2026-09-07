# Desktop Shared Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop watchlist filtering delegates to shared `filterWatchlist`, unifying query semantics cross-platform.

**Architecture:** Guard test proves delegation; mapping unit tests prove the desktop `FilterKey` subset + null-listings + brand/category inputs behave under the shared helper; the swap replaces the 7-clause memo body and collapses the tag-counts pre-filter. Sort untouched.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-shared-filter-design.md`

---

### Task 1: Guard + mapping tests

**Files:**
- Create: `tests/desktop-shared-filter.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { filterWatchlist } from "../lib/watchlist-org";
import type { Product } from "../lib/types";

const base: Product = {
  id: "p1",
  name: "RTX 4090",
  brand: "NVIDIA",
  modelNumber: "NV-4090",
  category: "GPUs",
  listings: [
    {
      distributorId: "d1",
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      priceHistory: [],
    },
  ],
} as unknown as Product;

const baseFilters = {
  region: "all",
  tagIds: [] as string[],
  tagMatchMode: "any" as const,
  status: "all" as const,
  query: "",
  priceRange: undefined as [number, number] | undefined,
  inStockOnly: false,
  displayCurrency: "USD",
};

describe("desktop shared filter", () => {
  it("delegates desktop filtering to filterWatchlist", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("filterWatchlist(products");
  });

  it("matches brand and category queries", () => {
    expect(filterWatchlist([base], { ...baseFilters, query: "nvidia" })).toHaveLength(1);
    expect(filterWatchlist([base], { ...baseFilters, query: "gpus" })).toHaveLength(1);
    expect(filterWatchlist([base], { ...baseFilters, query: "nope" })).toHaveLength(0);
  });

  it("handles null listings and every FilterKey status", () => {
    const noListings = { ...base, listings: null } as unknown as Product;
    expect(filterWatchlist([noListings], baseFilters)).toHaveLength(1);
    for (const status of ["all", "in_stock", "back_order", "out_of_stock"] as const) {
      expect(() =>
        filterWatchlist([base], { ...baseFilters, status }),
      ).not.toThrow();
    }
  });
});
```
Verify `Product` required fields by reading `lib/types.ts` first — the fixture uses `as unknown as Product` so missing optional fields are fine, but keep the shape realistic (id, name, brand, modelNumber, category, listings with distributorId/price/currency/stockStatus/priceHistory).

- [ ] **Step 2: Run tests — expect SPLIT results**

Run: `pnpm vitest run tests/desktop-shared-filter.test.ts 2>&1 | tail -4`
Expected: delegation guard FAILS (no call yet); the 2 mapping tests PASS immediately (they prove the shared helper already handles desktop inputs — the safety case for the swap).

- [ ] **Step 3: Commit the tests**

```bash
git add tests/desktop-shared-filter.test.ts
git commit -m "test: guard desktop shared filter delegation + mapping"
```

---

### Task 2: Swap the filter body

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Replace the filtered memo body**

Read the current memo first (~lines 225-253). Replace the 7-clause body with:
```tsx
  const filtered = useMemo(
    () =>
      filterWatchlist(products, {
        region: regionFilter,
        tagIds: selectedTagIds,
        tagMatchMode,
        status: filter as StatusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }),
    [products, regionFilter, selectedTagIds, tagMatchMode, filter, query, priceRange, inStockOnly, displayCurrency],
  );
```
Extend the watchlist-org import with `filterWatchlist` (check current line — imports `countTagMatches`), and import type `StatusFilter` (check lib/types import in the file; the `as` cast bridges desktop `FilterKey`, a subset — do NOT widen pills). Dep array must list every referenced value.

- [ ] **Step 2: Collapse the tag-counts pre-filter**

Read the `tagCounts` memo first. Replace its hand-rolled pre-filter body with the identical shared call (same fields object as step 1). If it already delegates via `countTagMatches(products.filter(...))`, replace the inner `products.filter(...)` with `filterWatchlist(products, {...same fields...})` and keep the counting wrapper intact.

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-shared-filter.test.ts` (all 3 pass) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Refactor: desktop watchlist filtering delegates to shared filterWatchlist. TypeScript: 0 errors."
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
