# Bulk-Import Discovery + Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give bulk-imported (and any listing-less) products prices: a capped eager discovery after bulk import with an "fetch remaining?" prompt, plus a per-product "Find prices" repair CTA on Product Detail and Watchlist cards (mobile + desktop).

**Architecture:** A pure batch runner (`lib/bulk-discovery.ts`) over the existing `rediscoverProduct` (`lib/manual-add.ts`) / `discoverListings` (`lib/listing-discovery.ts`). The existing background rotation (`rediscoverMissingListings`, `MISSING_LISTINGS_PER_RUN=2`, 6h retry) keeps draining the backlog; this feature adds user-driven eager + on-demand paths. No server changes.

**Tech Stack:** TypeScript, React Native/Expo, React (desktop), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-bulk-import-discovery-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/bulk-discovery.ts` | pure batch runner |
| `components/search/bulk-import-modal.tsx` | mobile post-import discovery |
| `components/product/distributor-listing-section.tsx` | + `onFindPrices` in the empty state |
| `app/product/[id].tsx` | wire the Find prices handler |
| `components/watchlist/product-card.tsx` | no-prices badge/CTA |
| `app/(tabs)/watchlist.tsx` | wire per-card repair |
| `desktop/src/pages/Search.tsx`, `desktop/src/components/SearchModal.tsx` | desktop post-import |
| `desktop/src/pages/ProductDetail.tsx` | desktop repair CTA |
| `desktop/src/pages/Watchlist.tsx` | desktop repair CTA |
| tests | unit + source guards |

---

## Task 1: Batch runner `lib/bulk-discovery.ts`

**Files:**
- Create: `lib/bulk-discovery.ts`
- Test: `tests/bulk-discovery.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { runDiscoveryBatch } from "../lib/bulk-discovery";
import { clearListingAttemptsForTests } from "../lib/manual-add";

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    productId: `p${i}`,
    modelNumber: `M${i}`,
  }));
}

function harness(listingsPerModel = 1) {
  const updated: Record<string, number> = {};
  return {
    updated,
    storage: {
      updateProductListings: vi.fn(async (id: string, listings: unknown[]) => {
        updated[id] = listings.length;
      }),
    },
    discover: vi.fn(async (model: string) =>
      Array.from({ length: listingsPerModel }, (_, i) => ({
        distributorId: `d${i}`,
        productId: "p",
        price: 1,
        currency: "USD",
        stockStatus: "in_stock" as const,
        url: "u",
        lastChecked: "2026-01-01T00:00:00.000Z",
        priceHistory: [],
      })),
    ),
  };
}

describe("runDiscoveryBatch", () => {
  it("runs a default batch of 3 and returns the next index", async () => {
    const h = harness();
    const result = await runDiscoveryBatch({
      items: items(7),
      startIndex: 0,
      storage: h.storage,
      discover: h.discover,
    });
    expect(h.discover).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ nextIndex: 3, discovered: 3 });
  });

  it("continues from a prior nextIndex", async () => {
    const h = harness();
    const result = await runDiscoveryBatch({
      items: items(7),
      startIndex: 3,
      storage: h.storage,
      discover: h.discover,
    });
    expect(result.nextIndex).toBe(6);
    expect(h.discover).toHaveBeenCalledTimes(3);
  });

  it("honors a batchSize override and never runs past the end", async () => {
    const h = harness();
    expect(
      (await runDiscoveryBatch({ items: items(5), startIndex: 0, batchSize: 1, storage: h.storage, discover: h.discover })).nextIndex,
    ).toBe(1);
    expect(
      (await runDiscoveryBatch({ items: items(2), startIndex: 0, batchSize: 10, storage: h.storage, discover: h.discover })).nextIndex,
    ).toBe(2);
  });

  it("stops early when shouldCancel becomes true", async () => {
    const h = harness();
    let calls = 0;
    const result = await runDiscoveryBatch({
      items: items(7),
      startIndex: 0,
      storage: h.storage,
      discover: h.discover,
      shouldCancel: () => calls++ > 0,
    });
    expect(h.discover).toHaveBeenCalledTimes(1);
    expect(result.nextIndex).toBe(1);
  });

  it("absorbs a throwing discover and still advances", async () => {
    const h = harness();
    h.discover.mockRejectedValue(new Error("boom"));
    const result = await runDiscoveryBatch({
      items: items(3),
      startIndex: 0,
      storage: h.storage,
      discover: h.discover,
    });
    expect(result).toEqual({ nextIndex: 3, discovered: 0 });
  });

  it("reports progress with the model number", async () => {
    const h = harness();
    const progress: Array<[number, number, string]> = [];
    await runDiscoveryBatch({
      items: items(3),
      startIndex: 0,
      storage: h.storage,
      discover: h.discover,
      onProgress: (done, total, model) => progress.push([done, total, model]),
    });
    expect(progress).toEqual([
      [1, 3, "M0"],
      [2, 3, "M1"],
      [3, 3, "M2"],
    ]);
  });

  it("handles an empty item list", async () => {
    const h = harness();
    expect(
      (await runDiscoveryBatch({ items: [], startIndex: 0, storage: h.storage, discover: h.discover })),
    ).toEqual({ nextIndex: 0, discovered: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/bulk-discovery.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `lib/bulk-discovery.ts`:

```ts
import {
  rediscoverProduct,
  type DiscoverFn,
  type RediscoverStorage,
} from "./manual-add";

export interface BulkDiscoveryItem {
  productId: string;
  modelNumber: string;
}

export const DEFAULT_BULK_BATCH_SIZE = 3;

export async function runDiscoveryBatch(deps: {
  items: BulkDiscoveryItem[];
  startIndex: number;
  batchSize?: number;
  storage: RediscoverStorage;
  discover: DiscoverFn;
  onProgress?: (done: number, total: number, modelNumber: string) => void;
  shouldCancel?: () => boolean;
}): Promise<{ nextIndex: number; discovered: number }> {
  const {
    items,
    startIndex,
    batchSize = DEFAULT_BULK_BATCH_SIZE,
    storage,
    discover,
    onProgress,
    shouldCancel,
  } = deps;
  const total = items.length;
  let nextIndex = Math.max(0, Math.min(startIndex, total));
  let discovered = 0;
  const end = Math.min(nextIndex + Math.max(0, batchSize), total);
  while (nextIndex < end) {
    if (shouldCancel?.()) break;
    const item = items[nextIndex]!;
    try {
      const result = await rediscoverProduct({
        storage,
        discover,
        productId: item.productId,
        modelNumber: item.modelNumber,
      });
      discovered += result.discovered;
    } catch {
      // Best-effort: a failed model is skipped; the repair CTA retries later.
    }
    nextIndex += 1;
    onProgress?.(nextIndex - startIndex, end - startIndex, item.modelNumber);
  }
  return { nextIndex, discovered };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/bulk-discovery.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/bulk-discovery.ts tests/bulk-discovery.test.ts
git commit -m "feat: bulk discovery batch runner"
```

---

## Task 2: Mobile bulk-import post-discovery

**Files:**
- Modify: `components/search/bulk-import-modal.tsx` (after the add loop, ~L88)
- Test: `tests/bulk-discovery-ui.test.ts` (create; mobile half)

- [ ] **Step 1: Write the failing source-guard test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("bulk discovery UI", () => {
  it("bulk import runs the batch runner (mobile)", () => {
    const src = readFileSync("components/search/bulk-import-modal.tsx", "utf8");
    expect(src).toContain("runDiscoveryBatch");
    expect(src).toContain("Fetch prices for the remaining");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement in `components/search/bulk-import-modal.tsx`**

Add imports:
```ts
import { runDiscoveryBatch, DEFAULT_BULK_BATCH_SIZE } from "@/lib/bulk-discovery";
import { discoverListings } from "@/lib/listing-discovery";
import { addToWatchlist, updateProductListings } from "@/lib/storage";
```
(merge with the existing `addToWatchlist` import).

Add state near `const [importing, setImporting] = useState(false);`:
```ts
  const [discoveryNote, setDiscoveryNote] = useState<string | null>(null);
```

After `const addedCount = ...` / before the `showAlert("Import Complete", ...)`, insert the discovery flow (only for products whose write landed):
```ts
      const addedProducts = newProducts.filter(
        (_, i) => results[i]!.status === "fulfilled" && results[i]!.value === true,
      );
      if (addedProducts.length > 0) {
        const items = addedProducts.map((p) => ({
          productId: p.id,
          modelNumber: p.modelNumber,
        }));
        const storage = { updateProductListings };
        let discovered = 0;
        let next = 0;
        const runBatch = async () => {
          const res = await runDiscoveryBatch({
            items,
            startIndex: next,
            storage,
            discover: discoverListings,
            onProgress: (done, total, model) =>
              setDiscoveryNote(`Finding prices ${done}/${total} — ${model}…`),
          });
          next = res.nextIndex;
          discovered += res.discovered;
        };
        await runBatch();
        setDiscoveryNote(null);
        if (next < items.length) {
          const remaining = items.length - next;
          showAlert(
            "Prices found",
            `Found prices for the first ${next} product${next === 1 ? "" : "s"}${discovered > 0 ? ` (${discovered} listing${discovered === 1 ? "" : "s"})` : ""}. Fetch prices for the remaining ${remaining}?`,
            [
              { text: "Later", style: "cancel" },
              {
                text: "Fetch",
                onPress: () => {
                  void (async () => {
                    while (next < items.length) await runBatch();
                    setDiscoveryNote(null);
                  })();
                },
              },
            ],
          );
        }
      }
```

Render `discoveryNote` under the import button, e.g. next to the existing ActivityIndicator/label:
```tsx
        {discoveryNote && (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
            {discoveryNote}
          </Text>
        )}
```

Note: `showAlert` accepts a buttons array (see `lib/alert.ts`); confirm the third argument shape before relying on it.

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts && pnpm check`
Expected: PASS; 0 TS errors

- [ ] **Step 5: Commit**

```bash
git add components/search/bulk-import-modal.tsx tests/bulk-discovery-ui.test.ts
git commit -m "feat: discover prices after mobile bulk import"
```

---

## Task 3: Mobile Product Detail "Find prices" CTA

**Files:**
- Modify: `components/product/distributor-listing-section.tsx` (empty `sortedListings.length === 0` branch, ~L162-176)
- Modify: `app/product/[id].tsx` (handler + pass prop)
- Test: `tests/bulk-discovery-ui.test.ts` (add mobile detail assertion)

- [ ] **Step 1: Extend the source-guard test**

```ts
  it("product detail offers a Find prices CTA (mobile)", () => {
    const section = readFileSync(
      "components/product/distributor-listing-section.tsx",
      "utf8",
    );
    expect(section).toContain("onFindPrices");
    expect(section).toContain("Find prices");
    const screen = readFileSync("app/product/[id].tsx", "utf8");
    expect(screen).toContain("rediscoverProduct");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

In `components/product/distributor-listing-section.tsx`, add props `onFindPrices?: () => void; findingPrices?: boolean;` to the component signature, and in the `sortedListings.length === 0` branch render a button below the "No distributor data available yet." text:

```tsx
          {onFindPrices && (
            <TouchableOpacity activeOpacity={0.85}
              onPress={onFindPrices}
              disabled={findingPrices}
              style={{
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 16,
                backgroundColor: colors.primary,
                opacity: findingPrices ? 0.6 : 1,
              }}
              accessibilityLabel="Find prices"
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                {findingPrices ? "Finding prices…" : "Find prices"}
              </Text>
            </TouchableOpacity>
          )}
```

In `app/product/[id].tsx`, add imports:
```ts
import { rediscoverProduct } from "@/lib/manual-add";
import { discoverListings } from "@/lib/listing-discovery";
import { updateProductListings } from "@/lib/storage";
```
Add state and handler near `const { product, listings, loaded, lastUpdatedAt, refresh } = useLiveProduct(...)`:
```ts
  const [findingPrices, setFindingPrices] = useState(false);
  const handleFindPrices = useCallback(async () => {
    if (!product?.modelNumber) return;
    setFindingPrices(true);
    try {
      const { discovered } = await rediscoverProduct({
        storage: { updateProductListings },
        discover: discoverListings,
        productId: product.id,
        modelNumber: product.modelNumber,
      });
      await refresh();
      showAlert(
        discovered > 0 ? "Prices found" : "No prices found",
        discovered > 0
          ? `Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}.`
          : "No distributor had this model in stock. Try again later.",
      );
    } catch {
      showAlert("Couldn't find prices", "Please try again later.");
    } finally {
      setFindingPrices(false);
    }
  }, [product?.id, product?.modelNumber, refresh]);
```
Pass to `<DistributorListingSection ... onFindPrices={handleFindPrices} findingPrices={findingPrices} />`. Ensure `useCallback`/`showAlert` are imported (add `useCallback` if missing; `showAlert` from `@/lib/alert`).

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts && pnpm check`
Expected: PASS; 0 TS errors

- [ ] **Step 5: Commit**

```bash
git add components/product/distributor-listing-section.tsx app/product/[id].tsx tests/bulk-discovery-ui.test.ts
git commit -m "feat: Find prices CTA on mobile product detail"
```

---

## Task 4: Mobile Watchlist no-prices badge/CTA

**Files:**
- Modify: `components/watchlist/product-card.tsx`
- Modify: `app/(tabs)/watchlist.tsx`
- Test: `tests/bulk-discovery-ui.test.ts` (add card assertion)

- [ ] **Step 1: Extend the source-guard test**

```ts
  it("watchlist card offers a no-prices repair CTA (mobile)", () => {
    const card = readFileSync("components/watchlist/product-card.tsx", "utf8");
    expect(card).toContain("onFindPrices");
    expect(card).toContain("Find");
    const screen = readFileSync("app/(tabs)/watchlist.tsx", "utf8");
    expect(screen).toContain("onFindPrices");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

In `components/watchlist/product-card.tsx`, add `onFindPrices?: () => void;` to the props type, and render a small tappable badge when there are no listings. Place it in the card's price/status area (near where `bestPrice` is rendered), e.g.:

```tsx
      {(product.listings ?? []).length === 0 && onFindPrices && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onFindPrices}
          accessibilityLabel="Find prices"
          accessibilityRole="button"
          style={{ alignSelf: "flex-start", marginTop: 6 }}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
            No prices — Find
          </Text>
        </TouchableOpacity>
      )}
```

In `app/(tabs)/watchlist.tsx`, add imports (`rediscoverProduct` from `@/lib/manual-add`, `discoverListings` from `@/lib/listing-discovery`, `updateProductListings` from `@/lib/storage`), a handler:
```ts
  const handleFindPrices = useCallback(
    async (product: Product) => {
      if (!product.modelNumber) return;
      try {
        const { discovered } = await rediscoverProduct({
          storage: { updateProductListings },
          discover: discoverListings,
          productId: product.id,
          modelNumber: product.modelNumber,
        });
        await reload();
        showToast(
          discovered > 0
            ? `Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}`
            : "No prices found",
          discovered > 0 ? "success" : "error",
        );
      } catch {
        showToast("Couldn't find prices", "error");
      }
    },
    [reload, showToast],
  );
```
and pass `onFindPrices={() => handleFindPrices(item as Product)}` to `<ProductCard ... />`. Confirm `showToast` is available in this screen (it is used for other flows) and `useCallback` is imported.

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts && pnpm check`
Expected: PASS; 0 TS errors

- [ ] **Step 5: Commit**

```bash
git add components/watchlist/product-card.tsx "app/(tabs)/watchlist.tsx" tests/bulk-discovery-ui.test.ts
git commit -m "feat: no-prices repair CTA on mobile watchlist cards"
```

---

## Task 5: Desktop bulk-import post-discovery

**Files:**
- Modify: `desktop/src/pages/Search.tsx` (`handleBulkImport`, ~L193-210)
- Modify: `desktop/src/components/SearchModal.tsx` (`handleBulkImport`, ~L190-205)
- Test: `tests/bulk-discovery-ui.test.ts` (add desktop bulk assertion)

- [ ] **Step 1: Extend the source-guard test**

```ts
  it("bulk import runs the batch runner (desktop)", () => {
    const search = readFileSync("desktop/src/pages/Search.tsx", "utf8");
    expect(search).toContain("runDiscoveryBatch");
    const modal = readFileSync("desktop/src/components/SearchModal.tsx", "utf8");
    expect(modal).toContain("runDiscoveryBatch");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

In both `desktop/src/pages/Search.tsx` and `desktop/src/components/SearchModal.tsx`, import:
```ts
import { runDiscoveryBatch } from "../../../lib/bulk-discovery";
import { discoverListings } from "../../../lib/listing-discovery";
```
(adjust the relative depth if the file is not two levels under root; `desktop/src/...` → `../../../lib/...`).

After `const added = bulkNew.filter(...)`, before the toast, run the first batch and prompt:
```ts
      if (added.length > 0) {
        const items = added.map((p) => ({ productId: p.id, modelNumber: p.modelNumber }));
        const rediscoverStorage = {
          updateProductListings: (pid: string, listings: DistributorListing[]) =>
            storage.updateProductListings(pid, listings),
        };
        let next = 0;
        let discovered = 0;
        while (next < items.length) {
          const res = await runDiscoveryBatch({
            items,
            startIndex: next,
            storage: rediscoverStorage,
            discover: discoverListings,
          });
          next = res.nextIndex;
          discovered += res.discovered;
          if (next < items.length) {
            const go = window.confirm(`Fetch prices for the remaining ${items.length - next} product(s)?`);
            if (!go) break;
          }
        }
        // Append `discovered` to the existing toast text below.
      }
```
Add `import type { DistributorListing } from "../../../lib/types";` for the `DistributorListing[]` annotation. Reuse the handler's existing `storage` object; verify its shape by reading the surrounding code and adapt only if it differs.

- [ ] **Step 4: Run test + desktop typecheck**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts && pnpm check:desktop`
Expected: PASS; 0 TS errors

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx tests/bulk-discovery-ui.test.ts
git commit -m "feat: discover prices after desktop bulk import"
```

---

## Task 6: Desktop Product Detail "Find prices" CTA

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`
- Test: `tests/bulk-discovery-ui.test.ts` (add desktop detail assertion)

- [ ] **Step 1: Extend the source-guard test**

```ts
  it("product detail offers a Find prices CTA (desktop)", () => {
    const src = readFileSync("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(src).toContain("Find prices");
    expect(src).toContain("rediscoverProduct");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

In `desktop/src/pages/ProductDetail.tsx`, import `rediscoverProduct` from `../../../lib/manual-add` and `discoverListings` from `../../../lib/listing-discovery` (verify depth). Add a handler:
```tsx
  const handleFindPrices = async () => {
    if (!product?.modelNumber) return;
    try {
      const { discovered } = await rediscoverProduct({
        storage: { updateProductListings: (pid, listings) => storage.updateProductListings(pid, listings) },
        discover: discoverListings,
        productId: product.id,
        modelNumber: product.modelNumber,
      });
      // reload the product
      await load?.();
      showToast(discovered > 0 ? `Found prices at ${discovered} distributor(s)` : "No prices found", discovered > 0 ? "success" : "error");
    } catch {
      showToast("Couldn't find prices", "error");
    }
  };
```
Render a "Find prices" button where the listing-less state is shown (when `(product?.listings ?? []).length === 0`). Use the file's existing button styling/classes and `showToast` mechanism.

- [ ] **Step 4: Run test + desktop typecheck**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts && pnpm check:desktop`
Expected: PASS; 0 TS errors

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx tests/bulk-discovery-ui.test.ts
git commit -m "feat: Find prices CTA on desktop product detail"
```

---

## Task 7: Desktop Watchlist no-prices CTA

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`
- Test: `tests/bulk-discovery-ui.test.ts` (add desktop watchlist assertion)

- [ ] **Step 1: Extend the source-guard test**

```ts
  it("watchlist offers a no-prices repair CTA (desktop)", () => {
    const src = readFileSync("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(src).toContain("Find prices");
    expect(src).toContain("rediscoverProduct");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

In `desktop/src/pages/Watchlist.tsx`, import `rediscoverProduct` from `../../../lib/manual-add` and `discoverListings` from `../../../lib/listing-discovery` (verify depth), and add a handler that reuses the existing `storage`:
```tsx
  const handleFindPrices = async (product: { id: string; modelNumber: string }) => {
    try {
      const { discovered } = await rediscoverProduct({
        storage: { updateProductListings: (pid, listings) => storage.updateProductListings(pid, listings) },
        discover: discoverListings,
        productId: product.id,
        modelNumber: product.modelNumber,
      });
      await load();
      showToast(discovered > 0 ? `Found prices at ${discovered} distributor(s)` : "No prices found", discovered > 0 ? "success" : "error");
    } catch {
      showToast("Couldn't find prices", "error");
    }
  };
```
Render a "Find prices" button/link in each watchlist row/card when `(row.listings ?? []).length === 0`, using the file's existing row markup and `showToast`.

- [ ] **Step 4: Run test + desktop typecheck**

Run: `pnpm vitest run tests/bulk-discovery-ui.test.ts && pnpm check:desktop`
Expected: PASS; 0 TS errors

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx tests/bulk-discovery-ui.test.ts
git commit -m "feat: no-prices repair CTA on desktop watchlist"
```

---

## Task 8: Full verification + docs

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full suite**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: `tsc` 0 errors, lint 0 errors, all tests pass.

- [ ] **Step 2: Desktop**

Run: `pnpm check:desktop && pnpm --dir desktop test`
Expected: 0 errors, all pass.

- [ ] **Step 3: DB suite (no new DB code, but confirm no regression)**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm test:db`
Expected: pass.

- [ ] **Step 4: Append the phase entry to `todo.md`**

```md
## Phase 1019: Bulk-import discovery + repair CTA

- [x] `lib/bulk-discovery.ts` pure batch runner (batch of 3, continuation, cancel, best-effort).
- [x] Bulk import (mobile + desktop) discovers the first 3 models, then prompts to fetch the remainder in batches.
- [x] Product Detail + Watchlist cards show a "Find prices" / "No prices — Find" repair CTA (mobile + desktop).
- [x] Tests: batch-runner unit suite + UI source guards for both platforms.
- [x] `tsc 0`, lint 0 errors, offline + DB + desktop suites green.
```

- [ ] **Step 5: Commit**

```bash
git add todo.md
git commit -m "Docs: bulk-import discovery phase entry (Phase 1019)"
```
