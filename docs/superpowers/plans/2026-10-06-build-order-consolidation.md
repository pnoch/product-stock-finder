# Build-Order Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the watchlist into a purchasing plan — cheapest single-store order vs. cheapest split, shipping counted once per store, with a savings verdict.

**Architecture:** A pure `computeBuildOrder` reuses `computeLandedCost` per listing but counts shipping once per store; a "Plan order" screen renders the comparison; a watchlist button links to it.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-build-order-consolidation-design.md`

---

## File Structure

- Create `lib/build-order.ts` — `computeBuildOrder`.
- Create `app/build-order.tsx` — the screen.
- Modify `app/(tabs)/watchlist.tsx` — the "Plan order" entry.
- Tests: `tests/build-order.test.ts`, `tests/build-order-screen.test.tsx`.

---

### Task 1: Pure planner

**Files:** Create `lib/build-order.ts`; Test `tests/build-order.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/build-order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeBuildOrder } from "../lib/build-order";
import type { Product } from "../lib/types";

// Two real USD distributors that ship to TH (Asia-Pacific): balticnetworks-us
// (shipping 55) and linktechs-us (shipping 57). baltic carries both products;
// linktechs carries only p1 (cheaper there).
function listing(distributorId: string, price: number) {
  return {
    distributorId, productId: "x", price, currency: "USD",
    stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z",
    priceHistory: [],
  };
}
const watchlist = [
  { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 120), listing("linktechs-us", 100)] },
  { id: "p2", name: "P2", listings: [listing("balticnetworks-us", 200)] },
] as unknown as Product[];

const dest = { countryCode: "TH", currency: "USD" };
const opts = {};

describe("computeBuildOrder", () => {
  it("builds the split plan with shipping once per store", () => {
    const { split } = computeBuildOrder(watchlist, dest, opts);
    // p1 cheapest at linktechs-us (100), p2 at balticnetworks-us (200) -> 2 stores
    expect(split.stores.map((s) => s.distributorId).sort()).toEqual([
      "balticnetworks-us",
      "linktechs-us",
    ]);
    const baltic = split.stores.find((s) => s.distributorId === "balticnetworks-us")!;
    const link = split.stores.find((s) => s.distributorId === "linktechs-us")!;
    expect(baltic.itemsTotal).toBe(200);
    expect(link.itemsTotal).toBe(100);
    // shipping counted once per store, not per item
    expect(split.shippingTotal).toBe(baltic.shipping + link.shipping);
    expect(split.total).toBe(split.itemsTotal + split.shippingTotal);
  });

  it("builds the single-store plan from the store carrying everything", () => {
    const { singleStore } = computeBuildOrder(watchlist, dest, opts);
    expect(singleStore).not.toBeNull();
    expect(singleStore!.stores).toHaveLength(1);
    expect(singleStore!.stores[0]!.distributorId).toBe("balticnetworks-us");
    expect(singleStore!.itemsTotal).toBe(320); // 120 + 200
  });

  it("reports savings as split.total - singleStore.total", () => {
    const { split, singleStore, savings } = computeBuildOrder(watchlist, dest, opts);
    expect(savings).toBe(split.total - singleStore!.total);
  });

  it("lists unassigned products with no orderable listing", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 100)] },
      { id: "p2", name: "P2", listings: [] },
    ] as unknown as Product[];
    const { split } = computeBuildOrder(wl, dest, opts);
    expect(split.unassigned).toEqual(["p2"]);
  });

  it("returns a null single-store plan when no store carries everything", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 100)] },
      { id: "p2", name: "P2", listings: [listing("linktechs-us", 100)] },
    ] as unknown as Product[];
    expect(computeBuildOrder(wl, dest, opts).singleStore).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/build-order.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/build-order.ts`:

```ts
import type { Product } from "./types";
import { getDistributorById } from "@shared/distributors";
import { computeLandedCost, type Destination, type LandedCostOptions } from "./landed-cost";

export interface BuildOrderItem {
  productId: string;
  productName: string;
  distributorId: string;
  itemCost: number;
}

export interface BuildOrderStore {
  distributorId: string;
  distributorName: string;
  items: BuildOrderItem[];
  itemsTotal: number;
  shipping: number;
  total: number;
}

export interface BuildOrderPlan {
  stores: BuildOrderStore[];
  itemsTotal: number;
  shippingTotal: number;
  total: number;
  currency: string;
  unassigned: string[];
}

export interface BuildOrderComparison {
  split: BuildOrderPlan;
  singleStore: BuildOrderPlan | null;
  savings: number;
}

interface Candidate {
  productId: string;
  productName: string;
  distributorId: string;
  distributorName: string;
  itemCost: number;
  shipping: number;
}

/** Cheapest orderable listing per product (in_stock/back_order), with shipping. */
function candidatesFor(
  product: Product,
  destination: Destination,
  options: LandedCostOptions,
): Candidate[] {
  const out: Candidate[] = [];
  for (const listing of product.listings ?? []) {
    if (listing.stockStatus !== "in_stock" && listing.stockStatus !== "back_order") {
      continue;
    }
    const distributor = getDistributorById(listing.distributorId);
    if (!distributor) continue;
    const cost = computeLandedCost(listing, distributor, destination, options);
    if (!cost) continue;
    out.push({
      productId: product.id,
      productName: product.name,
      distributorId: listing.distributorId,
      distributorName: distributor.name,
      itemCost: cost.total - cost.shipping,
      shipping: cost.shipping,
    });
  }
  return out;
}

function planFromStores(stores: BuildOrderStore[], currency: string, unassigned: string[]): BuildOrderPlan {
  const itemsTotal = stores.reduce((s, st) => s + st.itemsTotal, 0);
  const shippingTotal = stores.reduce((s, st) => s + st.shipping, 0);
  return { stores, itemsTotal, shippingTotal, total: itemsTotal + shippingTotal, currency, unassigned };
}

export function computeBuildOrder(
  watchlist: Product[],
  destination: Destination,
  options: LandedCostOptions,
): BuildOrderComparison {
  const perProduct = watchlist.map((p) => ({
    product: p,
    candidates: candidatesFor(p, destination, options),
  }));
  const unassigned = perProduct.filter((e) => e.candidates.length === 0).map((e) => e.product.id);

  // Split: cheapest candidate per product, grouped by distributor.
  const byStore = new Map<string, BuildOrderStore>();
  for (const { candidates } of perProduct) {
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => (b.itemCost < a.itemCost ? b : a));
    const store = byStore.get(best.distributorId) ?? {
      distributorId: best.distributorId,
      distributorName: best.distributorName,
      items: [],
      itemsTotal: 0,
      shipping: best.shipping,
      total: 0,
    };
    store.items.push({
      productId: best.productId,
      productName: best.productName,
      distributorId: best.distributorId,
      itemCost: best.itemCost,
    });
    store.itemsTotal += best.itemCost;
    byStore.set(best.distributorId, store);
  }
  const splitStores = [...byStore.values()].map((s) => ({ ...s, total: s.itemsTotal + s.shipping }));
  const split = planFromStores(splitStores, destination.currency, unassigned);

  // Single store: a distributor carrying EVERY product; cheapest item per product there.
  const allDistributorIds = new Set<string>();
  for (const { candidates } of perProduct) for (const c of candidates) allDistributorIds.add(c.distributorId);
  let singleStore: BuildOrderPlan | null = null;
  for (const distributorId of allDistributorIds) {
    const items: BuildOrderItem[] = [];
    let shipping = 0;
    let ok = true;
    for (const { candidates } of perProduct) {
      const here = candidates.filter((c) => c.distributorId === distributorId);
      if (here.length === 0) { ok = false; break; }
      const best = here.reduce((a, b) => (b.itemCost < a.itemCost ? b : a));
      items.push({ productId: best.productId, productName: best.productName, distributorId, itemCost: best.itemCost });
      shipping = best.shipping;
    }
    if (!ok) continue;
    const itemsTotal = items.reduce((s, i) => s + i.itemCost, 0);
    const distributor = getDistributorById(distributorId);
    const plan = planFromStores(
      [{ distributorId, distributorName: distributor?.name ?? distributorId, items, itemsTotal, shipping, total: itemsTotal + shipping }],
      destination.currency,
      [],
    );
    if (!singleStore || plan.total < singleStore.total) singleStore = plan;
  }

  return { split, singleStore, savings: split.total - (singleStore?.total ?? split.total) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/build-order.test.ts && pnpm check`
Expected: PASS (5 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/build-order.ts tests/build-order.test.ts
git commit -m "feat(build-order): computeBuildOrder"
```

---

### Task 2: The screen

**Files:** Create `app/build-order.tsx`; Test `tests/build-order-screen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/build-order-screen.test.tsx` (mirror the jsdom harness in `tests/available-screen.test.tsx`; mock `react-native`, `@/hooks/use-colors`, `@/components/ui/icon-symbol`, `expo-router`, `@/lib/storage` `getWatchlist`/`getSettings`, `@/components/screen-container`):

```tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", warning: "#fa0", error: "#f00" }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("@/components/screen-container", () => ({ ScreenContainer: ({ children }: any) => React.createElement("div", null, children) }));
vi.mock("expo-router", () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/storage", () => ({
  getWatchlist: async () => [
    { id: "p1", name: "P1", listings: [{ distributorId: "d1", productId: "p1", price: 100, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] }] },
  ],
  getSettings: async () => ({ displayCurrency: "USD", shipToCountry: "TH" }),
}));

import BuildOrderScreen from "../app/build-order";

afterEach(cleanup);

describe("BuildOrderScreen", () => {
  it("renders a purchasing plan", async () => {
    render(<BuildOrderScreen />);
    expect(await screen.findByText(/Plan order|single order|split/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/build-order-screen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/build-order.tsx` (default export `BuildOrderScreen`):
- Load `getWatchlist()` + `getSettings()`; build `destination = shipToCountry ? { countryCode, currency } : null` and `options = { taxExempt, includeImportEstimate }`.
- When `destination` is null, render a prompt: "Set where you ship to" with a button → `router.push("/(tabs)/settings")`.
- Otherwise `computeBuildOrder(watchlist, destination, options)` and render:
  - **Cheapest single order** card: store name, item count, `formatEstimate(itemsTotal) + formatEstimate(shipping) = formatEstimate(total)`, or "No single store has everything".
  - **Cheapest split** card: store count, items total + shipping total = total.
  - **Verdict** line: if `singleStore && savings > 0` → "Order everything from {name} and save {savings}"; if `singleStore && savings < 0` → "Splitting saves {|savings|}"; else "Similar cost either way".
  - Per-store breakdown: each store, its items, subtotal, shipping, total.
  - **Unassigned** parts listed when non-empty.
- Use `useColors()`, `IconSymbol`, `ScreenContainer`, `Stack.Screen options={{ title: "Plan order" }}`, `formatEstimate` from `@/lib/estimate-format`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/build-order-screen.test.tsx && pnpm check`
Expected: PASS (1 test); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add app/build-order.tsx tests/build-order-screen.test.tsx
git commit -m "feat(build-order): Plan order screen"
```

---

### Task 3: Watchlist entry + full verification + docs

**Files:** Modify `app/(tabs)/watchlist.tsx`; `todo.md`

- [ ] **Step 1: Add the entry**

In `app/(tabs)/watchlist.tsx`, add a **"Plan order"** action visible when `watchlist.length >= 2` — e.g. a `Pressable` row/button near the `SummaryCard` (line ~937) that calls `router.push("/build-order")`. Use `useColors()`, `IconSymbol` (e.g. `cart.fill`), and guard haptics on web.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 4: Document**

Add a `todo.md` phase entry (next number 1135): `computeBuildOrder`, the Plan order screen, the watchlist entry, and the note that cart/checkout + desktop parity are deferred.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/watchlist.tsx todo.md
git commit -m "feat(build-order): watchlist Plan order entry (Phase 1135)"
```

---

## Self-Review

- **Spec coverage:** planner (Task 1), screen (Task 2), entry + verify + docs (Task 3). Cart/checkout, a constraint solver, and desktop parity are out of scope per the spec.
- **Placeholders:** none — the planner and the test are given verbatim; Task 2/3 name the exact files, states, and strings.
- **Type consistency:** `BuildOrderItem`/`BuildOrderStore`/`BuildOrderPlan`/`BuildOrderComparison`; `computeBuildOrder(watchlist, destination, options)`; `computeLandedCost(listing, distributor, destination, options)`; `resolveShipping` — used consistently.
- **Per-order shipping:** `itemCost = cost.total - cost.shipping`; `shipping` counted once per store; `total = itemsTotal + shippingTotal`.
