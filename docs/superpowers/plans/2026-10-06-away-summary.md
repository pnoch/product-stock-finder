# "While You Were Away" Diff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On opening Home, show what changed on the watchlist since the user last looked — price drops/rises, restocks, stock-outs — as a dismissible card.

**Architecture:** A `lastSeenAt` timestamp; a pure `computeAwaySummary` diffing `priceHistory` over `[lastSeenAt, now]`; a Home card rendering it; Home wiring that reads, computes, renders, then advances the timestamp.

**Tech Stack:** TypeScript, React Native / Expo, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-away-summary-design.md`

---

## File Structure

- Modify `lib/storage/context.ts` — `LAST_SEEN_AT` key.
- Modify `lib/storage/discovery.ts` — `getLastSeenAt`/`setLastSeenAt`.
- Modify `lib/storage/index.ts` — wipe the key.
- Create `lib/away-summary.ts` — `computeAwaySummary`.
- Create `components/home/away-summary-card.tsx` — the card.
- Modify `app/(tabs)/index.tsx` — wiring.
- Tests: `tests/away-summary.test.ts`, `tests/last-seen-storage.test.ts`, `tests/away-summary-card.test.tsx`.

---

### Task 1: Storage — last seen at

**Files:** Modify `lib/storage/context.ts`, `lib/storage/discovery.ts`, `lib/storage/index.ts`; Test `tests/last-seen-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/last-seen-storage.test.ts` (copy the AsyncStorage mock from `tests/last-background-run-storage.test.ts`):

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

import { getLastSeenAt, setLastSeenAt, clearAllData } from "../lib/storage";

beforeEach(() => store.clear());

describe("last seen at", () => {
  it("round-trips a timestamp", async () => {
    await setLastSeenAt(1_700_000_000_000);
    expect(await getLastSeenAt()).toBe(1_700_000_000_000);
  });

  it("returns null when never set", async () => {
    expect(await getLastSeenAt()).toBeNull();
  });

  it("returns null for a corrupt value", async () => {
    store.set("last_seen_at", "nope");
    expect(await getLastSeenAt()).toBeNull();
  });

  it("is wiped by clearAllData", async () => {
    await setLastSeenAt(1_700_000_000_000);
    await clearAllData();
    expect(await getLastSeenAt()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/last-seen-storage.test.ts`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

In `lib/storage/context.ts`, add to `STORAGE_KEYS`: `LAST_SEEN_AT: "last_seen_at",`

In `lib/storage/discovery.ts` `createBackgroundTaskStorage`, add (mirroring `getLastBackgroundRun`):

```ts
  async function getLastSeenAt(): Promise<number | null> {
    try {
      const raw = await adapter.getItem(KEYS.LAST_SEEN_AT);
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  async function setLastSeenAt(ts: number): Promise<void> {
    await enqueue(KEYS.LAST_SEEN_AT, async () => {
      try {
        await adapter.setItem(KEYS.LAST_SEEN_AT, String(ts));
      } catch {
        // best effort
      }
    });
  }
```

Add both to the factory's returned object. In `lib/storage/index.ts` `clearAllData`, add `STORAGE_KEYS.LAST_SEEN_AT,` beside `STORAGE_KEYS.LAST_BACKGROUND_RUN`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/last-seen-storage.test.ts && pnpm check`
Expected: PASS (4 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/context.ts lib/storage/discovery.ts lib/storage/index.ts tests/last-seen-storage.test.ts
git commit -m "feat(away): persist the last-seen timestamp"
```

---

### Task 2: Pure diff — `computeAwaySummary`

**Files:** Create `lib/away-summary.ts`; Test `tests/away-summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/away-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeAwaySummary } from "../lib/away-summary";
import type { Product } from "../lib/types";

const DAY = 86_400_000;
const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const SINCE = NOW - 3 * DAY;

function product(
  id: string,
  listings: Array<{ distributorId: string; price: number; stockStatus: string; date: string }>,
): Product {
  return {
    id, name: id, modelNumber: id, brand: "X", category: "Router",
    isWatched: true, addedAt: new Date(SINCE - DAY).toISOString(),
    listings: listings.map((l) => ({
      distributorId: l.distributorId, productId: id, price: l.price, currency: "USD",
      stockStatus: l.stockStatus, url: "", lastChecked: l.date,
      priceHistory: [{ date: l.date, price: l.price, currency: "USD", stockStatus: l.stockStatus }],
    })),
  } as unknown as Product;
}

describe("computeAwaySummary", () => {
  it("detects a price drop beyond the threshold", () => {
    const p = product("p1", [
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - DAY).toISOString() },
      { distributorId: "d1", price: 90, stockStatus: "in_stock", date: new Date(NOW).toISOString() },
    ]);
    const s = computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })!;
    expect(s.priceDrops).toHaveLength(1);
    expect(s.priceDrops[0]!.pct).toBeLessThan(0);
  });

  it("detects a restock", () => {
    const p = product("p2", [
      { distributorId: "d1", price: 100, stockStatus: "out_of_stock", date: new Date(SINCE - DAY).toISOString() },
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(NOW).toISOString() },
    ]);
    const s = computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })!;
    expect(s.restocks).toHaveLength(1);
  });

  it("detects a stock-out", () => {
    const p = product("p3", [
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - DAY).toISOString() },
      { distributorId: "d1", price: 100, stockStatus: "out_of_stock", date: new Date(NOW).toISOString() },
    ]);
    const s = computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })!;
    expect(s.stockOuts).toHaveLength(1);
  });

  it("returns null when nothing changed", () => {
    const p = product("p4", [
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(SINCE - DAY).toISOString() },
      { distributorId: "d1", price: 100, stockStatus: "in_stock", date: new Date(NOW).toISOString() },
    ]);
    expect(computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })).toBeNull();
  });

  it("skips a product with no history at or before since", () => {
    const p = product("p5", [
      { distributorId: "d1", price: 50, stockStatus: "in_stock", date: new Date(NOW).toISOString() },
    ]);
    expect(computeAwaySummary({ watchlist: [p], since: SINCE, now: NOW, displayCurrency: "USD" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/away-summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/away-summary.ts`:

```ts
import type { Product } from "./types";
import { getBestPrice } from "./currency";
import { bestPricePoints } from "./product-insights";

export interface AwayItem {
  productId: string;
  name: string;
  pct?: number;
  price?: number;
  currency?: string;
  distributorId?: string;
}

export interface AwaySummary {
  priceDrops: AwayItem[];
  priceRises: AwayItem[];
  restocks: AwayItem[];
  stockOuts: AwayItem[];
  since: number;
}

/**
 * What changed on the watchlist since `since`. All derived from stored price
 * history — no new scraping. Returns null when nothing changed (no "no changes"
 * card), and skips a product with no history at/before `since` (no basis, so a
 * false "no change" is impossible).
 */
export function computeAwaySummary(input: {
  watchlist: Product[];
  since: number;
  now: number;
  displayCurrency: string;
  minDropPct?: number;
}): AwaySummary | null {
  const { watchlist, since, now, displayCurrency } = input;
  const minDropPct = input.minDropPct ?? 3;
  const priceDrops: AwayItem[] = [];
  const priceRises: AwayItem[] = [];
  const restocks: AwayItem[] = [];
  const stockOuts: AwayItem[] = [];

  for (const product of watchlist) {
    const listings = product.listings ?? [];

    // Price change: best price at/before `since` vs the current best.
    const points = bestPricePoints(listings, displayCurrency);
    const before = [...points].reverse().find((p) => p.t <= since);
    const current = getBestPrice(listings, displayCurrency);
    if (before && current && before.v > 0) {
      const pct = ((current.price - before.v) / before.v) * 100;
      if (pct <= -minDropPct) {
        priceDrops.push({ productId: product.id, name: product.name, pct, price: current.price, currency: current.currency });
      } else if (pct >= minDropPct) {
        priceRises.push({ productId: product.id, name: product.name, pct, price: current.price, currency: current.currency });
      }
    }

    // Restock / stock-out: per listing, compare in-stock presence across `since`.
    for (const listing of listings) {
      const history = listing.priceHistory ?? [];
      const hadInStockBefore = history.some(
        (p) => p.stockStatus === "in_stock" && Date.parse(p.date) <= since,
      );
      const hasInStockAfter = history.some(
        (p) => p.stockStatus === "in_stock" && Date.parse(p.date) > since,
      );
      if (!hadInStockBefore && hasInStockAfter) {
        restocks.push({ productId: product.id, name: product.name, distributorId: listing.distributorId });
      } else if (hadInStockBefore && !hasInStockAfter) {
        stockOuts.push({ productId: product.id, name: product.name, distributorId: listing.distributorId });
      }
    }
  }

  if (
    priceDrops.length === 0 &&
    priceRises.length === 0 &&
    restocks.length === 0 &&
    stockOuts.length === 0
  ) {
    return null;
  }
  return { priceDrops, priceRises, restocks, stockOuts, since };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/away-summary.test.ts && pnpm check`
Expected: PASS (5 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/away-summary.ts tests/away-summary.test.ts
git commit -m "feat(away): computeAwaySummary diff"
```

---

### Task 3: Home card

**Files:** Create `components/home/away-summary-card.tsx`; Test `tests/away-summary-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/away-summary-card.test.tsx` (mirror the jsdom harness in `tests/availability-card.test.tsx`; mock `react-native` with `View`/`Text`/`Pressable`/`TouchableOpacity`, `@/hooks/use-colors`, `@/components/ui/icon-symbol`, `expo-router`):

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

import { AwaySummaryCard } from "../components/home/away-summary-card";

afterEach(() => { cleanup(); push.mockClear(); });

const summary = {
  priceDrops: [{ productId: "p1", name: "CRS804", pct: -10, price: 90, currency: "USD" }],
  priceRises: [], restocks: [{ productId: "p2", name: "Pi 5", distributorId: "d1" }],
  stockOuts: [], since: Date.now() - 86400000,
};

describe("AwaySummaryCard", () => {
  it("renders the counts", () => {
    render(<AwaySummaryCard summary={summary as any} onDismiss={() => {}} />);
    expect(screen.getByText(/While you were away/i)).toBeTruthy();
    expect(screen.getByText(/1 price drop/i)).toBeTruthy();
    expect(screen.getByText(/1 back in stock/i)).toBeTruthy();
  });

  it("navigates to a product on tap", () => {
    render(<AwaySummaryCard summary={summary as any} onDismiss={() => {}} />);
    fireEvent.click(screen.getByText(/CRS804/));
    expect(push).toHaveBeenCalledWith("/product/p1");
  });

  it("calls onDismiss", () => {
    const onDismiss = vi.fn();
    render(<AwaySummaryCard summary={summary as any} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText(/dismiss/i));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/away-summary-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/home/away-summary-card.tsx`:

```ts
export function AwaySummaryCard({
  summary,
  onDismiss,
}: {
  summary: AwaySummary;
  onDismiss: () => void;
}): JSX.Element;
```

Render a card (surface/border/radius, `useColors()`):
- Header: "While you were away" + a close `Pressable` (`accessibilityLabel="Dismiss"`, icon `xmark`) calling `onDismiss`.
- A counts line built from the non-empty buckets: `${n} price drop(s)`, `${n} back in stock`, `${n} now out of stock` (pluralize; omit empty buckets).
- The top 3 items (drops first, then restocks, then stock-outs): name + change; each a `TouchableOpacity` → `router.push(\`/product/${productId}\`)`.
- A "See all" toggle (local state) expanding to the full list.
- Import `AwaySummary` from `@/lib/away-summary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/away-summary-card.test.tsx && pnpm check`
Expected: PASS (3 tests); 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/home/away-summary-card.tsx tests/away-summary-card.test.tsx
git commit -m "feat(away): While-you-were-away Home card"
```

---

### Task 4: Wiring + full verification + docs

**Files:** Modify `app/(tabs)/index.tsx`; `todo.md`

- [ ] **Step 1: Implement the wiring**

In `app/(tabs)/index.tsx`:
- Import `computeAwaySummary` from `@/lib/away-summary`, `AwaySummaryCard` from `@/components/home/away-summary-card`, `getLastSeenAt`/`setLastSeenAt` from `@/lib/storage`.
- Add state `const [awaySummary, setAwaySummary] = useState<AwaySummary | null>(null);` and `const [awayDismissed, setAwayDismissed] = useState(false);`.
- In the existing `loadData` (or a dedicated effect after the watchlist loads), once the watchlist is available:
```ts
    const seen = await getLastSeenAt();
    if (seen != null && watchlist.length > 0) {
      setAwaySummary(
        computeAwaySummary({
          watchlist,
          since: seen,
          now: Date.now(),
          displayCurrency: settings?.displayCurrency ?? "USD",
        }),
      );
    }
    await setLastSeenAt(Date.now());
```
(Use the component's already-loaded `watchlist` and `settings`; place it where both are available, e.g. inside `loadData` after they are set.)
- Render above `<AvailableSection />` (line ~679):
```tsx
          {awaySummary && !awayDismissed && (
            <AwaySummaryCard summary={awaySummary} onDismiss={() => setAwayDismissed(true)} />
          )}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 3: Run the full gate**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 4: Document**

Add a `todo.md` phase entry (next number 1132): the `lastSeenAt` timestamp, `computeAwaySummary`, the Home card, and the note that a full activity timeline + desktop parity are deferred.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/index.tsx todo.md
git commit -m "feat(away): wire the away summary into Home (Phase 1132)"
```

---

## Self-Review

- **Spec coverage:** storage (Task 1), diff (Task 2), card (Task 3), wiring + verify + docs (Task 4). A full timeline and desktop parity are out of scope per the spec.
- **Placeholders:** none — the storage fns, the diff, and the card/test are given verbatim; Task 4 names the exact files, states, and placement.
- **Type consistency:** `AwayItem`/`AwaySummary`; `computeAwaySummary(input)`; `getLastSeenAt`/`setLastSeenAt`; `AwaySummaryCard({ summary, onDismiss })` — used consistently.
- **Honest null:** `computeAwaySummary` returns `null` when nothing changed and skips products with no pre-`since` history.
