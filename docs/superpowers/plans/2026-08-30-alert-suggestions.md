# Alert Price Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show tappable suggested alert targets (near-low / below-avg / under-current) computed from price history inside the Set Price Alert modal.

**Architecture:** Pure `suggestAlertPrices` module (TDD) + optional `suggestions` prop on the existing modal rendering tappable chips + `useMemo` computation in `app/product/[id].tsx`.

**Tech Stack:** TypeScript strict, vitest, React Native.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/alert-suggestions.ts` | `suggestAlertPrices` (pure) |
| `tests/alert-suggestions.test.ts` | Strategy math + edge cases |
| `components/product/price-alert-modal.tsx` | Chips row between currency picker and input |
| `app/product/[id].tsx` | Compute + pass suggestions |

---

## Task 1: Suggestion module (TDD)

**Files:**
- Create: `lib/alert-suggestions.ts`
- Test: `tests/alert-suggestions.test.ts`

- [ ] **Step 1: Write failing test `tests/alert-suggestions.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { suggestAlertPrices } from "../lib/alert-suggestions";
import type { DistributorListing } from "../lib/types";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function listing(
  overrides: Partial<DistributorListing> & { distributorId: string },
): DistributorListing {
  return {
    price: 85,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW - DAY).toISOString(),
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

describe("suggestAlertPrices", () => {
  it("computes all three strategies from merged history", () => {
    const listings = [
      listing({
        distributorId: "a",
        priceHistory: [
          { date: new Date(NOW - 40 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
          { date: new Date(NOW - 10 * DAY).toISOString(), price: 80, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
      listing({
        distributorId: "b",
        priceHistory: [
          { date: new Date(NOW - 5 * DAY).toISOString(), price: 90, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ];
    const result = suggestAlertPrices(listings, "USD", NOW);
    expect(result.map((s) => s.key)).toEqual([
      "near_low",
      "below_avg",
      "under_current",
    ]);
    expect(result[0].price).toBe(80); // min of 100/80/90
    expect(result[1].price).toBe(76.5); // mean(80, 90) * 0.9 — both within 30d
    expect(result[2].price).toBe(80.75); // min(85, 92) * 0.95
  });

  it("dedupes suggestions that round to the same value", () => {
    const listings = [
      listing({
        distributorId: "a",
        price: 84.21,
        priceHistory: [
          { date: new Date(NOW - DAY).toISOString(), price: 80, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ];
    // near_low = 80; under_current = 84.21 * 0.95 = 79.9995 -> rounds to 80
    const result = suggestAlertPrices(listings, "USD", NOW);
    const values = result.map((s) => s.price);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain(80);
  });

  it("skips non-convertible currencies and non-positive prices", () => {
    const listings = [
      listing({
        distributorId: "a",
        priceHistory: [
          { date: new Date(NOW - DAY).toISOString(), price: 0, currency: "USD", stockStatus: "in_stock" },
          { date: new Date(NOW - DAY).toISOString(), price: 50, currency: "XYZ", stockStatus: "in_stock" },
          { date: new Date(NOW - DAY).toISOString(), price: 70, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ];
    const result = suggestAlertPrices(listings, "USD", NOW);
    expect(result.find((s) => s.key === "near_low")!.price).toBe(70);
  });

  it("uses cheapest in-stock listing for under_current, ignoring OOS", () => {
    const listings = [
      listing({ distributorId: "a", price: 60, stockStatus: "out_of_stock" }),
      listing({ distributorId: "b", price: 100, stockStatus: "in_stock" }),
    ];
    const result = suggestAlertPrices(listings, "USD", NOW);
    expect(result.find((s) => s.key === "under_current")).toBeUndefined();
    // No history at all -> no near_low/below_avg either.
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("under_current");
    expect(result[0].price).toBe(95);
  });

  it("returns empty array for empty listings", () => {
    expect(suggestAlertPrices([], "USD", NOW)).toEqual([]);
  });
});
```

Note: adjust the `DistributorListing` fixture casts against `lib/types.ts` required fields so it typechecks.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/alert-suggestions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/alert-suggestions.ts`**

```typescript
import type { DistributorListing } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export type SuggestionKey = "near_low" | "below_avg" | "under_current";

export interface AlertSuggestion {
  key: SuggestionKey;
  label: string;
  price: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_MS = 30 * DAY_MS;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function convert(
  price: number,
  fromCurrency: string,
  targetCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (
    !fromCurrency ||
    !hasExchangeRate(fromCurrency) ||
    !hasExchangeRate(targetCurrency)
  ) {
    return null;
  }
  return convertPrice(price, fromCurrency, targetCurrency);
}

// Alerts are product-wide (best price across distributors triggers), so all
// strategies are computed over every listing's data merged together.
export function suggestAlertPrices(
  listings: DistributorListing[],
  currency: string,
  now: number = Date.now(),
): AlertSuggestion[] {
  const candidates: AlertSuggestion[] = [];

  const allPoints = listings.flatMap((l) => l.priceHistory ?? []);
  const convertedPoints = allPoints
    .map((p) => convert(p.price, p.currency, currency))
    .filter((v): v is number => v !== null);

  if (convertedPoints.length > 0) {
    candidates.push({
      key: "near_low",
      label: "Near low",
      price: round2(Math.min(...convertedPoints)),
    });

    const recent = allPoints
      .filter((p) => {
        const t = Date.parse(p.date);
        return Number.isFinite(t) && now - t <= RECENT_WINDOW_MS;
      })
      .map((p) => convert(p.price, p.currency, currency))
      .filter((v): v is number => v !== null);
    if (recent.length > 0) {
      const mean = recent.reduce((sum, v) => sum + v, 0) / recent.length;
      candidates.push({
        key: "below_avg",
        label: "Below avg",
        price: round2(mean * 0.9),
      });
    }
  }

  const inStockPrices = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => convert(l.price, l.currency, currency))
    .filter((v): v is number => v !== null);
  if (inStockPrices.length > 0) {
    candidates.push({
      key: "under_current",
      label: "Under current",
      price: round2(Math.min(...inStockPrices) * 0.95),
    });
  }

  const seen = new Set<number>();
  return candidates.filter((c) => {
    if (c.price <= 0 || seen.has(c.price)) return false;
    seen.add(c.price);
    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/alert-suggestions.test.ts` — PASS.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/alert-suggestions.ts tests/alert-suggestions.test.ts && git commit -m "feat: add alert price suggestion module"
```

---

## Task 2: Modal chips + screen wiring + push

**Files:**
- Modify: `components/product/price-alert-modal.tsx`
- Modify: `app/product/[id].tsx`
- Modify: `todo.md`

- [ ] **Step 1: Add chips row to the modal**

In `components/product/price-alert-modal.tsx`:

1. Extend props with `suggestions?: AlertSuggestion[]` (import type from `@/lib/alert-suggestions`) and destructure it.
2. Between the currency-picker chip row and the target-price `TextInput`, render:

```tsx
          {suggestions && suggestions.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.key}
                  onPress={() => {
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAlertPrice(String(suggestion.price));
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + "22",
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                    {suggestion.label} · {formatPrice(suggestion.price, alertCurrency)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
```

3. Add imports as needed (`Platform` from react-native, `Haptics` from expo-haptics, `formatPrice` from `@/lib/currency`). Check which are already imported first.

- [ ] **Step 2: Wire into `app/product/[id].tsx`**

1. Add import: `import { suggestAlertPrices } from "@/lib/alert-suggestions";`
2. Near the other useMemo hooks add:

```typescript
  const alertSuggestions = useMemo(
    () => suggestAlertPrices(product.listings ?? [], alertCurrency),
    [product.listings, alertCurrency],
  );
```

(Adapt to how `product` is loaded — if it can be null use `product?.listings ?? []` and include `product` in deps.)

3. Pass to the modal: `suggestions={alertSuggestions}` on `<PriceAlertModal …>`.

- [ ] **Step 3: Verify**

1. Run `pnpm check` — 0 errors
2. Run `pnpm lint` — no new errors
3. Run `pnpm test` — all pass

- [ ] **Step 4: Update `todo.md`**

Append Phase 83 section:

```markdown
## Phase 83: Alert Price Suggestions (v5.31)

- [x] Add pure suggestion module (near-low, below-avg, under-current)
- [x] Unit-test strategy math, dedupe, FX guards
- [x] Render suggestion chips in Set Price Alert modal
- [x] Wire suggestions into product detail screen
```

- [ ] **Step 5: Commit and push**

```bash
git add lib/alert-suggestions.ts tests/alert-suggestions.test.ts components/product/price-alert-modal.tsx app/product/\[id\].tsx todo.md && git commit -m "feat: suggest alert target prices in alert modal"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New pure module | `lib/alert-suggestions.ts` (~90 lines) |
| New tests | `tests/alert-suggestions.test.ts` (~5 cases) |
| Modified | price-alert-modal (chips), product detail (wiring) |
