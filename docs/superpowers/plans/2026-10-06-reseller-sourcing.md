# Reseller Sourcing Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reseller set quantity + a target sell price per product and see margin per unit/total, total outlay, and the cross-distributor spread.

**Architecture:** `Product` gains `quantity`/`targetSellPrice`/`sellCurrency`; a pure `computeSourcing` reuses `rankByLandedCost`/`computeLandedCost`; a "Sourcing sheet" screen renders the table; a modal edits quantity/sell price via a new storage helper.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-reseller-sourcing-design.md`

---

## File Structure

- Modify `lib/types.ts` — `Product.quantity`/`targetSellPrice`/`sellCurrency`.
- Modify `lib/storage/watchlist.ts` + `lib/storage/index.ts` — `updateProductSourcing`.
- Create `lib/reseller.ts` — `computeSourcing`.
- Create `app/sourcing.tsx` — the screen.
- Create `components/sourcing/sourcing-sheet.tsx` — the edit modal.
- Modify `app/(tabs)/watchlist.tsx` — the entry.
- Tests: `tests/reseller.test.ts`, `tests/sourcing-storage.test.ts`, `tests/sourcing-screen.test.tsx`.

---

### Task 1: Model + storage helper

**Files:** Modify `lib/types.ts`, `lib/storage/watchlist.ts`, `lib/storage/index.ts`; Test `tests/sourcing-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sourcing-storage.test.ts` (copy the AsyncStorage mock from `tests/last-seen-storage.test.ts`):

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

import { addToWatchlist, getWatchlist, updateProductSourcing } from "../lib/storage";

beforeEach(() => store.clear());

const product = {
  id: "p1", name: "P1", modelNumber: "M1", brand: "X", category: "Router",
  description: "", isWatched: true, addedAt: "2026-01-01T00:00:00.000Z", listings: [],
} as never;

describe("updateProductSourcing", () => {
  it("sets quantity and target sell price", async () => {
    await addToWatchlist(product);
    await updateProductSourcing("p1", { quantity: 20, targetSellPrice: 280, sellCurrency: "USD" });
    const p = (await getWatchlist())[0]!;
    expect(p.quantity).toBe(20);
    expect(p.targetSellPrice).toBe(280);
    expect(p.sellCurrency).toBe("USD");
  });

  it("clears the fields when passed null", async () => {
    await addToWatchlist(product);
    await updateProductSourcing("p1", { quantity: 5, targetSellPrice: 100, sellCurrency: "USD" });
    await updateProductSourcing("p1", { quantity: null, targetSellPrice: null });
    const p = (await getWatchlist())[0]!;
    expect(p.quantity).toBeUndefined();
    expect(p.targetSellPrice).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/sourcing-storage.test.ts`
Expected: FAIL — `updateProductSourcing` not exported.

- [ ] **Step 3: Implement**

In `lib/types.ts`, add to `Product`:

```ts
  /** Units the user intends to buy (reseller sourcing). Default 1. */
  quantity?: number;
  /** User-supplied target sell price per unit, in `sellCurrency`. */
  targetSellPrice?: number;
  sellCurrency?: string;
```

In `lib/storage/watchlist.ts`, add (mirroring `updateProductDetails`):

```ts
  async function updateProductSourcing(
    productId: string,
    fields: {
      quantity?: number | null;
      targetSellPrice?: number | null;
      sellCurrency?: string;
    },
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) => {
        if (p.id !== productId) return p;
        const next: Product = { ...p };
        if (fields.quantity === null) delete next.quantity;
        else if (typeof fields.quantity === "number" && Number.isFinite(fields.quantity) && fields.quantity > 0) {
          next.quantity = Math.floor(fields.quantity);
        }
        if (fields.targetSellPrice === null) delete next.targetSellPrice;
        else if (typeof fields.targetSellPrice === "number" && Number.isFinite(fields.targetSellPrice) && fields.targetSellPrice > 0) {
          next.targetSellPrice = fields.targetSellPrice;
        }
        if (fields.sellCurrency !== undefined) next.sellCurrency = fields.sellCurrency;
        return next;
      });
      await persistWatchlist(updated);
      notify("watchlist", productId);
    });
  }
```

Add `updateProductSourcing` to the factory's returned object, and re-export it from `lib/storage/index.ts` (beside `updateProductDetails`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/sourcing-storage.test.ts && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage/watchlist.ts lib/storage/index.ts tests/sourcing-storage.test.ts
git commit -m "feat(sourcing): Product quantity/sell fields + updateProductSourcing"
```

---

### Task 2: Pure math — `computeSourcing`

**Files:** Create `lib/reseller.ts`; Test `tests/reseller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/reseller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeSourcing } from "../lib/reseller";
import type { Product } from "../lib/types";

function listing(distributorId: string, price: number, stockStatus = "in_stock") {
  return {
    distributorId, productId: "x", price, currency: "USD", stockStatus,
    url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [],
  };
}

const dest = { countryCode: "TH", currency: "USD" };

describe("computeSourcing", () => {
  it("computes buy/unit, spread, margin, and totals", () => {
    const wl = [
      {
        id: "p1", name: "P1", quantity: 20, targetSellPrice: 280, sellCurrency: "USD",
        listings: [listing("balticnetworks-us", 200), listing("linktechs-us", 250)],
      },
    ] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    const line = s.lines[0]!;
    expect(line.quantity).toBe(20);
    expect(line.buyUnit).not.toBeNull();
    expect(line.spreadMin).not.toBeNull();
    expect(line.spreadMax).not.toBeNull();
    expect(line.spreadMax! > line.spreadMin!).toBe(true);
    expect(line.marginUnit).toBeCloseTo(280 - line.buyUnit!, 5);
    expect(line.marginTotal).toBeCloseTo(line.marginUnit! * 20, 5);
    expect(s.totalOutlay).toBeCloseTo(line.buyUnit! * 20, 5);
    expect(s.totalMargin).toBeCloseTo(line.marginTotal!, 5);
  });

  it("defaults quantity to 1 and leaves margin null without a sell price", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 200)] },
    ] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    expect(s.lines[0]!.quantity).toBe(1);
    expect(s.lines[0]!.sellUnit).toBeNull();
    expect(s.lines[0]!.marginUnit).toBeNull();
    expect(s.totalMargin).toBeNull();
  });

  it("leaves buy/margin null when there is no purchasable listing", () => {
    const wl = [
      { id: "p1", name: "P1", listings: [listing("balticnetworks-us", 200, "out_of_stock")] },
    ] as unknown as Product[];
    const s = computeSourcing(wl, dest, {});
    expect(s.lines[0]!.buyUnit).toBeNull();
    expect(s.lines[0]!.marginUnit).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/reseller.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/reseller.ts`:

```ts
import type { Product } from "./types";
import { convertPrice } from "./currency";
import { rankByLandedCost, type Destination, type LandedCostOptions } from "./landed-cost";

export interface SourcingLine {
  productId: string;
  productName: string;
  quantity: number;
  buyUnit: number | null;
  spreadMin: number | null;
  spreadMax: number | null;
  sellUnit: number | null;
  marginUnit: number | null;
  marginTotal: number | null;
  currency: string;
}

export interface SourcingSummary {
  lines: SourcingLine[];
  totalMargin: number | null;
  totalOutlay: number;
  currency: string;
}

export function computeSourcing(
  watchlist: Product[],
  destination: Destination,
  options: LandedCostOptions,
): SourcingSummary {
  const currency = destination.currency;
  const lines: SourcingLine[] = watchlist.map((product) => {
    const ranked = rankByLandedCost(product.listings ?? [], destination, {
      ...options,
      category: product.category,
    });
    const buyUnit = ranked.length > 0 ? ranked[0]!.total : null;
    const inStock = ranked.filter((r) => r.total > 0);
    const spreadMin = inStock.length > 0 ? Math.min(...inStock.map((r) => r.total)) : null;
    const spreadMax = inStock.length > 0 ? Math.max(...inStock.map((r) => r.total)) : null;
    const sellUnit =
      product.targetSellPrice != null && Number.isFinite(product.targetSellPrice)
        ? convertPrice(product.targetSellPrice, product.sellCurrency ?? currency, currency)
        : null;
    const quantity =
      product.quantity != null && Number.isFinite(product.quantity) && product.quantity > 0
        ? Math.floor(product.quantity)
        : 1;
    const marginUnit = sellUnit != null && buyUnit != null ? sellUnit - buyUnit : null;
    const marginTotal = marginUnit != null ? marginUnit * quantity : null;
    return {
      productId: product.id,
      productName: product.name,
      quantity,
      buyUnit,
      spreadMin,
      spreadMax,
      sellUnit,
      marginUnit,
      marginTotal,
      currency,
    };
  });

  const withBuy = lines.filter((l) => l.buyUnit != null);
  const totalOutlay = withBuy.reduce((s, l) => s + l.buyUnit! * l.quantity, 0);
  const withMargin = lines.filter((l) => l.marginTotal != null);
  const totalMargin =
    withMargin.length > 0 ? withMargin.reduce((s, l) => s + l.marginTotal!, 0) : null;

  return { lines, totalMargin, totalOutlay, currency };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/reseller.test.ts && pnpm check`
Expected: PASS (3 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/reseller.ts tests/reseller.test.ts
git commit -m "feat(sourcing): computeSourcing"
```

---

### Task 3: Sourcing sheet modal + screen

**Files:** Create `components/sourcing/sourcing-sheet.tsx`, `app/sourcing.tsx`; Test `tests/sourcing-screen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/sourcing-screen.test.tsx` (mirror the jsdom harness in `tests/build-order-screen.test.tsx`; mock `react-native`, `@/hooks/use-colors`, `@/components/ui/icon-symbol`, `@/components/screen-container`, `expo-router`, `@/lib/storage` `getWatchlist`/`getSettings`):

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
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
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
vi.mock("expo-router", () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

const state: { shipToCountry: string | null } = { shipToCountry: "TH" };
vi.mock("@/lib/storage", () => ({
  getWatchlist: async () => [
    { id: "p1", name: "P1", quantity: 20, targetSellPrice: 280, sellCurrency: "USD", listings: [{ distributorId: "balticnetworks-us", productId: "p1", price: 200, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] }] },
  ],
  getSettings: async () => ({ displayCurrency: "USD", shipToCountry: state.shipToCountry }),
}));

import SourcingScreen from "../app/sourcing";

afterEach(() => {
  cleanup();
  state.shipToCountry = "TH";
});

describe("SourcingScreen", () => {
  it("renders a product line with its quantity", async () => {
    render(<SourcingScreen />);
    expect(await screen.findByText(/P1/)).toBeTruthy();
    expect(screen.getByText(/20/)).toBeTruthy();
  });

  it("prompts to set a destination when shipToCountry is unset", async () => {
    state.shipToCountry = null;
    render(<SourcingScreen />);
    expect(await screen.findByText(/Set where you ship to/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/sourcing-screen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/sourcing/sourcing-sheet.tsx` — a modal (mirror `components/search/manual-add-sheet.tsx`) with a quantity `TextInput` (numeric) and a target-sell-price `TextInput`, a Save button calling `updateProductSourcing(productId, { quantity, targetSellPrice, sellCurrency: currency })`, and a Clear button calling `updateProductSourcing(productId, { quantity: null, targetSellPrice: null })`. Props: `{ visible, productId, productName, quantity?, targetSellPrice?, currency, onClose, onSaved }`.

Create `app/sourcing.tsx` (default export `SourcingScreen`):
- Load `getWatchlist()` + `getSettings()` (state + effect with an `active` guard).
- Build `destination` (null when no `shipToCountry`) and `options`.
- No destination → a "Set where you ship to" prompt → `/(tabs)/settings`.
- Else `computeSourcing(watchlist, destination, options)` (memoized) and render a table: per line — product, qty, buy/unit, sell/unit, margin/unit, margin total, spread (`$min–$max`); a summary — total outlay + total margin. A "Set sell price" affordance per row opens the sourcing sheet.
- Back affordance via `goBackOrHome(router)`; `Stack.Screen options={{ title: "Sourcing sheet" }}`; `useColors()`, `IconSymbol`, `ScreenContainer`, `formatEstimate`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/sourcing-screen.test.tsx && pnpm check`
Expected: PASS (2 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/sourcing/sourcing-sheet.tsx app/sourcing.tsx tests/sourcing-screen.test.tsx
git commit -m "feat(sourcing): Sourcing sheet screen + edit modal"
```

---

### Task 4: Watchlist entry + full verification + docs

**Files:** Modify `app/(tabs)/watchlist.tsx`; `todo.md`

- [ ] **Step 1: Add the entry**

In `app/(tabs)/watchlist.tsx`, add a **"Sourcing sheet"** row beside the existing "Plan order" row (shown when `watchlist.length > 0`) → `router.push("/sourcing")`. Use `useColors()`, `IconSymbol` (e.g. `dollarsign.circle.fill`), guard haptics on web, matching the "Plan order" row's styling.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 4: Document**

Add a `todo.md` phase entry (next number 1136): the `Product` sourcing fields, `updateProductSourcing`, `computeSourcing`, the Sourcing sheet screen + modal, the watchlist entry, and the note that automated sell-side comps + desktop parity are deferred.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/watchlist.tsx todo.md
git commit -m "feat(sourcing): watchlist Sourcing sheet entry (Phase 1136)"
```

---

## Self-Review

- **Spec coverage:** model + storage (Task 1), math (Task 2), screen + modal (Task 3), entry + verify + docs (Task 4). Automated sell-side comps and desktop parity are out of scope per the spec.
- **Placeholders:** none — the storage helper, the math, and the tests are given verbatim; Task 3/4 name the exact files, props, and strings.
- **Type consistency:** `Product.quantity?`/`targetSellPrice?`/`sellCurrency?`; `updateProductSourcing(productId, fields)`; `SourcingLine`/`SourcingSummary`; `computeSourcing(watchlist, destination, options)` — used consistently.
- **Honesty:** no sell price → `sellUnit`/`marginUnit`/`marginTotal` null → "—"; never invented.
