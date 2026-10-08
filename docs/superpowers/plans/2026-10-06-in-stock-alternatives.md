# In-Stock Alternatives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a viewed product is out of stock, show in-stock catalog products in the same category, cheapest first, each tappable.

**Architecture:** A pure `pickAlternatives` (+ `localAlternatives` for standalone); an `AlternativesSection` card; product-detail wiring that fetches `catalog.available` by category and renders the section only at the dead end.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-in-stock-alternatives-design.md`

---

## File Structure

- Create `lib/alternatives.ts` — `pickAlternatives`, `localAlternatives`.
- Create `components/product/alternatives-section.tsx` — the section.
- Modify `app/product/[id].tsx` — wiring.
- Tests: `tests/alternatives.test.ts`, `tests/alternatives-section.test.tsx`.

---

### Task 1: Pure selector

**Files:** Create `lib/alternatives.ts`; Test `tests/alternatives.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/alternatives.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickAlternatives, localAlternatives } from "../lib/alternatives";
import type { AvailableProduct, Product } from "../lib/types";

function avail(id: string, category: string, price: number): AvailableProduct {
  return {
    id, name: id, brand: "X", category, modelNumber: id,
    bestPrice: price, bestCurrency: "USD", bestDistributorId: "d1",
    storeCount: 2, fetchedAt: 1000,
  };
}

describe("pickAlternatives", () => {
  it("filters to the category, excludes self, sorts by price, caps at limit", () => {
    const available = [
      avail("self", "Switch", 1),
      avail("b", "Switch", 300),
      avail("a", "Switch", 100),
      avail("c", "Switch", 200),
      avail("d", "Switch", 400),
      avail("e", "Switch", 500),
      avail("f", "Switch", 600),
      avail("other", "Router", 50),
    ];
    const out = pickAlternatives({ product: { id: "self", category: "Switch" }, available });
    expect(out.map((a) => a.id)).toEqual(["a", "c", "b", "d", "e"]);
    expect(out).toHaveLength(5);
  });

  it("returns [] when none match", () => {
    expect(
      pickAlternatives({ product: { id: "self", category: "Switch" }, available: [avail("x", "Router", 1)] }),
    ).toEqual([]);
  });
});

describe("localAlternatives", () => {
  it("builds from in-stock watchlist products in the category, excluding self", () => {
    const watchlist = [
      { id: "self", name: "self", category: "Switch", listings: [] },
      {
        id: "a", name: "A", category: "Switch",
        listings: [{ distributorId: "d1", price: 100, currency: "USD", stockStatus: "in_stock" }],
      },
      {
        id: "b", name: "B", category: "Switch",
        listings: [{ distributorId: "d1", price: 50, currency: "USD", stockStatus: "out_of_stock" }],
      },
      {
        id: "c", name: "C", category: "Router",
        listings: [{ distributorId: "d1", price: 10, currency: "USD", stockStatus: "in_stock" }],
      },
    ] as unknown as Product[];
    const out = localAlternatives({ id: "self", category: "Switch" }, watchlist, "USD");
    expect(out.map((a) => a.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/alternatives.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/alternatives.ts`:

```ts
import type { AvailableProduct, Product } from "./types";
import { getBestPrice } from "./currency";

export interface Alternative {
  id: string;
  name: string;
  brand: string;
  modelNumber: string;
  bestPrice: number;
  bestCurrency: string;
  storeCount: number;
}

/**
 * In-stock catalog products in the same category as `product`, excluding the
 * product itself, cheapest first. Returns [] when none — the caller hides the
 * section. "Same category" is a coarse notion of equivalent (a 24-port and a
 * 5-port switch share a category), so the UI says "in stock in {category}".
 */
export function pickAlternatives(input: {
  product: { id: string; category: string };
  available: AvailableProduct[];
  limit?: number;
}): Alternative[] {
  const limit = input.limit ?? 5;
  return input.available
    .filter((a) => a.category === input.product.category && a.id !== input.product.id)
    .sort((a, b) => a.bestPrice - b.bestPrice)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      name: a.name,
      brand: a.brand,
      modelNumber: a.modelNumber,
      bestPrice: a.bestPrice,
      bestCurrency: a.bestCurrency,
      storeCount: a.storeCount,
    }));
}

/** Standalone fallback: in-stock watchlist products in the category, cheapest first. */
export function localAlternatives(
  product: { id: string; category: string },
  watchlist: Product[],
  displayCurrency: string,
  limit = 5,
): Alternative[] {
  const out: Alternative[] = [];
  for (const p of watchlist) {
    if (p.id === product.id || p.category !== product.category) continue;
    const inStock = (p.listings ?? []).filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) continue;
    const best = getBestPrice(inStock, displayCurrency);
    if (!best) continue;
    out.push({
      id: p.id,
      name: p.name,
      brand: p.brand,
      modelNumber: p.modelNumber,
      bestPrice: best.price,
      bestCurrency: best.currency,
      storeCount: inStock.length,
    });
  }
  return out.sort((a, b) => a.bestPrice - b.bestPrice).slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/alternatives.test.ts && pnpm check`
Expected: PASS (3 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/alternatives.ts tests/alternatives.test.ts
git commit -m "feat(alternatives): pickAlternatives + localAlternatives"
```

---

### Task 2: The section

**Files:** Create `components/product/alternatives-section.tsx`; Test `tests/alternatives-section.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/alternatives-section.test.tsx` (mirror the jsdom harness in `tests/away-summary-card.test.tsx`; mock `react-native` with `View`/`Text`/`Pressable`/`TouchableOpacity`, `@/hooks/use-colors`, `@/components/ui/icon-symbol`, `expo-router`):

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", error: "#f00", warning: "#fa0" }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
const push = vi.fn();
vi.mock("expo-router", () => ({ useRouter: () => ({ push }) }));

import { AlternativesSection } from "../components/product/alternatives-section";

afterEach(() => { cleanup(); push.mockClear(); });

const alts = [
  { id: "a", name: "CRS326", brand: "MikroTik", modelNumber: "CRS326", bestPrice: 209, bestCurrency: "USD", storeCount: 3 },
];

describe("AlternativesSection", () => {
  it("renders the category header and rows", () => {
    render(<AlternativesSection category="Networking Switch" alternatives={alts as any} />);
    expect(screen.getByText(/In stock now in Networking Switch/i)).toBeTruthy();
    expect(screen.getByText(/CRS326/)).toBeTruthy();
  });

  it("navigates to an alternative on tap", () => {
    render(<AlternativesSection category="Networking Switch" alternatives={alts as any} />);
    fireEvent.click(screen.getByText(/CRS326/));
    expect(push).toHaveBeenCalledWith("/product/a");
  });

  it("renders nothing when there are no alternatives", () => {
    const { container } = render(<AlternativesSection category="Networking Switch" alternatives={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/alternatives-section.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/product/alternatives-section.tsx`:

```ts
export function AlternativesSection({
  category,
  alternatives,
}: {
  category: string;
  alternatives: Alternative[];
}): JSX.Element | null;
```

- Return `null` when `alternatives.length === 0`.
- Otherwise a card (surface/border/radius, `useColors()`): header "In stock now in {category}", then each alternative as a `TouchableOpacity` row showing `name · formatPrice(bestPrice, bestCurrency) · N stores`, tapping → `router.push(\`/product/${id}\`)`.
- Import `Alternative` from `@/lib/alternatives`, `formatPrice` from `@shared/currency`, `useRouter` from `expo-router`, `IconSymbol` from `@/components/ui/icon-symbol`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/alternatives-section.test.tsx && pnpm check`
Expected: PASS (3 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/product/alternatives-section.tsx tests/alternatives-section.test.tsx
git commit -m "feat(alternatives): in-stock alternatives section"
```

---

### Task 3: Wiring + full verification + docs

**Files:** Modify `app/product/[id].tsx`; `todo.md`

- [ ] **Step 1: Implement the wiring**

In `app/product/[id].tsx`:
- Import `pickAlternatives`, `localAlternatives`, `type Alternative` from `@/lib/alternatives`; `fetchAvailable` from `@/lib/server-catalog`; `isServerConfigured` from `@/constants/oauth`; `getWatchlist` from `@/lib/storage`; `AlternativesSection` from `@/components/product/alternatives-section`.
- Add state: `const [alternatives, setAlternatives] = useState<Alternative[]>([]);`.
- Add an effect (after `bestInStockListing` is computed) that runs when `product?.category` is known, `effectiveCurrency` is set, and the product is out of stock (`bestInStockListing == null`):
```ts
  useEffect(() => {
    if (!product?.category || bestInStockListing != null) {
      setAlternatives([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const available = isServerConfigured()
          ? await fetchAvailable({ category: product.category, currency: effectiveCurrency })
          : localAlternatives(
              { id, category: product.category },
              await getWatchlist(),
              effectiveCurrency,
            );
        if (!active) return;
        setAlternatives(
          pickAlternatives({
            product: { id, category: product.category },
            available,
          }),
        );
      } catch {
        if (active) setAlternatives([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [product?.category, bestInStockListing, effectiveCurrency, id]);
```
- Render after `<DistributorListingSection ... />` (line ~720), gated on the dead end:
```tsx
          {bestInStockListing == null && product?.category && (
            <AlternativesSection category={product.category} alternatives={alternatives} />
          )}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 4: Document**

Add a `todo.md` phase entry (next number 1133): `pickAlternatives`/`localAlternatives`, the section, the dead-end-only wiring, and the note that a recommendation engine + desktop parity are deferred.

- [ ] **Step 5: Commit**

```bash
git add app/product/\[id\].tsx todo.md
git commit -m "feat(alternatives): show in-stock alternatives at the dead end (Phase 1133)"
```

---

## Self-Review

- **Spec coverage:** selector + local fallback (Task 1), section (Task 2), wiring + verify + docs (Task 3). A recommendation engine and desktop parity are out of scope per the spec.
- **Placeholders:** none — the selector, the section, and the wiring are given verbatim.
- **Type consistency:** `Alternative`; `pickAlternatives({ product, available, limit? })`; `localAlternatives(product, watchlist, currency, limit?)`; `AlternativesSection({ category, alternatives })` — used consistently.
- **Dead-end only:** the section renders only when `bestInStockListing == null`; the effect clears alternatives otherwise.
