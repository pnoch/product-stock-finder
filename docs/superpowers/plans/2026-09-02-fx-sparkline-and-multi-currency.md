# FX Sparkline Grid & Multi-Currency Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Rates" tab showing a sparkline grid of all supported currencies vs USD, and display the current exchange rate next to converted prices.

**Architecture:** Store FX rate history locally (append on each hourly fetch), build a new Rates tab with SVG sparkline cards, and add rate subtitles to price displays.

**Tech Stack:** React Native SVG (existing), AsyncStorage (existing), tRPC (existing), NativeWind (existing)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `lib/storage/fx-history.ts` | Create | AsyncStorage CRUD for `fx_rate_history` |
| `lib/fx-history.ts` | Create | History append, retrieval, % change calculation |
| `components/rates/fx-sparkline-card.tsx` | Create | Single currency card with sparkline |
| `components/rates/fx-rate-grid.tsx` | Create | Grid layout for all cards |
| `app/(tabs)/rates.tsx` | Create | New Rates tab screen |
| `lib/fx.ts:45` | Modify | Call `appendFxHistory()` after fetch |
| `app/(tabs)/_layout.tsx` | Modify | Add "Rates" tab |
| `app/product/[id].tsx` | Modify | Show rate subtitle on converted price |
| `components/best-distributor-card.tsx` | Modify | Show rate subtitle on converted price |
| `tests/fx-history.test.ts` | Create | Unit tests for history helpers |

---

### Task 1: FX Rate History Storage

**Files:**
- Create: `lib/storage/fx-history.ts`
- Test: `tests/fx-history.test.ts`

- [ ] **Step 1: Write failing tests for FX history storage**

```typescript
// tests/fx-history.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAdapter = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

function createStorage() {
  return {
    adapter: mockAdapter,
    KEYS: { FX_RATE_HISTORY: "fx_rate_history" },
  };
}

describe("FX Rate History Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.getItem.mockResolvedValue(null);
  });

  it("returns null when no history exists", async () => {
    const { createFxHistoryStorage } = await import("@/lib/storage/fx-history");
    const storage = createFxHistoryStorage(createStorage() as any);
    const result = await storage.getFxHistory();
    expect(result).toBeNull();
  });

  it("saves history with enqueue", async () => {
    const { createFxHistoryStorage } = await import("@/lib/storage/fx-history");
    const storage = createFxHistoryStorage(createStorage() as any);
    await storage.saveFxHistory({
      rates: { USD: [1], EUR: [0.92] },
      timestamps: [1000],
    });
    expect(mockAdapter.setItem).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/fx-history.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FX history storage**

```typescript
// lib/storage/fx-history.ts
import type { StorageContext } from "./context";

export interface FxHistory {
  rates: Record<string, number[]>;
  timestamps: number[];
}

const MAX_POINTS = 90;

export function createFxHistoryStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  async function getFxHistory(): Promise<FxHistory | null> {
    try {
      const raw = await adapter.getItem(KEYS.FX_RATE_HISTORY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.rates ||
        !parsed.timestamps
      )
        return null;
      return { rates: parsed.rates, timestamps: parsed.timestamps };
    } catch {
      return null;
    }
  }

  async function saveFxHistory(history: FxHistory): Promise<void> {
    await enqueue(KEYS.FX_RATE_HISTORY, async () => {
      await adapter.setItem(KEYS.FX_RATE_HISTORY, JSON.stringify(history));
    });
  }

  return { getFxHistory, saveFxHistory };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/fx-history.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage/fx-history.ts tests/fx-history.test.ts
git commit -m "feat: add FX rate history storage"
```

---

### Task 2: FX History Helpers

**Files:**
- Create: `lib/fx-history.ts`
- Test: `tests/fx-history.test.ts` (append to existing)

- [ ] **Step 1: Write failing tests for history helpers**

```typescript
// Append to tests/fx-history.test.ts
describe("appendFxHistory", () => {
  it("appends new rates and timestamp", async () => {
    const { appendFxHistory } = await import("@/lib/fx-history");
    const history = { rates: { USD: [1], EUR: [0.92] }, timestamps: [1000] };
    const result = appendFxHistory(history, { USD: 1, EUR: 0.93 }, 2000);
    expect(result.rates.USD).toEqual([1, 1]);
    expect(result.rates.EUR).toEqual([0.92, 0.93]);
    expect(result.timestamps).toEqual([1000, 2000]);
  });

  it("caps at MAX_POINTS", async () => {
    const { appendFxHistory } = await import("@/lib/fx-history");
    const history = {
      rates: { USD: Array(90).fill(1), EUR: Array(90).fill(0.92) },
      timestamps: Array(90).fill(1000),
    };
    const result = appendFxHistory(history, { USD: 1, EUR: 0.93 }, 2000);
    expect(result.rates.USD.length).toBe(90);
    expect(result.timestamps.length).toBe(90);
    expect(result.timestamps[0]).toBe(1000 + 1); // shifted by 1
  });

  it("creates new history from empty", async () => {
    const { appendFxHistory } = await import("@/lib/fx-history");
    const result = appendFxHistory(null, { USD: 1, EUR: 0.92 }, 1000);
    expect(result.rates.USD).toEqual([1]);
    expect(result.timestamps).toEqual([1000]);
  });
});

describe("getFxChange", () => {
  it("computes % change between last two data points", async () => {
    const { getFxChange } = await import("@/lib/fx-history");
    const history = {
      rates: { USD: [1, 1], EUR: [0.92, 0.93] },
      timestamps: [1000, 2000],
    };
    const change = getFxChange(history);
    expect(change.EUR).toBeCloseTo(1.087, 1); // (0.93-0.92)/0.92 * 100
  });

  it("returns 0 for single data point", async () => {
    const { getFxChange } = await import("@/lib/fx-history");
    const history = {
      rates: { EUR: [0.92] },
      timestamps: [1000],
    };
    const change = getFxChange(history);
    expect(change.EUR).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/fx-history.test.ts`
Expected: FAIL — functions not found

- [ ] **Step 3: Implement FX history helpers**

```typescript
// lib/fx-history.ts
import type { FxHistory } from "./storage/fx-history";

const MAX_POINTS = 90;

export function appendFxHistory(
  existing: FxHistory | null,
  rates: Record<string, number>,
  timestamp: number,
): FxHistory {
  if (!existing) {
    const historyRates: Record<string, number[]> = {};
    for (const [code, value] of Object.entries(rates)) {
      historyRates[code] = [value];
    }
    return { rates: historyRates, timestamps: [timestamp] };
  }

  const newRates: Record<string, number[]> = {};
  const allCodes = new Set([
    ...Object.keys(existing.rates),
    ...Object.keys(rates),
  ]);

  for (const code of allCodes) {
    const prev = existing.rates[code] ?? [];
    const newVal = rates[code] ?? prev[prev.length - 1] ?? 1;
    newRates[code] = [...prev, newVal];
    if (newRates[code].length > MAX_POINTS) {
      newRates[code] = newRates[code].slice(-MAX_POINTS);
    }
  }

  const newTimestamps = [...existing.timestamps, timestamp];
  return {
    rates: newRates,
    timestamps: newTimestamps.slice(-MAX_POINTS),
  };
}

export function getFxChange(
  history: FxHistory,
): Record<string, number> {
  const change: Record<string, number> = {};
  for (const [code, rates] of Object.entries(history.rates)) {
    if (rates.length < 2) {
      change[code] = 0;
    } else {
      const prev = rates[rates.length - 2];
      const curr = rates[rates.length - 1];
      change[code] = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : 0;
    }
  }
  return change;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/fx-history.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/fx-history.ts tests/fx-history.test.ts
git commit -m "feat: add FX history append and change calculation helpers"
```

---

### Task 3: Append History on FX Fetch

**Files:**
- Modify: `lib/fx.ts:45`
- Modify: `lib/storage.ts` (add KEYS.FX_RATE_HISTORY)

- [ ] **Step 1: Add FX_RATE_HISTORY key to storage**

Check `lib/storage.ts` for the `KEYS` object and add:
```typescript
FX_RATE_HISTORY: "fx_rate_history",
```

- [ ] **Step 2: Update refreshFxRates to append history**

```typescript
// lib/fx.ts — add import at top
import { appendFxHistory } from "./fx-history";
import { createFxHistoryStorage } from "./storage/fx-history";

// In refreshFxRates, after saveFxRates:
    await storage.saveFxRates({
      rates: result.rates,
      fetchedAt: result.fetchedAt,
    });
    setExchangeRates(result.rates);

    // Append to history
    const historyStorage = createFxHistoryStorage(/* storage context */);
    const existing = await historyStorage.getFxHistory();
    const updated = appendFxHistory(existing, result.rates, result.fetchedAt);
    await historyStorage.saveFxHistory(updated);
```

Note: The exact integration depends on how `createFxHistoryStorage` receives its context. Check existing `createDigestFxStorage` pattern in `lib/storage/digest-fx.ts` and follow the same barrel export pattern in `lib/storage.ts`.

- [ ] **Step 3: Run type check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add lib/fx.ts lib/storage.ts
git commit -m "feat: append FX rate history on each fetch"
```

---

### Task 4: FX Sparkline Card Component

**Files:**
- Create: `components/rates/fx-sparkline-card.tsx`

- [ ] **Step 1: Create the sparkline card component**

```typescript
// components/rates/fx-sparkline-card.tsx
import { Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";

interface FxSparklineCardProps {
  currency: string;
  flag: string;
  rate: number;
  change: number;
  history: number[];
}

export function FxSparklineCard({
  currency,
  flag,
  rate,
  change,
  history,
}: FxSparklineCardProps) {
  const colors = useColors();
  const changeColor = change > 0 ? colors.success : change < 0 ? colors.error : colors.muted;

  const sparklinePoints = history.length >= 2
    ? (() => {
        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = max - min || 1;
        return history
          .map((v, i) => {
            const x = (i / (history.length - 1)) * 56;
            const y = 20 - ((v - min) / range) * 18;
            return `${x},${y}`;
          })
          .join(" ");
      })()
    : "";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        flex: 1,
        minWidth: "45%",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 20 }}>{flag}</Text>
        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>
          {currency}
        </Text>
      </View>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 4 }}>
        {rate.toFixed(4)}
      </Text>
      <Text style={{ color: changeColor, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
        {change > 0 ? "+" : ""}{change.toFixed(2)}%
      </Text>
      {sparklinePoints ? (
        <Svg width={60} height={24} style={{ marginTop: 6 }}>
          <Polyline
            points={sparklinePoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={1.5}
          />
        </Svg>
      ) : (
        <View style={{ height: 24, marginTop: 6 }} />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/rates/fx-sparkline-card.tsx
git commit -m "feat: add FX sparkline card component"
```

---

### Task 5: FX Rate Grid Component

**Files:**
- Create: `components/rates/fx-rate-grid.tsx`

- [ ] **Step 1: Create the grid component**

```typescript
// components/rates/fx-rate-grid.tsx
import { View } from "react-native";
import { FxSparklineCard } from "./fx-sparkline-card";

const CURRENCY_INFO: Record<string, { flag: string }> = {
  USD: { flag: "🇺🇸" },
  EUR: { flag: "🇪🇺" },
  GBP: { flag: "🇬🇧" },
  MYR: { flag: "🇲🇾" },
  AUD: { flag: "🇦🇺" },
  NZD: { flag: "🇳🇿" },
  CAD: { flag: "🇨🇦" },
  ZAR: { flag: "🇿🇦" },
  THB: { flag: "🇹🇭" },
  SGD: { flag: "🇸🇬" },
  HKD: { flag: "🇭🇰" },
  AED: { flag: "🇦🇪" },
};

interface FxRateGridProps {
  currentRates: Record<string, number>;
  history: Record<string, number[]>;
  change: Record<string, number>;
}

export function FxRateGrid({ currentRates, history, change }: FxRateGridProps) {
  const currencies = Object.keys(CURRENCY_INFO);

  const rows: string[][] = [];
  for (let i = 0; i < currencies.length; i += 2) {
    rows.push(currencies.slice(i, i + 2));
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 8 }}>
          {row.map((code) => (
            <FxSparklineCard
              key={code}
              currency={code}
              flag={CURRENCY_INFO[code]?.flag ?? ""}
              rate={currentRates[code] ?? 1}
              change={change[code] ?? 0}
              history={history[code] ?? []}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/rates/fx-rate-grid.tsx
git commit -m "feat: add FX rate grid layout component"
```

---

### Task 6: Rates Tab Screen

**Files:**
- Create: `app/(tabs)/rates.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Create the Rates tab screen**

```typescript
// app/(tabs)/rates.tsx
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { FxRateGrid } from "@/components/rates/fx-rate-grid";
import { EXCHANGE_RATES } from "@/lib/currency";
import { getFxHistory, appendFxHistory, getFxChange } from "@/lib/fx-history";
import type { FxHistory } from "@/lib/storage/fx-history";

export default function RatesScreen() {
  const colors = useColors();
  const [history, setHistory] = useState<FxHistory | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const h = await getFxHistory();
    setHistory(h);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const lastUpdated = history?.timestamps?.length
    ? history.timestamps[history.timestamps.length - 1]
    : null;

  const currentRates = history?.rates
    ? Object.fromEntries(
        Object.entries(history.rates).map(([code, rates]) => [code, rates[rates.length - 1] ?? EXCHANGE_RATES[code] ?? 1])
      )
    : EXCHANGE_RATES;

  const change = history ? getFxChange(history) : {};

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700", marginBottom: 4 }}>
          Exchange Rates
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 16 }}>
          {lastUpdated
            ? `Last updated ${formatTimeAgo(lastUpdated)}`
            : "No data yet — rates update hourly"}
        </Text>
        <FxRateGrid
          currentRates={currentRates}
          history={history?.rates ?? {}}
          change={change}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
```

- [ ] **Step 2: Add Rates tab to layout**

```typescript
// app/(tabs)/_layout.tsx — add after Alerts tab, before Settings tab
      <Tabs.Screen
        name="rates"
        options={{
          title: "Rates",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.xyaxis.line" color={color} />
          ),
        }}
      />
```

- [ ] **Step 3: Add icon mapping for `chart.xyaxis.line`**

Check `components/ui/icon-symbol.tsx` for the Android/web mapping. If `chart.xyaxis.line` doesn't exist, add a mapping. Alternatively, use an existing icon like `dollarsign.circle.fill`.

- [ ] **Step 4: Run type check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/rates.tsx app/(tabs)/_layout.tsx
git commit -m "feat: add Rates tab screen with sparkline grid"
```

---

### Task 7: Show Rate Subtitle on Converted Prices

**Files:**
- Modify: `app/product/[id].tsx`
- Modify: `components/best-distributor-card.tsx`

- [ ] **Step 1: Add rate subtitle to product detail converted price**

In `app/product/[id].tsx`, find the section where the best-deal converted price is displayed (the currency converter widget around line 196-250). After the `formatPrice(best.price, displayCurrency)` text, add a muted subtitle showing the rate:

```typescript
{displayCurrency !== "USD" && (
  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
    1 {listing.currency} = {convertPrice(1, listing.currency, displayCurrency).toFixed(4)} {displayCurrency}
  </Text>
)}
```

The exact placement depends on the listing being shown. For the best-deal card, use the listing's native currency.

- [ ] **Step 2: Add rate subtitle to best-distributor-card**

In `components/best-distributor-card.tsx`, after the price display, add:

```typescript
{displayCurrency !== currency && (
  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
    1 {currency} = {convertPrice(1, currency, displayCurrency).toFixed(4)} {displayCurrency}
  </Text>
)}
```

- [ ] **Step 3: Run type check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/product/[id].tsx components/best-distributor-card.tsx
git commit -m "feat: show exchange rate subtitle on converted prices"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full type check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 2: Full lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 4: Manual smoke test**

Start the dev server and verify:
- Rates tab appears and loads
- Sparkline cards render with data
- Exchange rate subtitle shows on product detail
- Pull-to-refresh works on Rates screen

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete FX sparkline grid and multi-currency display

- Add FX rate history storage (lib/storage/fx-history.ts)
- Add append/change helpers (lib/fx-history.ts)
- Append history on each hourly FX fetch
- Add Rates tab with sparkline grid (12 currencies)
- Show exchange rate subtitle on converted prices
- tsc 0, lint 0, all tests passing"
```
