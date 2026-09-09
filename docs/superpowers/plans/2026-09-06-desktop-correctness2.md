# Desktop Correctness Follow-Ups 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-row compare focus, honest live refresh, first-load errors, and a shared digest snapshot builder.

**Architecture:** Compare preselects from search params; ProductDetail refresh fetches live prices like the Watchlist helper; Watchlist probe tracks outcome explicitly; snapshot builder extracted pure into lib. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-correctness2-design.md`

---

### Task 1: Guards + helper unit tests

**Files:**
- Create: `tests/desktop-correctness2.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { buildDigestSnapshot } from "../lib/price-digest";
import type { Product } from "../lib/types";

describe("desktop correctness follow-ups 2", () => {
  it("focuses compare on the row distributor", async () => {
    const compare = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(compare).toContain("get(\"distributor\")");
    expect(detail).toContain("?distributor=");
  });

  it("refreshes live prices on the product page", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("prices.get");
    expect(text).not.toContain("buyNowLoading");
  });

  it("builds digest snapshots via shared helper", () => {
    const products = [
      {
        id: "p1",
        name: "Widget",
        listings: [
          {
            distributorId: "d1",
            price: 100,
            currency: "USD",
            stockStatus: "in_stock",
            priceHistory: [],
            lastChecked: new Date().toISOString(),
          },
        ],
      },
    ] as unknown as Product[];
    const snap = buildDigestSnapshot(products, "USD");
    expect(snap.displayCurrency).toBe("USD");
    expect(snap.products).toHaveLength(1);
    expect(snap.products[0]).toMatchObject({ productId: "p1", bestPrice: 100, stockStatus: "in_stock" });
    expect(typeof snap.lastDigestAt).toBe("string");
  });
});
```
Verify `DigestSnapshot` shape in `lib/price-digest.ts:12` first (`{lastDigestAt, displayCurrency, products[{productId, name, bestPrice, stockStatus}]}`) and adjust the test if it differs. `buildDigestSnapshot` does not exist yet — the import fails until Task 4 creates it (that's the red).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-correctness2.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — import error + missing strings).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-correctness2.test.ts
git commit -m "test: guard desktop correctness follow-ups 2"
```

---

### Task 2: Per-row compare focus

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`, `desktop/src/pages/Compare.tsx`

- [ ] **Step 1: Row links carry the distributor**

In the distributor-row actions (read exact markup): change `to={\`/compare/${product.id}\`}` → `` to={`/compare/${product.id}?distributor=${listing.distributorId}`} `` and `aria-label="View price history"` → `` aria-label={`View ${distributorName} price history`} `` (a distributor display name is in scope at the row — read it; `getDistributorById(listing.distributorId)?.name ?? listing.distributorId` pattern or existing variable).

- [ ] **Step 2: Compare preselects from the param**

Read Compare's `selected` state init (`useState<Set<string>>(new Set())`) + `useParams` usage. Add `useSearchParams` import from react-router (verify export; `useParams` already imported from there). Init:
```tsx
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(() => {
    const d = searchParams.get("distributor");
    return new Set(d ? [d] : []);
  });
```
Invalid ids: validated downstream (selector only matches known distributors — verify; if selection of unknown id breaks rendering, filter against known ids at init by reading the selector logic first). No other changes to selection behavior.

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-correctness2.test.ts -t "focuses compare"` (passes; others fail) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx desktop/src/pages/Compare.tsx
git commit -m "Feat: per-row compare focus via distributor param. TypeScript: 0 errors."
```

---

### Task 3: Honest product refresh

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Live price fetch in loadProduct**

Read `loadProduct` fully first. After the storage section (after product found + settings loaded, before/after watches — place after watches load, still inside try): if `getApiBaseUrl()` is set and product found, fetch each listing via tRPC `prices.get` (dynamic `import("../lib/trpc")` like the insight block; concurrency 3 sequential workers mirroring the Watchlist helper pattern — or simple sequential loop for typical ≤6 listings? Mirror Watchlist: 3 workers over listings with 20s timeout race per query, per-query try/catch → null). Merge via `composeLiveListings` (import from `../../../lib/live-prices` — verify path from desktop/src/pages; Watchlist uses it? No — Watchlist has its own helper. Check how desktop SharedWatchlist or others merge server prices... if no precedent, import composeLiveListings from lib/live-prices (desktop-safe: hooks/use-connection imports lib/live-prices and bundles fine). Persist via `storage.updateProductListings(productId, merged)` when any result non-null; refresh local `product` state from storage after (or set merged product directly — read how product state updates; simplest: re-read `storage.getWatchlist()` find + setProduct).
- Stamp `setLastRefreshedAt(Date.now())` ONLY when ≥1 fresh snapshot merged (move the existing stamp from load-success to post-merge; keep stamping on plain load? NO — honesty rule: stamp only on fresh merge. If no server/zero fresh, leave previous stamp).
- Respect `loadIdRef` guards at each await (existing pattern).
- Remove `buyNowLoading` state + its branches (verify zero other usages; the loading spinner button branch becomes just `livePriceLoading`? Read the conditional first — keep livePriceLoading behavior, drop only buyNowLoading).

- [ ] **Step 2: Verify**

Run: guard `-t "refreshes live prices"` (passes — asserts `prices.get` present + `buyNowLoading` absent) and `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: honest live-price refresh on desktop product page. TypeScript: 0 errors."
```

---

### Task 4: First-load errors + digest helper

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`, `desktop/src/pages/Stats.tsx`, `lib/price-digest.ts`

- [ ] **Step 1: Shared snapshot builder**

In `lib/price-digest.ts`, extract (read the desktop off-branch + mobile inline version first — they should match):
```tsx
export function buildDigestSnapshot(products: Product[], displayCurrency: string): DigestSnapshot {
  return {
    lastDigestAt: new Date().toISOString(),
    displayCurrency,
    products: products.map((p) => ({ ... })),
  };
}
```
Field derivation must match the existing inline logic exactly (bestPrice via getBestPrice, stockStatus derivation — copy verbatim). Desktop off-branch + on-path both call it (replacing inline construction). Mobile untouched.

- [ ] **Step 2: First-load error tracking**

Read the probe effect + `hasLoadedOnce` first. Change outcome tracking: probe failure sets `listError` EVEN when never loaded (remove/adjust the early return so first-load failure surfaces the banner + Retry). Keep filter-empty distinct (banner gated on unfiltered emptiness as today — read the banner condition first and preserve it).

- [ ] **Step 3: Verify**

Run: full guard file (all 3 pass — helper import resolves, strings present) + `pnpm check` (clean). Also run `pnpm vitest run tests/price-digest` if a suite exists (check).

- [ ] **Step 4: Commit**

```bash
git add lib/price-digest.ts desktop/src/pages/Watchlist.tsx desktop/src/pages/Stats.tsx
git commit -m "Fix: shared digest snapshot builder, first-load error visibility. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
