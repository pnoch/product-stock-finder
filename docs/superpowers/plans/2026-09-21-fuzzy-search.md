# Fuzzy Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled substring search with Fuse.js fuzzy matching that handles typos, model number variants, and multi-word queries with relevance ranking.

**Architecture:** Add `fuse.js` as a dependency, create a configured Fuse instance in `lib/catalog.ts`, replace the `searchCatalog()` function, and add tests for fuzzy matching behavior.

**Tech Stack:** Fuse.js, vitest

---

### Task 1: Add Fuse.js dependency

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install fuse.js**

```bash
pnpm add fuse.js
```

- [ ] **Step 2: Verify installation**

```bash
pnpm list fuse.js
```

Expected: `fuse.js` listed with version

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add fuse.js for fuzzy search"
```

---

### Task 2: Replace searchCatalog with Fuse.js

**Files:**
- Modify: `lib/catalog.ts:151-160`

- [ ] **Step 1: Read current searchCatalog**

Read `lib/catalog.ts` lines 151-160 to confirm the current implementation.

- [ ] **Step 2: Replace searchCatalog with Fuse.js instance**

Replace the `searchCatalog` function in `lib/catalog.ts` with:

```typescript
import Fuse from "fuse.js";

const fuse = new Fuse(PRODUCT_CATALOG, {
  keys: [
    { name: "modelNumber", weight: 0.4 },
    { name: "name", weight: 0.3 },
    { name: "brand", weight: 0.15 },
    { name: "category", weight: 0.1 },
    { name: "description", weight: 0.05 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
});

export function searchCatalog(query: string): typeof PRODUCT_CATALOG {
  if (!query.trim()) return PRODUCT_CATALOG;
  return fuse.search(query).map((result) => result.item);
}
```

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add lib/catalog.ts
git commit -m "feat: replace substring search with Fuse.js fuzzy matching"
```

---

### Task 3: Write search tests

**Files:**
- Create: `tests/catalog-search.test.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
import { describe, it, expect } from "vitest";
import { searchCatalog, PRODUCT_CATALOG } from "../lib/catalog";

describe("searchCatalog", () => {
  it("returns full catalog for empty query", () => {
    const results = searchCatalog("");
    expect(results).toEqual(PRODUCT_CATALOG);
  });

  it("matches exact model number", () => {
    const results = searchCatalog("CRS804");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("mikrotik-crs804-4ddq-hrm");
  });

  it("matches model number case-insensitively", () => {
    const results = searchCatalog("crs804");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("mikrotik-crs804-4ddq-hrm");
  });

  it("matches partial model number", () => {
    const results = searchCatalog("RB5009");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("mikrotik-rb5009");
  });

  it("matches brand name", () => {
    const results = searchCatalog("ubiquiti");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((p) => p.brand === "Ubiquiti")).toBe(true);
  });

  it("matches multi-word query across fields", () => {
    const results = searchCatalog("mikrotik router");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      results.every(
        (p) => p.brand === "MikroTik" && p.category === "Router",
      ),
    ).toBe(true);
  });

  it("handles typos", () => {
    const results = searchCatalog("ubiquiti swtich");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((p) => p.brand === "Ubiquiti")).toBe(true);
  });

  it("returns empty array for no match", () => {
    const results = searchCatalog("xyznonexistent");
    expect(results).toEqual([]);
  });

  it("ranks model number matches higher than description matches", () => {
    const results = searchCatalog("CRS804");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].id).toBe("mikrotik-crs804-4ddq-hrm");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
pnpm test tests/catalog-search.test.ts
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/catalog-search.test.ts
git commit -m "test: add fuzzy search tests for catalog"
```

---

### Task 4: Verify full test suite still passes

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass (129+ test files, 1150+ tests)

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve lint/type issues from fuse.js integration"
```
