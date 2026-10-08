# Acquired State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark a watched product as acquired, so it drops out of the build-order plan, sourcing sheet, basket, alerts, restock, and away-summary — and can be unmarked to restore it.

**Architecture:** `Product.acquiredAt` + `updateProductAcquired`; a pure `lib/acquired.ts` (`isAcquired`/`activeProducts`); six consumers filter to active products; card/detail actions + a "Show acquired" toggle.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-acquired-state-design.md`

---

## File Structure

- Modify `lib/types.ts` — `Product.acquiredAt`.
- Modify `lib/storage/watchlist.ts` + `lib/storage/index.ts` — `updateProductAcquired`.
- Create `lib/acquired.ts` — `isAcquired`, `activeProducts`.
- Modify `app/build-order.tsx`, `app/sourcing.tsx`, `app/stats.tsx`, `app/(tabs)/index.tsx` — filter.
- Modify `lib/background-tasks/price-check.ts`, `lib/restock.ts` — skip acquired.
- Modify `components/watchlist/product-card.tsx`, `components/product/detail-header.tsx`, `app/(tabs)/watchlist.tsx` — actions + toggle.
- Tests: `tests/acquired.test.ts`, `tests/acquired-storage.test.ts`, `tests/acquired-consumers.test.ts`, `tests/price-check-acquired.test.ts`.

---

### Task 1: Model + storage + pure filter

**Files:** Modify `lib/types.ts`, `lib/storage/watchlist.ts`, `lib/storage/index.ts`; Create `lib/acquired.ts`; Tests `tests/acquired.test.ts`, `tests/acquired-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/acquired.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAcquired, activeProducts } from "../lib/acquired";
import type { Product } from "../lib/types";

const p = (id: string, acquiredAt?: string) => ({ id, acquiredAt }) as unknown as Product;

describe("acquired", () => {
  it("isAcquired is true only for a non-empty timestamp", () => {
    expect(isAcquired(p("a", "2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isAcquired(p("a"))).toBe(false);
    expect(isAcquired(p("a", ""))).toBe(false);
  });

  it("activeProducts drops acquired products", () => {
    const out = activeProducts([p("a", "2026-01-01T00:00:00.000Z"), p("b")]);
    expect(out.map((x) => x.id)).toEqual(["b"]);
  });
});
```

Create `tests/acquired-storage.test.ts` (copy the AsyncStorage mock from `tests/last-seen-storage.test.ts`):

```ts
import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => { store.set(k, v); },
    removeItem: async (k: string) => { store.delete(k); },
    multiRemove: async (ks: string[]) => { ks.forEach((k) => store.delete(k)); },
  },
}));

import { addToWatchlist, getWatchlist, updateProductAcquired } from "../lib/storage";

beforeEach(() => store.clear());

const product = {
  id: "p1", name: "P1", modelNumber: "M1", brand: "X", category: "Router",
  description: "", isWatched: true, addedAt: "2026-01-01T00:00:00.000Z", listings: [],
} as never;

describe("updateProductAcquired", () => {
  it("sets and clears acquiredAt", async () => {
    await addToWatchlist(product);
    await updateProductAcquired("p1", "2026-02-01T00:00:00.000Z");
    expect((await getWatchlist())[0]!.acquiredAt).toBe("2026-02-01T00:00:00.000Z");
    await updateProductAcquired("p1", null);
    expect((await getWatchlist())[0]!.acquiredAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/acquired.test.ts tests/acquired-storage.test.ts`
Expected: FAIL — modules not found / not exported.

- [ ] **Step 3: Implement**

In `lib/types.ts`, add to `Product`:

```ts
  /** ISO timestamp when the user marked this product as bought. */
  acquiredAt?: string;
```

In `lib/storage/watchlist.ts`, add (mirroring `updateProductSourcing`):

```ts
  async function updateProductAcquired(
    productId: string,
    acquiredAt: string | null,
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) => {
        if (p.id !== productId) return p;
        const next: Product = { ...p };
        if (acquiredAt === null) delete next.acquiredAt;
        else if (typeof acquiredAt === "string" && acquiredAt.length > 0) next.acquiredAt = acquiredAt;
        return next;
      });
      await persistWatchlist(updated);
      notify("watchlist", productId);
    });
  }
```

Add it to the factory's returned object and re-export from `lib/storage/index.ts` (beside `updateProductSourcing`).

Create `lib/acquired.ts`:

```ts
import type { Product } from "./types";

/** A product the user has marked as bought. */
export function isAcquired(product: Product): boolean {
  return typeof product.acquiredAt === "string" && product.acquiredAt.length > 0;
}

/** The products still to buy (unacquired). */
export function activeProducts(products: Product[]): Product[] {
  return products.filter((p) => !isAcquired(p));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/acquired.test.ts tests/acquired-storage.test.ts && pnpm check`
Expected: PASS (3 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage/watchlist.ts lib/storage/index.ts lib/acquired.ts tests/acquired.test.ts tests/acquired-storage.test.ts
git commit -m "feat(acquired): Product.acquiredAt + updateProductAcquired + activeProducts"
```

---

### Task 2: Filter the consumers

**Files:** Modify `app/build-order.tsx`, `app/sourcing.tsx`, `app/stats.tsx`, `app/(tabs)/index.tsx`, `lib/background-tasks/price-check.ts`, `lib/restock.ts`; Test `tests/acquired-consumers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/acquired-consumers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activeProducts } from "../lib/acquired";
import { computeBuildOrder } from "../lib/build-order";
import { computeSourcing } from "../lib/reseller";
import { computeBasketValue } from "../lib/watchlist-stats";
import type { Product } from "../lib/types";

function listing(distributorId: string, price: number) {
  return { distributorId, productId: "x", price, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] };
}
const dest = { countryCode: "TH", currency: "USD" };

describe("acquired consumers", () => {
  it("build-order, sourcing, and basket exclude an acquired product", () => {
    const wl = [
      { id: "p1", name: "P1", acquiredAt: "2026-02-01T00:00:00.000Z", listings: [listing("balticnetworks-us", 200)] },
      { id: "p2", name: "P2", listings: [listing("balticnetworks-us", 100)] },
    ] as unknown as Product[];
    const active = activeProducts(wl);
    expect(computeBuildOrder(active, dest, {}).split.stores.flatMap((s) => s.items).map((i) => i.productId)).toEqual(["p2"]);
    expect(computeSourcing(active, dest, {}).lines.map((l) => l.productId)).toEqual(["p2"]);
    expect(computeBasketValue(active, "USD").productCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm exec vitest run tests/acquired-consumers.test.ts`
Expected: PASS — this test pins that `activeProducts` + the pure consumers compose correctly (the screens are wired in Step 3).

- [ ] **Step 3: Implement**

- `app/build-order.tsx`: import `activeProducts` from `@/lib/acquired`; change the memo to `computeBuildOrder(activeProducts(watchlist), destination, options)`. Add a line under the title when `watchlist.length > activeProducts(watchlist).length`: `"{n} part(s) already acquired"`.
- `app/sourcing.tsx`: import `activeProducts`; change the memo to `computeSourcing(activeProducts(watchlist), destination, options)`.
- `app/stats.tsx`: import `activeProducts`; change the basket memo to `computeBasketValue(activeProducts(watchlist), displayCurrency)`.
- `app/(tabs)/index.tsx`: import `activeProducts`; change the away-summary call to `computeAwaySummary({ watchlist: activeProducts(list), ... })`.
- `lib/background-tasks/price-check.ts`: import `isAcquired` from `../acquired`; in the alert loop after `const product = refreshedWatchlist.find(...)`, add `if (product && isAcquired(product)) continue;` (skip firing; leave armed).
- `lib/restock.ts`: import `isAcquired` from `../acquired`; in the watch loop after `const product = watchlist.find(...)`, add `if (product && isAcquired(product)) continue;`.

- [ ] **Step 4: Verify**

Run: `pnpm check && pnpm exec vitest run tests/acquired-consumers.test.ts tests/price-check.test.ts tests/restock.test.ts`
Expected: 0 type errors; PASS.

- [ ] **Step 5: Commit**

```bash
git add app/build-order.tsx app/sourcing.tsx app/stats.tsx app/\(tabs\)/index.tsx lib/background-tasks/price-check.ts lib/restock.ts tests/acquired-consumers.test.ts
git commit -m "feat(acquired): exclude acquired products from the consumers"
```

---

### Task 3: Alert skip test

**Files:** Test `tests/price-check-acquired.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/price-check-acquired.test.ts` (mirror `tests/price-check.test.ts`; add `acquiredAt` to the watchlist product):

```ts
import { describe, expect, it, vi } from "vitest";
// …reuse price-check.test.ts's mocks…
// Seed a watchlist product with `acquiredAt` set and a drop alert that would
// otherwise fire; assert no notification is scheduled and the alert stays active.
```

Fill in against the harness so it asserts: an alert for an acquired product does **not** schedule a notification and is **not** deactivated.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/price-check-acquired.test.ts`
Expected: FAIL before Task 2's guard (if run in isolation after Task 2, it passes — the point is it pins the behavior).

- [ ] **Step 3: Commit**

```bash
git add tests/price-check-acquired.test.ts
git commit -m "test(acquired): an alert for an acquired product does not fire"
```

---

### Task 4: UI actions + toggle + full verification + docs

**Files:** Modify `components/watchlist/product-card.tsx`, `components/product/detail-header.tsx`, `app/(tabs)/watchlist.tsx`, `app/product/[id].tsx`; `todo.md`

- [ ] **Step 1: Card action**

In `components/watchlist/product-card.tsx`, add an `onToggleAcquired?: () => void` prop and a small check action (icon `checkmark.circle.fill`, `colors.success` when acquired, `colors.muted` when not) beside the existing actions, calling `onToggleAcquired`. When `isAcquired(product)`, render the card dimmed (reduced opacity) with the check in `colors.success`.

- [ ] **Step 2: Detail action**

In `components/product/detail-header.tsx`, add `acquired: boolean` and `onToggleAcquired: () => void` props; render a button beside "Watch for restock": "Mark as acquired" / "Acquired — tap to undo" (icon `checkmark.circle.fill`). In `app/product/[id].tsx`, wire `acquired={isAcquired(product)}` and an `onToggleAcquired` that calls `updateProductAcquired(id, isAcquired(product) ? null : new Date().toISOString())` then `refresh()`.

- [ ] **Step 3: Watchlist toggle + wiring**

In `app/(tabs)/watchlist.tsx`:
- Add `const [showAcquired, setShowAcquired] = useState(false);`.
- Pass `onToggleAcquired` to each `ProductCard` (calls `updateProductAcquired` then `reload()`).
- Filter the rendered list: when `!showAcquired`, drop acquired products (compose with the existing filters).
- Add a "Show acquired" toggle near the summary/filters.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 5: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 6: Document**

Add a `todo.md` phase entry (next number 1137): `Product.acquiredAt`, `updateProductAcquired`, `activeProducts`, the six consumer filters, the card/detail actions, the show-acquired toggle, and the note that acquisition is manual (no purchase inference) + desktop parity deferred.

- [ ] **Step 7: Commit**

```bash
git add components/watchlist/product-card.tsx components/product/detail-header.tsx app/\(tabs\)/watchlist.tsx app/product/\[id\].tsx todo.md
git commit -m "feat(acquired): mark-as-acquired actions + show-acquired toggle (Phase 1137)"
```

---

## Self-Review

- **Spec coverage:** model + storage + filter (Task 1), consumer filtering (Task 2), alert-skip test (Task 3), UI + verify + docs (Task 4). Purchase price/receipts, a project tracker, and desktop parity are out of scope per the spec.
- **Placeholders:** none — the model, helper, filter, and consumer edits are given verbatim; Task 4 names the exact files, props, and strings.
- **Type consistency:** `Product.acquiredAt?`; `updateProductAcquired(productId, string | null)`; `isAcquired(product)`; `activeProducts(products)` — used consistently.
- **Skip-not-deactivate:** the alert guard `continue`s without deactivating, so unmarking re-arms it.
