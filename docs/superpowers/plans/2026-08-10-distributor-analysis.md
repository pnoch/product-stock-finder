# Cross-Product Distributor Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Distributor Analysis screen to both mobile (Expo) and desktop (Tauri) apps, showing per-distributor coverage, total cost, and average price across the user's watchlist.

**Architecture:** A shared pure utility `lib/distributor-analysis.ts` computes the analysis from the watchlist and display currency. Both mobile and desktop analysis screens import it and render the results. The utility uses `getBestPrice` from `lib/currency.ts` and `DISTRIBUTORS` from `lib/distributors.ts`.

**Tech Stack:** TypeScript, Expo Router (mobile), React Router (desktop), existing currency + distributor utilities.

---

## File Structure

### New Files
- `lib/distributor-analysis.ts` — shared analysis utility
- `tests/distributor-analysis.test.ts` — unit tests
- `app/distributor-analysis.tsx` — mobile screen
- `desktop/src/pages/DistributorAnalysis.tsx` — desktop screen

### Modified Files
- `app/(tabs)/watchlist.tsx` — add navigation entry
- `desktop/src/pages/Watchlist.tsx` — add navigation link
- `desktop/src/App.tsx` — add route

---

## Task 1: Create Shared Analysis Utility

**Files:**
- Create: `lib/distributor-analysis.ts`
- Test: `tests/distributor-analysis.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/distributor-analysis.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { analyzeDistributors } from "@/lib/distributor-analysis";
import type { Product, DistributorListing } from "@/lib/types";

function makeListing(overrides: Partial<DistributorListing> = {}): DistributorListing {
  return {
    distributorId: "server2u-my",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
    ...overrides,
  };
}

function makeProduct(id: string, listings: DistributorListing[]): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "B",
    category: "C",
    description: "D",
    addedAt: "2026-01-01",
    isWatched: true,
    listings,
  } as Product;
}

describe("analyzeDistributors", () => {
  it("computes coverage, total, and average correctly", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
        makeListing({ distributorId: "linitx-uk", price: 90, currency: "USD" }),
      ]),
      makeProduct("p2", [
        makeListing({ distributorId: "server2u-my", price: 50, currency: "USD" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "USD");
    const server2u = result.find((r) => r.distributorId === "server2u-my");
    const linitx = result.find((r) => r.distributorId === "linitx-uk");
    // server2u: coverage 2, total 100+50=150, avg 75
    expect(server2u!.coverage).toBe(2);
    expect(server2u!.totalCost).toBeCloseTo(150, 2);
    expect(server2u!.averagePrice).toBeCloseTo(75, 2);
    // linitx: coverage 1, total 90, avg 90
    expect(linitx!.coverage).toBe(1);
    expect(linitx!.totalCost).toBeCloseTo(90, 2);
    expect(linitx!.averagePrice).toBeCloseTo(90, 2);
  });

  it("converts to display currency", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "EUR");
    const server2u = result.find((r) => r.distributorId === "server2u-my");
    expect(server2u!.totalCost).toBeGreaterThan(0);
    expect(server2u!.totalCost).not.toBeCloseTo(100, 2); // converted, not 1:1
  });

  it("sorts by total cost ascending", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", price: 200, currency: "USD" }),
        makeListing({ distributorId: "linitx-uk", price: 50, currency: "USD" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "USD");
    expect(result[0].distributorId).toBe("linitx-uk");
    expect(result[1].distributorId).toBe("server2u-my");
  });

  it("excludes distributors with no in-stock listings", () => {
    const watchlist = [
      makeProduct("p1", [
        makeListing({ distributorId: "server2u-my", stockStatus: "out_of_stock" }),
      ]),
    ];
    const result = analyzeDistributors(watchlist, "USD");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty watchlist", () => {
    expect(analyzeDistributors([], "USD")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/distributor-analysis.test.ts`
Expected: FAIL with "Cannot find module '@/lib/distributor-analysis'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/distributor-analysis.ts`:

```typescript
import type { Product } from "./types";
import { DISTRIBUTORS } from "./distributors";
import { convertPrice } from "./currency";

export interface DistributorAnalysis {
  distributorId: string;
  coverage: number;
  totalCost: number;
  averagePrice: number;
}

export function analyzeDistributors(
  watchlist: Product[],
  displayCurrency: string,
): DistributorAnalysis[] {
  const results: DistributorAnalysis[] = [];

  for (const distributor of DISTRIBUTORS) {
    let coverage = 0;
    let totalCost = 0;

    for (const product of watchlist) {
      const listings = (product.listings ?? []).filter(
        (l) =>
          l.distributorId === distributor.id &&
          l.stockStatus !== "out_of_stock" &&
          l.price > 0,
      );
      if (listings.length === 0) continue;
      // Use the cheapest in-stock listing for deterministic totals
      const cheapest = listings.reduce((best, l) =>
        convertPrice(l.price, l.currency, displayCurrency) <
        convertPrice(best.price, best.currency, displayCurrency)
          ? l
          : best,
      );
      coverage++;
      totalCost += convertPrice(cheapest.price, cheapest.currency, displayCurrency);
    }

    if (coverage > 0) {
      results.push({
        distributorId: distributor.id,
        coverage,
        totalCost,
        averagePrice: totalCost / coverage,
      });
    }
  }

  return results.sort((a, b) => a.totalCost - b.totalCost);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/distributor-analysis.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/distributor-analysis.ts tests/distributor-analysis.test.ts
git commit -m "feat: add distributor analysis utility with tests"
```

---

## Task 2: Create Mobile Distributor Analysis Screen

**Files:**
- Create: `app/distributor-analysis.tsx`

- [ ] **Step 1: Create the mobile screen**

Create `app/distributor-analysis.tsx`:

```tsx
import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, getSettings } from "@/lib/storage";
import { getDistributorById } from "@/lib/distributors";
import { analyzeDistributors, DistributorAnalysis } from "@/lib/distributor-analysis";
import { formatPrice } from "@/lib/currency";

export default function DistributorAnalysisScreen() {
  const colors = useColors();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<DistributorAnalysis[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const watchlist = await getWatchlist();
      const settings = await getSettings();
      const currency = settings?.displayCurrency ?? "USD";
      setDisplayCurrency(currency);
      setAnalysis(analyzeDistributors(watchlist, currency));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>
          Distributor Analysis
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : analysis.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
          Add products to see distributor analysis.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {analysis.map((a) => {
            const distrib = getDistributorById(a.distributorId);
            return (
              <View
                key={a.distributorId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>
                    {distrib?.countryFlag} {distrib?.name ?? a.distributorId}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {a.coverage} product{a.coverage !== 1 ? "s" : ""} · avg {formatPrice(a.averagePrice, displayCurrency)}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>
                  {formatPrice(a.totalCost, displayCurrency)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add app/distributor-analysis.tsx
git commit -m "feat: add mobile distributor analysis screen"
```

---

## Task 3: Add Mobile Navigation Entry

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Add navigation entry**

In the `WatchlistScreen` header row (around line 339, the `View` with `flexDirection: "row"` containing the Check Now button), add a "Analysis" button that navigates to `/distributor-analysis`. Add it before the Check Now button:

```tsx
<TouchableOpacity
  onPress={() => router.push("/distributor-analysis")}
  style={{
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  }}
>
  <IconSymbol name="chart.bar" size={16} color={colors.primary} />
  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
    Analysis
  </Text>
</TouchableOpacity>
```

Note: `router` and `IconSymbol` are already imported. If `chart.bar` isn't in the IconSymbol mapping, use an existing icon name like `"chart.pie"` or `"list.bullet"` — check `components/ui/icon-symbol.tsx` for available names.

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/watchlist.tsx
git commit -m "feat: add distributor analysis navigation entry to mobile watchlist"
```

---

## Task 4: Create Desktop Distributor Analysis Screen

**Files:**
- Create: `desktop/src/pages/DistributorAnalysis.tsx`
- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Create the desktop screen**

Create `desktop/src/pages/DistributorAnalysis.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { storage } from "../storage";
import { getDistributorById } from "../../../lib/distributors";
import { analyzeDistributors, DistributorAnalysis } from "../../../lib/distributor-analysis";
import { formatPrice } from "../../../lib/currency";

export function DistributorAnalysis() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<DistributorAnalysis[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const watchlist = await storage.getWatchlist();
      const settings = await storage.getSettings();
      const currency = settings?.displayCurrency ?? "USD";
      setDisplayCurrency(currency);
      setAnalysis(analyzeDistributors(watchlist, currency));
    } catch {
      // Ignore load failures — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button onClick={() => navigate("/watchlist")} className="text-blue-600 dark:text-brand-400 mr-3">
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Distributor Analysis</h1>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 mt-10">Loading...</p>
      ) : analysis.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
          Add products to see distributor analysis.
        </p>
      ) : (
        <div>
          {analysis.map((a) => {
            const distrib = getDistributorById(a.distributorId);
            return (
              <div
                key={a.distributorId}
                className="flex items-center py-3 border-b border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {distrib?.countryFlag} {distrib?.name ?? a.distributorId}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {a.coverage} product{a.coverage !== 1 ? "s" : ""} · avg {formatPrice(a.averagePrice, displayCurrency)}
                  </p>
                </div>
                <p className="text-base font-bold text-brand-600 dark:text-brand-400">
                  {formatPrice(a.totalCost, displayCurrency)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route to App.tsx**

In `desktop/src/App.tsx`:
1. Add import: `import { DistributorAnalysis } from "./pages/DistributorAnalysis";`
2. Add route: `<Route path="/distributor-analysis" element={<DistributorAnalysis />} />`

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/DistributorAnalysis.tsx desktop/src/App.tsx
git commit -m "feat: add desktop distributor analysis screen"
```

---

## Task 5: Add Desktop Navigation Link

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add navigation link**

In the `Watchlist` component, find the header area (where the title is rendered). Add a "Distributor Analysis" link:

```tsx
<button
  onClick={() => navigate("/distributor-analysis")}
  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
>
  Distributor Analysis
</button>
```

Note: `navigate` is already available from `useNavigate()` in the Watchlist component.

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "feat: add distributor analysis link to desktop watchlist"
```

---

## Task 6: Final Verification

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

Add Phase 21 entry for the distributor analysis.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 21 distributor analysis to todo.md"
```
