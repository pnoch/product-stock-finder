# Product Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Product Insights" card to the Stats screen: all-time-low count, active drop streaks, and volatility distribution per product.

**Architecture:** Pure `computeProductInsights` module (TDD) + a stat-columns card on the Stats screen.

**Tech Stack:** TypeScript strict, vitest, React Native.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/product-insights.ts` | `computeProductInsights` |
| `tests/product-insights.test.ts` | metric tests |
| `components/stats/insights-card.tsx` | Stats card |
| `app/stats.tsx` | memo + render |

---

## Task 1: Module (TDD) + card + wiring

**Files:**
- Create: `lib/product-insights.ts`
- Test: `tests/product-insights.test.ts`
- Create: `components/stats/insights-card.tsx`
- Modify: `app/stats.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Write failing test `tests/product-insights.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { computeProductInsights } from "../lib/product-insights";
import type { DistributorListing, Product } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-15T12:00:00Z");

function listing(
  distributorId: string,
  history: Array<[number, number]>, // [daysAgo, price]
): DistributorListing {
  return {
    productId: "p",
    distributorId,
    price: history[history.length - 1]?.[1] ?? 0,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW - DAY).toISOString(),
    priceHistory: history.map(([daysAgo, price]) => ({
      date: new Date(NOW - daysAgo * DAY).toISOString(),
      price,
      currency: "USD",
      stockStatus: "in_stock" as const,
    })),
  } as DistributorListing;
}

function product(id: string, listings: DistributorListing[]): Product {
  return {
    id,
    name: id.toUpperCase(),
    modelNumber: id,
    brand: "B",
    category: "C",
    description: "",
    addedAt: new Date(NOW).toISOString(),
    isWatched: true,
    listings,
  } as unknown as Product;
}

describe("computeProductInsights", () => {
  it("flags products at their all-time low", () => {
    const result = computeProductInsights(
      [
        product("low", [
          listing("a", [[10, 200], [0, 90]]),
        ]),
        product("not", [
          listing("a", [[10, 50], [0, 120]]),
        ]),
      ],
      "USD",
    );
    expect(result.allTimeLows).toBe(1);
    expect(result.products.find((p) => p.productId === "low")?.atAllTimeLow).toBe(true);
    expect(result.products.find((p) => p.productId === "not")?.atAllTimeLow).toBe(false);
  });

  it("counts trailing consecutive drops as streak", () => {
    const result = computeProductInsights(
      [
        // 100 → 90 → 95 → 80 → 70 : trailing streak = 2
        product("streak", [
          listing("a", [[10, 100], [8, 90], [6, 95], [4, 80], [0, 70]]),
        ]),
      ],
      "USD",
    );
    expect(result.products[0].dropStreak).toBe(2);
    expect(result.droppingCount).toBe(1);
  });

  it("buckets volatility by coefficient of variation", () => {
    const result = computeProductInsights(
      [
        product("stable", [listing("a", [[9, 100], [6, 101], [3, 100], [0, 99]])]),
        product("wild", [listing("a", [[9, 50], [6, 200], [3, 60], [0, 190]])]),
        product("short", [listing("a", [[3, 100], [0, 90]])]),
      ],
      "USD",
    );
    expect(result.volatility.low).toBe(1);
    expect(result.volatility.high).toBe(1);
    expect(result.products.find((p) => p.productId === "short")?.volatility).toBeNull();
  });

  it("skips non-convertible currencies entirely", () => {
    const weird = listing("a", [[5, 100], [0, 90]]);
    weird.priceHistory = weird.priceHistory.map((p) => ({ ...p, currency: "XYZ" }));
    const result = computeProductInsights([product("x", [weird])], "USD");
    expect(result.allTimeLows).toBe(0);
    expect(result.droppingCount).toBe(0);
    expect(result.products[0].volatility).toBeNull();
  });

  it("handles an empty watchlist", () => {
    const result = computeProductInsights([], "USD");
    expect(result.products).toEqual([]);
    expect(result.allTimeLows).toBe(0);
    expect(result.droppingCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/product-insights.test.ts` — FAIL (module not found).

- [ ] **Step 3: Create `lib/product-insights.ts`**

```typescript
import type { Product } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export interface ProductInsight {
  productId: string;
  name: string;
  atAllTimeLow: boolean;
  dropStreak: number;
  volatility: "low" | "medium" | "high" | null;
}

export interface ProductInsightsResult {
  products: ProductInsight[];
  allTimeLows: number;
  droppingCount: number;
  volatility: { low: number; medium: number; high: number };
}

function convert(
  price: number,
  currency: string,
  displayCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (
    !currency ||
    !hasExchangeRate(currency) ||
    !hasExchangeRate(displayCurrency)
  ) {
    return null;
  }
  return convertPrice(price, currency, displayCurrency);
}

export function computeProductInsights(
  watchlist: Product[],
  displayCurrency: string,
): ProductInsightsResult {
  const products: ProductInsight[] = [];
  let allTimeLows = 0;
  let droppingCount = 0;
  const volatility = { low: 0, medium: 0, high: 0 };

  for (const product of watchlist) {
    const points = product.listings
      .flatMap((l) => l.priceHistory ?? [])
      .map((p) => ({ t: Date.parse(p.date), v: convert(p.price, p.currency, displayCurrency) }))
      .filter((p) => Number.isFinite(p.t) && p.v !== null)
      .sort((a, b) => a.t - b.t)
      .map((p) => p.v!);

    const inStockPrices = product.listings
      .filter((l) => l.stockStatus === "in_stock")
      .map((l) => convert(l.price, l.currency, displayCurrency))
      .filter((v): v is number => v !== null);

    const currentBest =
      inStockPrices.length > 0 ? Math.min(...inStockPrices) : null;

    const atAllTimeLow =
      points.length > 0 &&
      currentBest !== null &&
      Math.abs(currentBest - Math.min(...points)) < 0.01;

    let dropStreak = 0;
    for (let i = points.length - 1; i > 0; i--) {
      if (points[i] < points[i - 1]) dropStreak += 1;
      else break;
    }

    let vol: ProductInsight["volatility"] = null;
    if (points.length >= 3) {
      const mean = points.reduce((s, v) => s + v, 0) / points.length;
      const variance =
        points.reduce((s, v) => s + (v - mean) ** 2, 0) / points.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      vol = cv < 0.05 ? "low" : cv < 0.15 ? "medium" : "high";
      volatility[vol] += 1;
    }

    if (atAllTimeLow) allTimeLows += 1;
    if (dropStreak >= 2) droppingCount += 1;

    products.push({
      productId: product.id,
      name: product.name,
      atAllTimeLow,
      dropStreak,
      volatility: vol,
    });
  }

  return { products, allTimeLows, droppingCount, volatility };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/product-insights.test.ts` — PASS.
Run: `pnpm check` — 0 errors.

- [ ] **Step 5: Create `components/stats/insights-card.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { ProductInsightsResult } from "@/lib/product-insights";

export function InsightsCard({ result }: { result: ProductInsightsResult }) {
  const colors = useColors();
  const lows = result.products.filter((p) => p.atAllTimeLow).slice(0, 3);

  return (
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
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
        Product Insights
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.success, fontSize: 18, fontWeight: "700" }}>
            {result.allTimeLows}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>At all-time low</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}>
            {result.droppingCount}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Dropping now</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>
            {result.volatility.low}·{result.volatility.medium}·{result.volatility.high}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Volatility L·M·H</Text>
        </View>
      </View>
      {lows.length > 0 && (
        <View style={{ marginTop: 10 }}>
          {lows.map((p) => (
            <Text key={p.productId} style={{ color: colors.success, fontSize: 12, paddingVertical: 2 }} numberOfLines={1}>
              🏅 {p.name} is at its all-time low
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 6: Wire into `app/stats.tsx`**

1. Import `computeProductInsights` from `@/lib/product-insights` and `InsightsCard`.
2. Memo after digest:

```typescript
  const insights = useMemo(
    () => computeProductInsights(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );
```

3. Render `<InsightsCard result={insights} />` right after `<MoversCard … />`.

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 95 section:

```markdown
## Phase 95: Product Insights (v5.43)

- [x] Add pure insights module (all-time lows, drop streaks, volatility)
- [x] Unit-test metrics incl. FX skips and edge cases
- [x] Add Product Insights card to Stats screen
```

Then:

```bash
git add lib/product-insights.ts tests/product-insights.test.ts components/stats/insights-card.tsx app/stats.tsx todo.md && git commit -m "feat: add product insights to stats screen"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New module | `lib/product-insights.ts` (~110 lines) |
| New tests | ~5 cases |
| New component | `insights-card.tsx` (~75 lines) |
