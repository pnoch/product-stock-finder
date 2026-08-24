# Drop Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Heatmap calendar on the Stats screen showing which recent days had watchlist price drops, with tappable day details.

**Architecture:** Pure `computeDropCalendar` module (TDD) + a heatmap grid card with expandable day details.

**Tech Stack:** TypeScript strict, vitest, React Native.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/drop-calendar.ts` | `computeDropCalendar` |
| `tests/drop-calendar.test.ts` | metric tests |
| `components/stats/drop-calendar-card.tsx` | heatmap grid + details |
| `app/stats.tsx` | memo + render |

---

## Task 1: Module (TDD) + card + wiring

**Files:**
- Create: `lib/drop-calendar.ts`
- Test: `tests/drop-calendar.test.ts`
- Create: `components/stats/drop-calendar-card.tsx`
- Modify: `app/stats.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Write failing test `tests/drop-calendar.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { computeDropCalendar } from "../lib/drop-calendar";
import type { DistributorListing, Product } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-15T12:00:00Z"); // Monday UTC

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

describe("computeDropCalendar", () => {
  it("attributes drops to the later point's day", () => {
    const result = computeDropCalendar(
      [product("p1", [listing("a", [[5, 100], [2, 80]])])],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(1);
    const keys = [...result.byDay.keys()];
    expect(keys).toHaveLength(1);
    const day = result.byDay.get(keys[0])!;
    expect(day.dropCount).toBe(1);
    expect(day.drops[0].from).toBe(100);
    expect(day.drops[0].to).toBe(80);
    expect(day.biggestPct).toBeCloseTo(-20, 1);
  });

  it("ignores increases and flat pairs", () => {
    const result = computeDropCalendar(
      [product("p1", [listing("a", [[6, 50], [3, 90], [0, 90]])])],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(0);
  });

  it("excludes pairs outside the window", () => {
    const result = computeDropCalendar(
      [product("p1", [listing("a", [[60, 200], [55, 10]])])],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(0);
  });

  it("groups multiple drops on the same day", () => {
    const result = computeDropCalendar(
      [
        product("p1", [listing("a", [[4, 100], [1, 80]])]),
        product("p2", [listing("b", [[4, 60], [1, 30]])]),
      ],
      "USD",
      30,
      NOW,
    );
    expect(result.totalDrops).toBe(2);
    const day = [...result.byDay.values()][0];
    expect(day.dropCount).toBe(2);
    expect(day.biggestPct).toBeCloseTo(-50, 1);
  });

  it("skips non-convertible currencies", () => {
    const l = listing("a", [[4, 100], [1, 80]]);
    l.priceHistory = l.priceHistory.map((p) => ({ ...p, currency: "XYZ" }));
    const result = computeDropCalendar([product("p1", [l])], "USD", 30, NOW);
    expect(result.totalDrops).toBe(0);
  });

  it("handles an empty watchlist", () => {
    const result = computeDropCalendar([], "USD", 30, NOW);
    expect(result.totalDrops).toBe(0);
    expect(result.byDay.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/drop-calendar.test.ts` — FAIL (module not found).

- [ ] **Step 3: Create `lib/drop-calendar.ts`**

```typescript
import type { Product } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export interface DropEvent {
  productId: string;
  name: string;
  from: number;
  to: number;
  percent: number;
}

export interface DropDay {
  dateKey: string;
  dropCount: number;
  biggestPct: number | null;
  drops: DropEvent[];
}

export interface DropCalendarResult {
  byDay: Map<string, DropDay>;
  totalDrops: number;
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

function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function computeDropCalendar(
  watchlist: Product[],
  displayCurrency: string,
  days = 30,
  now = Date.now(),
): DropCalendarResult {
  const cutoff = now - days * DAY_MS;
  const byDay = new Map<string, DropDay>();
  let totalDrops = 0;

  for (const product of watchlist) {
    for (const listing of product.listings) {
      const points = (listing.priceHistory ?? [])
        .map((p) => ({
          t: Date.parse(p.date),
          v: convert(p.price, p.currency, displayCurrency),
        }))
        .filter((p) => Number.isFinite(p.t) && p.v !== null)
        .sort((a, b) => a.t - b.t);

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        if (curr.t < cutoff || curr.t > now) continue;
        if (curr.v! >= prev.v!) continue;

        const key = dateKey(curr.t);
        const day = byDay.get(key) ?? {
          dateKey: key,
          dropCount: 0,
          biggestPct: null,
          drops: [],
        };
        const percent =
          Math.round(((curr.v! - prev.v!) / prev.v!) * 1000) / 10;
        day.dropCount += 1;
        day.drops.push({
          productId: product.id,
          name: product.name,
          from: prev.v!,
          to: curr.v!,
          percent,
        });
        if (day.biggestPct === null || percent < day.biggestPct) {
          day.biggestPct = percent;
        }
        byDay.set(key, day);
        totalDrops += 1;
      }
    }
  }

  return { byDay, totalDrops };
}

const DAY_MS = 24 * 60 * 60 * 1000;
```

(Move `const DAY_MS` above usage — declare at top of file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/drop-calendar.test.ts` — PASS.
Run: `pnpm check` — 0 errors.

- [ ] **Step 5: Create `components/stats/drop-calendar-card.tsx`**

```typescript
import { useState } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type {
  DropCalendarResult,
  DropDay,
} from "@/lib/drop-calendar";

// Builds the trailing `days` grid ending today: leading blanks for weekday
// offset, then one cell per day.
function buildGridCells(days: number, now: number): Array<number | null> {
  const cells: Array<number | null> = [];
  const startTs = now - (days - 1) * DAY;
  const startOffset = new Date(startTs).getUTCDay(); // 0=Sun
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let i = 0; i < days; i++) cells.push(startTs + i * DAY);
  return cells;
}

const DAY = 86400000;

export function DropCalendarCard({
  result,
  days,
  now,
}: {
  result: DropCalendarResult;
  days: number;
  now: number;
}) {
  const colors = useColors();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const cells = buildGridCells(days, now);
  const selected: DropDay | undefined = selectedKey
    ? result.byDay.get(selectedKey)
    : undefined;

  const cellStyle = (ts: number) => {
    const key = new Date(ts).toISOString().slice(0, 10);
    const day = result.byDay.get(key);
    const isToday = key === new Date(now).toISOString().slice(0, 10);
    const base = {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    };
    if (!day) return { ...base, backgroundColor: "transparent" };
    const intensity =
      day.dropCount >= 3 ? colors.success : colors.success + "55";
    return {
      ...base,
      backgroundColor: intensity,
      borderColor: isToday ? colors.primary : colors.success,
    };
  };

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
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        {result.totalDrops} price drops in the last {days} days
      </Text>

      <View style={{ flexDirection: "row", marginTop: 10, gap: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <Text
            key={i}
            style={{ color: colors.muted, fontSize: 9, width: 34, textAlign: "center" }}
          >
            {d}
          </Text>
        ))}
      </View>

      <View style={{ flexWrap: "wrap", flexDirection: "row", gap: 4 }}>
        {cells.map((ts, i) =>
          ts === null ? (
            <View key={`blank-${i}`} style={{ width: 34, height: 34, marginBottom: 4 }} />
          ) : (
            <TouchableOpacity
              key={ts}
              onPress={() => {
                const key = new Date(ts).toISOString().slice(0, 10);
                setSelectedKey((prev) => (prev === key ? null : key));
              }}
              style={cellStyle(ts)}
            >
              <Text style={{ color: colors.foreground, fontSize: 11 }}>
                {new Date(ts).getUTCDate()}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      {selected && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
            Drops on {selected.dateKey}
          </Text>
          {selected.drops.map((drop) => (
            <View
              key={`${drop.productId}-${drop.from}-${drop.to}`}
              style={{ flexDirection: "row", paddingVertical: 3, gap: 8 }}
            >
              <Text
                style={{ color: colors.foreground, fontSize: 12, flex: 1 }}
                numberOfLines={1}
              >
                {drop.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatPrice(drop.from, "USD")} → {formatPrice(drop.to, "USD")}
              </Text>
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>
                {drop.percent.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

Note: `DAY` constant must be declared before `buildGridCells` uses it — order declarations correctly.

- [ ] **Step 6: Wire into `app/stats.tsx`**

1. Import `computeDropCalendar` from `@/lib/drop-calendar`, `DropCalendarCard`.
2. Memo:

```typescript
  const dropCalendar = useMemo(
    () => computeDropCalendar(watchlist, displayCurrency, 30),
    [watchlist, displayCurrency],
  );
```

3. Render after `<InsightsCard … />`:

```tsx
          <DropCalendarCard result={dropCalendar} days={30} now={Date.now()} />
```

(`now` passed fresh each render keeps "today" accurate.)

- [ ] **Step 7: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 8: Update `todo.md` + commit + push**

Append Phase 97 section:

```markdown
## Phase 97: Drop Calendar (v5.45)

- [x] Add pure drop-calendar computation with tests
- [x] Add heatmap grid card with tap-for-details on Stats screen
```

Then:

```bash
git add lib/drop-calendar.ts tests/drop-calendar.test.ts components/stats/drop-calendar-card.tsx app/stats.tsx todo.md && git commit -m "feat: add drop calendar heatmap"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New module | `lib/drop-calendar.ts` (~90 lines) |
| New tests | ~6 cases |
| New component | `drop-calendar-card.tsx` (~160 lines) |
