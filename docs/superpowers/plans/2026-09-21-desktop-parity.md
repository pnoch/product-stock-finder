# Desktop Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Tauri desktop app to parity with mobile by adding fuzzy search to SearchModal and displayCurrency to the Compare page.

**Architecture:** Import the shared `searchCatalog` function into the desktop SearchModal, and load `displayCurrency` from settings in the desktop Compare page.

**Tech Stack:** React, TypeScript, Fuse.js (via shared lib)

---

### Task 1: Desktop SearchModal — use Fuse.js searchCatalog

**Files:**
- Modify: `desktop/src/components/SearchModal.tsx:3,29-37`

- [ ] **Step 1: Read current SearchModal**

Read `desktop/src/components/SearchModal.tsx` to confirm the current inline filter implementation.

- [ ] **Step 2: Replace inline filter with searchCatalog**

In `desktop/src/components/SearchModal.tsx`:

1. Change the import on line 3 from `import { PRODUCT_CATALOG } from "../../../lib/catalog"` to `import { searchCatalog, PRODUCT_CATALOG } from "../../../lib/catalog"`
2. Replace lines 29-37 (the `results` computation):

```typescript
const results =
  query.length > 0
    ? PRODUCT_CATALOG.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.modelNumber.toLowerCase().includes(query.toLowerCase()) ||
          p.brand.toLowerCase().includes(query.toLowerCase()),
      )
    : PRODUCT_CATALOG;
```

With:

```typescript
const results = searchCatalog(query);
```

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add desktop/src/components/SearchModal.tsx
git commit -m "feat(desktop): use Fuse.js fuzzy search in SearchModal"
```

---

### Task 2: Desktop Compare — use displayCurrency

**Files:**
- Modify: `desktop/src/pages/Compare.tsx:1-2,38-49,84,110-113,125-128`

- [ ] **Step 1: Read current Compare page**

Read `desktop/src/pages/Compare.tsx` to confirm the hardcoded USD values.

- [ ] **Step 2: Add displayCurrency state and settings load**

In `desktop/src/pages/Compare.tsx`:

1. Add `displayCurrency` to the state declarations (near line 38):

```typescript
const [displayCurrency, setDisplayCurrency] = useState("USD");
```

2. In the existing `useEffect` that loads the product (around line 43-49), add settings loading:

```typescript
useEffect(() => {
  if (!id) return;
  Promise.all([
    storage.getWatchlist(),
    storage.getSettings(),
  ]).then(([list, settings]) => {
    setProduct(list.find((p) => p.id === id) ?? null);
    if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
    setLoading(false);
  });
}, [id]);
```

- [ ] **Step 3: Replace hardcoded USD in chart data**

Replace line 84:

```typescript
row[distName] = convertPrice(point.price, point.currency, "USD");
```

With:

```typescript
row[distName] = convertPrice(point.price, point.currency, displayCurrency);
```

- [ ] **Step 4: Replace hardcoded USD in sort-by-price**

Replace lines 110-114:

```typescript
return listings.sort(
  (a, b) =>
    convertPrice(a.price, a.currency, "USD") -
    convertPrice(b.price, b.currency, "USD"),
);
```

With:

```typescript
return listings.sort(
  (a, b) =>
    convertPrice(a.price, a.currency, displayCurrency) -
    convertPrice(b.price, b.currency, displayCurrency),
);
```

- [ ] **Step 5: Replace hardcoded USD in cheapest calculation**

Replace lines 125-128:

```typescript
return inStock.reduce((best, curr) => {
  const currConv = convertPrice(curr.price, curr.currency, "USD");
  const bestConv = convertPrice(best.price, best.currency, "USD");
  return currConv < bestConv ? curr : best;
});
```

With:

```typescript
return inStock.reduce((best, curr) => {
  const currConv = convertPrice(curr.price, curr.currency, displayCurrency);
  const bestConv = convertPrice(best.price, best.currency, displayCurrency);
  return currConv < bestConv ? curr : best;
});
```

- [ ] **Step 6: Add displayCurrency to useMemo dependencies**

Add `displayCurrency` to the dependency arrays of the `useMemo` hooks that use it:
- `chartData` (line 101): add `displayCurrency`
- `sortedListings` (line 117): add `displayCurrency`
- `cheapest` (line 130): add `displayCurrency`

- [ ] **Step 7: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add desktop/src/pages/Compare.tsx
git commit -m "feat(desktop): use displayCurrency in Compare page"
```

---

### Task 3: Verify full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: All tests pass (130+ test files, 1160+ tests)
