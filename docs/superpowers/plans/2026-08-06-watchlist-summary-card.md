# Watchlist Summary Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a summary card to the Watchlist screen in both mobile (Expo) and desktop (Tauri) apps showing total watchlist value (converted to display currency) and stock status counts.

**Architecture:** A shared pure utility `lib/watchlist-summary.ts` computes the summary from the watchlist and display currency. Both mobile and desktop Watchlist screens import it and render a summary card. The utility uses existing `convertPrice()` and `formatPrice()` from `lib/currency.ts`.

**Tech Stack:** TypeScript, Expo Router (mobile), React Router (desktop), existing currency utilities.

---

## File Structure

### New Files
- `lib/watchlist-summary.ts` — shared summary utility
- `tests/watchlist-summary.test.ts` — unit tests

### Modified Files
- `app/(tabs)/watchlist.tsx` — add summary card
- `desktop/src/pages/Watchlist.tsx` — add summary card

---

## Task 1: Create Shared Summary Utility

**Files:**
- Create: `lib/watchlist-summary.ts`
- Test: `tests/watchlist-summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/watchlist-summary.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { Product } from "@/lib/types";

function makeListing(overrides: Partial<any> = {}) {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    expectedDate: undefined,
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
    ...overrides,
  };
}

function makeProduct(listings: any[]): Product {
  return {
    id: "p1",
    name: "Test",
    modelNumber: "M1",
    brand: "B",
    category: "C",
    description: "D",
    addedAt: "2026-01-01",
    isWatched: true,
    listings,
  } as Product;
}

describe("computeWatchlistSummary", () => {
  it("sums all listings converted to display currency", () => {
    const watchlist = [
      makeProduct([
        makeListing({ price: 100, currency: "USD" }),
        makeListing({ price: 92, currency: "EUR" }), // 92 EUR = 100 USD
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.totalValue).toBeCloseTo(200, 2);
  });

  it("counts in-stock, back-order, and out-of-stock listings", () => {
    const watchlist = [
      makeProduct([
        makeListing({ stockStatus: "in_stock" }),
        makeListing({ stockStatus: "in_stock" }),
        makeListing({ stockStatus: "back_order" }),
        makeListing({ stockStatus: "out_of_stock" }),
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.inStock).toBe(2);
    expect(summary.backOrder).toBe(1);
    expect(summary.outOfStock).toBe(1);
  });

  it("skips listings with missing price or currency", () => {
    const watchlist = [
      makeProduct([
        makeListing({ price: 0 }),
        makeListing({ currency: "" }),
        makeListing({ price: 50, currency: "USD" }),
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.totalValue).toBe(50);
  });

  it("returns zeros for empty watchlist", () => {
    const summary = computeWatchlistSummary([], "USD");
    expect(summary).toEqual({
      totalValue: 0,
      listingCount: 0,
      inStock: 0,
      backOrder: 0,
      outOfStock: 0,
    });
  });

  it("counts listingCount as all listings regardless of price", () => {
    const watchlist = [
      makeProduct([
        makeListing({ price: 0 }),
        makeListing({ price: 50, currency: "USD" }),
      ]),
    ];
    const summary = computeWatchlistSummary(watchlist, "USD");
    expect(summary.listingCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/watchlist-summary.test.ts`
Expected: FAIL with "Cannot find module '@/lib/watchlist-summary'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/watchlist-summary.ts`:

```typescript
import { Product } from "./types";
import { convertPrice } from "./currency";

export interface WatchlistSummary {
  totalValue: number;
  listingCount: number;
  inStock: number;
  backOrder: number;
  outOfStock: number;
}

export function computeWatchlistSummary(
  watchlist: Product[],
  displayCurrency: string,
): WatchlistSummary {
  let totalValue = 0;
  let listingCount = 0;
  let inStock = 0;
  let backOrder = 0;
  let outOfStock = 0;

  for (const product of watchlist) {
    for (const listing of product.listings ?? []) {
      listingCount++;
      if (listing.price > 0 && listing.currency) {
        totalValue += convertPrice(listing.price, listing.currency, displayCurrency);
      }
      if (listing.stockStatus === "in_stock") inStock++;
      else if (listing.stockStatus === "back_order") backOrder++;
      else if (listing.stockStatus === "out_of_stock") outOfStock++;
    }
  }

  return { totalValue, listingCount, inStock, backOrder, outOfStock };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/watchlist-summary.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/watchlist-summary.ts tests/watchlist-summary.test.ts
git commit -m "feat: add watchlist summary utility with tests"
```

---

## Task 2: Add Summary Card to Mobile Watchlist

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `app/(tabs)/watchlist.tsx`:

```typescript
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { getSettings } from "@/lib/storage";
```

Note: `getSettings` may already be imported. Check the existing imports first — if it's already there, don't add a duplicate.

- [ ] **Step 2: Add displayCurrency state and load it**

In the `WatchlistScreen` component, add state and load settings in `loadData`:

```typescript
const [displayCurrency, setDisplayCurrency] = useState("USD");
```

In `loadData`, after `setWatchlist(list)`:

```typescript
const settings = await getSettings();
setDisplayCurrency(settings?.displayCurrency ?? "USD");
```

- [ ] **Step 3: Compute the summary**

After the `loadData` definition, add a memoized summary:

```typescript
const summary = useMemo(
  () => computeWatchlistSummary(watchlist, displayCurrency),
  [watchlist, displayCurrency],
);
```

Add `useMemo` to the React import if not already imported.

- [ ] **Step 4: Render the summary card**

Insert the summary card between the header (ends around line 362) and the progress bar / sort bar. Add this JSX after the header `</View>`:

```tsx
{watchlist.length > 0 && (
  <View
    style={{
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>Total Value</Text>
      <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}>
        {formatPrice(summary.totalValue, displayCurrency)}
      </Text>
    </View>
    <View style={{ flexDirection: "row", marginTop: 12, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.success, fontSize: 16, fontWeight: "600" }}>{summary.inStock}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>In Stock</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.warning, fontSize: 16, fontWeight: "600" }}>{summary.backOrder}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Back Order</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.error, fontSize: 16, fontWeight: "600" }}>{summary.outOfStock}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Out of Stock</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>{summary.listingCount}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Listings</Text>
      </View>
    </View>
  </View>
)}
```

- [ ] **Step 5: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/watchlist.tsx
git commit -m "feat: add summary card to mobile watchlist"
```

---

## Task 3: Add Summary Card to Desktop Watchlist

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `desktop/src/pages/Watchlist.tsx`:

```typescript
import { computeWatchlistSummary } from "../../../lib/watchlist-summary";
import { useSettings } from "../hooks/use-storage";
```

- [ ] **Step 2: Get displayCurrency**

In the `Watchlist` component, add:

```typescript
const { settings } = useSettings();
const displayCurrency = settings?.displayCurrency ?? "USD";
```

- [ ] **Step 3: Compute the summary**

Add a memoized summary:

```typescript
const summary = useMemo(
  () => computeWatchlistSummary(watchlist, displayCurrency),
  [watchlist, displayCurrency],
);
```

`useMemo` is already imported (line 1).

- [ ] **Step 4: Render the summary card**

Insert the summary card near the top of the returned JSX, after the header. Find the header block and add the card after it:

```tsx
{watchlist.length > 0 && (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">Total Value</span>
      <span className="text-2xl font-bold">
        {formatPrice(summary.totalValue, displayCurrency)}
      </span>
    </div>
    <div className="flex gap-4 mt-3">
      <div className="flex-1">
        <p className="text-lg font-semibold text-emerald-600">{summary.inStock}</p>
        <p className="text-xs text-gray-500">In Stock</p>
      </div>
      <div className="flex-1">
        <p className="text-lg font-semibold text-amber-600">{summary.backOrder}</p>
        <p className="text-xs text-gray-500">Back Order</p>
      </div>
      <div className="flex-1">
        <p className="text-lg font-semibold text-red-600">{summary.outOfStock}</p>
        <p className="text-xs text-gray-500">Out of Stock</p>
      </div>
      <div className="flex-1">
        <p className="text-lg font-semibold">{summary.listingCount}</p>
        <p className="text-xs text-gray-500">Listings</p>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "feat: add summary card to desktop watchlist"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Run all checks**

```bash
pnpm check
pnpm lint
pnpm test
pnpm --filter desktop check
pnpm --filter desktop test
```

Expected: All pass

- [ ] **Step 2: Update todo.md**

Add Phase 17 entry for the watchlist summary card.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 17 watchlist summary card to todo.md"
```
