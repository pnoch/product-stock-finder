# Price vs Average Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show how the current best price compares to its 30-day average on product detail with a verdict indicator.

**Architecture:** Pure `computePriceVsAverage` module (TDD) + compact card rendered after NotesCard on product detail.

**Tech Stack:** TypeScript strict, vitest, React Native.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/price-average.ts` | `computePriceVsAverage` |
| `tests/price-average.test.ts` | metric tests |
| `components/product/price-vs-avg-card.tsx` | indicator card |
| `app/product/[id].tsx` | memo + render |

---

## Task 1: Module (TDD) + card + wiring

**Files:**
- Create: `lib/price-average.ts`
- Test: `tests/price-average.test.ts`
- Create: `components/product/price-vs-avg-card.tsx`
- Modify: `app/product/[id].tsx`
- Modify: `todo.md`

- [ ] **Step 1: Write failing test `tests/price-average.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { computePriceVsAverage } from "../lib/price-average";
import type { DistributorListing } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-15T12:00:00Z");

function listing(
  distributorId: string,
  history: Array<[number, number]>, // [daysAgo, price]
  currentPrice?: number,
): DistributorListing {
  return {
    productId: "p",
    distributorId,
    price: currentPrice ?? history[history.length - 1]?.[1] ?? 0,
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

describe("computePriceVsAverage", () => {
  it("computes percent vs 30-day window average", () => {
    const result = computePriceVsAverage(
      [
        listing("a", [
          [60, 200], // outside window — excluded
          [10, 100],
          [2, 90],
        ]),
      ],
      "USD",
      30,
      NOW,
    );
    expect(result).not.toBeNull();
    expect(result!.average).toBe(95);
    expect(result!.current).toBe(90);
    expect(result!.percentVsAvg).toBeCloseTo(-5.3, 0);
    expect(result!.verdict).toBe("below");
  });

  it("applies verdict thresholds at ±3%", () => {
    const mk = (current: number) =>
      computePriceVsAverage(
        [listing("a", [[10, 100], [5, 100], [0, current]])],
        "USD",
        30,
        NOW,
      )!.verdict;
    expect(mk(96)).toBe("below"); // -4%
    expect(mk(99)).toBe("at"); // -1%
    expect(mk(101)).toBe("at"); // +1%
    expect(mk(104)).toBe("above"); // +4%
  });

  it("returns null with fewer than two window points", () => {
    const result = computePriceVsAverage(
      [listing("a", [[10, 100]])],
      "USD",
      30,
      NOW,
    );
    expect(result).toBeNull();
  });

  it("returns null when nothing is in stock", () => {
    const l = listing("a", [[5, 100], [0, 90]]);
    l.stockStatus = "out_of_stock";
    expect(computePriceVsAverage([l], "USD", 30, NOW)).toBeNull();
  });

  it("skips non-convertible history points", () => {
    const l = listing("a", [[10, 100], [2, 90]]);
    l.priceHistory = l.priceHistory.map((p) => ({ ...p, currency: "XYZ" }));
    const result = computePriceVsAverage([l], "USD", 30, NOW);
    expect(result).toBeNull(); // no usable points
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/price-average.test.ts` — FAIL (module not found).

- [ ] **Step 3: Create `lib/price-average.ts`**

```typescript
import type { DistributorListing } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export interface PriceVsAverage {
  current: number;
  average: number;
  percentVsAvg: number;
  verdict: "below" | "at" | "above";
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

export function computePriceVsAverage(
  listings: DistributorListing[],
  displayCurrency: string,
  windowDays = 30,
  now = Date.now(),
): PriceVsAverage | null {
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;

  const inStockPrices = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => convert(l.price, l.currency, displayCurrency))
    .filter((v): v is number => v !== null);
  if (inStockPrices.length === 0) return null;
  const current = Math.min(...inStockPrices);

  const points = listings
    .flatMap((l) => l.priceHistory ?? [])
    .map((p) => ({ t: Date.parse(p.date), v: convert(p.price, p.currency, displayCurrency) }))
    .filter(
      (p) => Number.isFinite(p.t) && p.t >= cutoff && p.v !== null,
    )
    .map((p) => p.v!);
  if (points.length < 2) return null;

  const average = points.reduce((s, v) => s + v, 0) / points.length;
  const percentVsAvg =
    Math.round(((current - average) / average) * 1000) / 10;
  const verdict: PriceVsAverage["verdict"] =
    percentVsAvg <= -3 ? "below" : percentVsAvg >= 3 ? "above" : "at";

  return { current, average, percentVsAvg, verdict };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/price-average.test.ts` — PASS.
Run: `pnpm check` — 0 errors.

- [ ] **Step 5: Create `components/product/price-vs-avg-card.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type { PriceVsAverage } from "@/lib/price-average";

const VERDICT_COPY: Record<
  PriceVsAverage["verdict"],
  string
> = {
  below: "Below average — good time to buy",
  at: "Around its average",
  above: "Above average",
};

export function PriceVsAvgCard({
  data,
}: {
  data: PriceVsAverage;
}) {
  const colors = useColors();
  const color =
    data.verdict === "below"
      ? colors.success
      : data.verdict === "above"
        ? colors.error
        : colors.muted;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      <Text
        style={{
          color,
          fontSize: 24,
          fontWeight: "700",
          minWidth: 84,
        }}
      >
        {data.percentVsAvg > 0 ? "+" : ""}
        {data.percentVsAvg.toFixed(1)}%
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          vs 30-day average · avg {formatPrice(data.average, "USD")}
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 13, marginTop: 2 }}>
          {VERDICT_COPY[data.verdict]}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Wire into `app/product/[id].tsx`**

1. Import `computePriceVsAverage` from `@/lib/price-average`, `PriceVsAvgCard` from `@/components/product/price-vs-avg-card`.
2. Memo near shareRows:

```typescript
  const priceVsAvg = useMemo(
    () => computePriceVsAverage(listings, displayCurrency),
    [listings, displayCurrency],
  );
```

3. Render right after `<NotesCard productId={id} />`:

```tsx
        {priceVsAvg && <PriceVsAvgCard data={priceVsAvg} />}
```

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 96 section:

```markdown
## Phase 96: Price vs Average (v5.44)

- [x] Add pure price-vs-average computation with tests
- [x] Add verdict indicator card on product detail
```

Then:

```bash
git add lib/price-average.ts tests/price-average.test.ts components/product/price-vs-avg-card.tsx app/product/\[id\].tsx todo.md && git commit -m "feat: add price vs average indicator"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New module | `lib/price-average.ts` (~70 lines) |
| New tests | ~5 cases |
| New component | `price-vs-avg-card.tsx` (~65 lines) |
