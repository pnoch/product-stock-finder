# Compare Screen Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `app/compare/[id].tsx` (1,165 lines) into smaller components, reducing it to ~100-120 lines.

**Architecture:** Extract 7 presentational components + 1 utility module into `components/compare/` and `lib/`. The main screen becomes a thin composition root with hooks and memoized computations.

**Tech Stack:** React Native, Expo, TypeScript, expo-haptics, expo-router, react-native-svg, AsyncStorage (via lib/storage.ts), NativeWind/useColors for theming.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/compare-utils.ts` | CHART_COLORS, TimeRange, SortBy, TIME_RANGES, TIME_RANGE_DAYS, filterByRange |
| `components/compare/multi-line-chart.tsx` | SVG multi-series line chart |
| `components/compare/cheapest-region-card.tsx` | Cheapest-per-region summary card |
| `components/compare/compare-header.tsx` | Back button, title, refresh |
| `components/compare/chart-card.tsx` | Time-range chips + chart + legend |
| `components/compare/cross-alert-cta.tsx` | Cross-distributor alert CTA |
| `components/compare/current-prices-table.tsx` | Selected distributor prices |
| `components/compare/distributor-selector.tsx` | Sort chips + checkbox list |
| `app/compare/[id].tsx` | Composition root (~100-120 lines) |

---

## Task 1: Extract compare-utils.ts

**Files:**
- Create: `lib/compare-utils.ts`
- Modify: `app/compare/[id].tsx:37-55` (remove inline constants, import from util)

- [ ] **Step 1: Create `lib/compare-utils.ts`**

```typescript
import { PricePoint } from "@/lib/types";

// ─── Chart colors for up to 5 distributors ───────────────────────────────────
export const CHART_COLORS = [
  "#0a7ea4",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
];

// ─── Time range options ───────────────────────────────────────────────────────
export type TimeRange = "1W" | "1M" | "3M" | "All";
export const TIME_RANGES: TimeRange[] = ["1W", "1M", "3M", "All"];
export type SortBy = "trend" | "price" | "name";
export const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  All: 9999,
};

export function filterByRange(data: PricePoint[], range: TimeRange): PricePoint[] {
  if (range === "All") return data;
  const cutoff = Date.now() - TIME_RANGE_DAYS[range] * 86400000;
  return data.filter((p) => new Date(p.date).getTime() >= cutoff);
}
```

- [ ] **Step 2: Update `app/compare/[id].tsx` to import from util**

Remove lines 37-55 (the inline constants and helper) and replace with:
```typescript
import {
  CHART_COLORS,
  TimeRange,
  SortBy,
  TIME_RANGES,
  filterByRange,
} from "@/lib/compare-utils";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add lib/compare-utils.ts app/compare/\[id\].tsx
git commit -m "refactor: extract compare-utils.ts"
```

---

## Task 2: Extract MultiLineChart

**Files:**
- Create: `components/compare/multi-line-chart.tsx`
- Modify: `app/compare/[id].tsx:57-242` (remove inline component, import)

- [ ] **Step 1: Create `components/compare/multi-line-chart.tsx`**

Move the entire `MultiLineChart` function component (lines 57-242) to this new file. Add the necessary imports:

```typescript
import { Fragment, useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import { convertPrice } from "@/lib/currency";
import { PricePoint } from "@/lib/types";

export function MultiLineChart({
  series,
  width,
  height,
}: {
  series: {
    label: string;
    color: string;
    data: PricePoint[];
    currency: string;
  }[];
  width: number;
  height: number;
}) {
  const colors = useColors();
  // ... exact same implementation from lines 72-241
}
```

- [ ] **Step 2: Update `app/compare/[id].tsx` to use MultiLineChart**

Remove lines 57-242 (the inline MultiLineChart component) and add:
```typescript
import { MultiLineChart } from "@/components/compare/multi-line-chart";
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/compare/multi-line-chart.tsx app/compare/\[id\].tsx
git commit -m "refactor: extract MultiLineChart to components/compare/"
```

---

## Task 3: Extract CheapestRegionCard

**Files:**
- Create: `components/compare/cheapest-region-card.tsx`
- Modify: `app/compare/[id].tsx:244-400` (remove inline component, import)

- [ ] **Step 1: Create `components/compare/cheapest-region-card.tsx`**

Move the entire `CheapestRegionCard` function component (lines 244-400) to this new file:

```typescript
import { useMemo } from "react";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";

export function CheapestRegionCard({
  listings,
}: {
  listings: DistributorListing[];
}) {
  const colors = useColors();
  // ... exact same implementation from lines 252-399
}
```

Note: Remove the `colors` prop — the component now calls `useColors()` internally.

- [ ] **Step 2: Update `app/compare/[id].tsx` to use CheapestRegionCard**

Remove lines 244-400 (the inline CheapestRegionCard component) and add:
```typescript
import { CheapestRegionCard } from "@/components/compare/cheapest-region-card";

// Update usage:
<CheapestRegionCard listings={listings} />
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/compare/cheapest-region-card.tsx app/compare/\[id\].tsx
git commit -m "refactor: extract CheapestRegionCard to components/compare/"
```

---

## Task 4: Extract CompareHeader

**Files:**
- Create: `components/compare/compare-header.tsx`
- Modify: `app/compare/[id].tsx:606-670` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/compare/compare-header.tsx`**

```typescript
import { Text, View, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAlert } from "@/lib/alert";

interface CompareHeaderProps {
  productName: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<boolean>;
  onBack: () => void;
}

export function CompareHeader({
  productName,
  isRefreshing,
  onRefresh,
  onBack,
}: CompareHeaderProps) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        gap: 12,
      }}
    >
      <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
        <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 18,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          Compare Prices
        </Text>
        <Text
          style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}
          numberOfLines={1}
        >
          {productName}
        </Text>
      </View>
      <TouchableOpacity
        onPress={async () => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const ok = await onRefresh();
          if (!ok) {
            showAlert(
              "Couldn't refresh prices",
              "The server is unreachable. Showing saved prices.",
            );
          }
        }}
        disabled={isRefreshing}
        style={{ padding: 4 }}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <IconSymbol name="arrow.clockwise" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: Update `app/compare/[id].tsx` to use CompareHeader**

Remove lines 606-670 (the inline header) and replace with:
```typescript
import { CompareHeader } from "@/components/compare/compare-header";

<CompareHeader
  productName={productName}
  isRefreshing={isRefreshingAny}
  onRefresh={refresh}
  onBack={() => router.back()}
/>
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/compare/compare-header.tsx app/compare/\[id\].tsx
git commit -m "refactor: extract CompareHeader to components/compare/"
```

---

## Task 5: Extract ChartCard

**Files:**
- Create: `components/compare/chart-card.tsx`
- Modify: `app/compare/[id].tsx:672-803` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/compare/chart-card.tsx`**

```typescript
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MultiLineChart } from "@/components/compare/multi-line-chart";
import { TimeRange, TIME_RANGES } from "@/lib/compare-utils";

interface ChartCardProps {
  timeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  chartSeries: Array<{
    label: string;
    color: string;
    data: any[];
    currency: string;
  }>;
  chartWidth: number;
}

export function ChartCard({
  timeRange,
  onRangeChange,
  chartSeries,
  chartWidth,
}: ChartCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          Price History (USD)
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {TIME_RANGES.map((r) => {
            const active = r === timeRange;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => onRangeChange(r)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: active
                    ? colors.primary
                    : colors.border + "44",
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.muted,
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Text
        style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}
      >
        Select up to 5 distributors to overlay
      </Text>
      {chartSeries.length >= 2 ? (
        <MultiLineChart
          series={chartSeries}
          width={chartWidth}
          height={220}
        />
      ) : (
        <View
          style={{
            height: 120,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol
            name="chart.bar.xaxis"
            size={36}
            color={colors.muted}
          />
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Select at least 2 distributors{"\n"}with price history to
            compare
          </Text>
        </View>
      )}
      {chartSeries.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
          }}
        >
          {chartSeries.map((s) => (
            <View
              key={s.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: s.color,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Update `app/compare/[id].tsx` to use ChartCard**

Remove lines 672-803 (the inline chart card) and replace with:
```typescript
import { ChartCard } from "@/components/compare/chart-card";

<ChartCard
  timeRange={timeRange}
  onRangeChange={setRange}
  chartSeries={chartSeries}
  chartWidth={chartWidth}
/>
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/compare/chart-card.tsx app/compare/\[id\].tsx
git commit -m "refactor: extract ChartCard to components/compare/"
```

---

## Task 6: Extract CrossAlertCTA

**Files:**
- Create: `components/compare/cross-alert-cta.tsx`
- Modify: `app/compare/[id].tsx:808-866` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/compare/cross-alert-cta.tsx`**

```typescript
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DistributorListing } from "@/lib/types";
import { convertPrice } from "@/lib/currency";

interface CrossAlertCTAProps {
  listings: DistributorListing[];
  onPress: () => void;
}

export function CrossAlertCTA({ listings, onPress }: CrossAlertCTAProps) {
  const colors = useColors();

  const inStock = listings.filter((l) => l.stockStatus === "in_stock");
  if (inStock.length === 0) return null;

  const bestUSD = Math.min(
    ...inStock.map((l) => convertPrice(l.price, l.currency, "USD")),
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.primary + "18",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.primary + "44",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <IconSymbol name="bell.fill" size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.primary,
            fontWeight: "700",
            fontSize: 13,
          }}
        >
          Alert me if any distributor drops below
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            marginTop: 1,
          }}
        >
          ${(bestUSD * 0.95).toFixed(2)} (5% below current best of $
          {bestUSD.toFixed(2)})
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={colors.primary} />
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Update `app/compare/[id].tsx` to use CrossAlertCTA**

Remove lines 808-866 (the inline alert CTA) and replace with:
```typescript
import { CrossAlertCTA } from "@/components/compare/cross-alert-cta";

<CrossAlertCTA listings={listings} onPress={handleCrossAlert} />
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/compare/cross-alert-cta.tsx app/compare/\[id\].tsx
git commit -m "refactor: extract CrossAlertCTA to components/compare/"
```

---

## Task 7: Extract CurrentPricesTable

**Files:**
- Create: `components/compare/current-prices-table.tsx`
- Modify: `app/compare/[id].tsx:868-987` (remove inline JSX, use component)

- [ ] **Step 1: Create `components/compare/current-prices-table.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { CHART_COLORS } from "@/lib/compare-utils";

interface CurrentPricesTableProps {
  listings: DistributorListing[];
  selected: Set<string>;
}

export function CurrentPricesTable({
  listings,
  selected,
}: CurrentPricesTableProps) {
  const colors = useColors();

  if (selected.size === 0) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 15,
          marginBottom: 12,
        }}
      >
        Current Prices
      </Text>
      {listings
        .filter((l) => selected.has(l.distributorId))
        .map((l, i) => {
          const distributor = getDistributorById(l.distributorId);
          const usd = convertPrice(l.price, l.currency, "USD");
          const color =
            CHART_COLORS[
              Array.from(selected).indexOf(l.distributorId) %
                CHART_COLORS.length
            ];
          return (
            <View
              key={l.distributorId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: color,
                  marginRight: 10,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {distributor?.countryFlag}{" "}
                  {distributor?.name ?? l.distributorId}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {distributor?.country}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {formatPrice(l.price, l.currency)}
                </Text>
                {l.currency !== "USD" && (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    ≈ ${usd.toFixed(2)}
                  </Text>
                )}
                <View
                  style={{
                    backgroundColor:
                      l.stockStatus === "in_stock"
                        ? colors.success + "22"
                        : colors.warning + "22",
                    borderRadius: 8,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    marginTop: 2,
                  }}
                >
                  <Text
                    style={{
                      color:
                        l.stockStatus === "in_stock"
                          ? colors.success
                          : colors.warning,
                      fontSize: 10,
                      fontWeight: "600",
                    }}
                  >
                    {l.stockStatus === "in_stock"
                      ? "In Stock"
                      : l.stockStatus === "back_order"
                        ? "Back Order"
                        : l.stockStatus === "unknown"
                          ? "Unknown"
                          : "Out of Stock"}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
    </View>
  );
}
```

- [ ] **Step 2: Update `app/compare/[id].tsx` to use CurrentPricesTable**

Remove lines 868-987 (the inline prices table) and replace with:
```typescript
import { CurrentPricesTable } from "@/components/compare/current-prices-table";

<CurrentPricesTable listings={listings} selected={selected} />
```

- [ ] **Step 3: Run `pnpm check` — 0 errors**

- [ ] **Step 4: Run `pnpm test` — all pass**

- [ ] **Step 5: Commit**

```bash
git add components/compare/current-prices-table.tsx app/compare/\[id\].tsx
git commit -m "refactor: extract CurrentPricesTable to components/compare/"
```

---

## Task 8: Extract DistributorSelector + cleanup

**Files:**
- Create: `components/compare/distributor-selector.tsx`
- Modify: `app/compare/[id].tsx` (use component, cleanup imports)
- Modify: `todo.md` (add Phase 72)

- [ ] **Step 1: Create `components/compare/distributor-selector.tsx`**

```typescript
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { CHART_COLORS, SortBy } from "@/lib/compare-utils";

interface DistributorSelectorProps {
  sortedListings: DistributorListing[];
  selected: Set<string>;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  onToggle: (distributorId: string) => void;
  priceTrends: Map<string, { pct: number; dir: "up" | "down" | "flat" }>;
}

export function DistributorSelector({
  sortedListings,
  selected,
  sortBy,
  onSortChange,
  onToggle,
  priceTrends,
}: DistributorSelectorProps) {
  const colors = useColors();

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          Select Distributors ({selected.size}/5)
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {(["trend", "price", "name"] as SortBy[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => onSortChange(s)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor:
                  sortBy === s ? colors.primary : colors.border + "44",
              }}
            >
              <Text
                style={{
                  color: sortBy === s ? "#fff" : colors.muted,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {s === "trend"
                  ? "Trend ▼"
                  : s === "price"
                    ? "Price"
                    : "A–Z"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {sortedListings.map((l) => {
        const distributor = getDistributorById(l.distributorId);
        const isSelected = selected.has(l.distributorId);
        const hasHistory = l.priceHistory && l.priceHistory.length >= 2;
        const colorIdx = Array.from(selected).indexOf(l.distributorId);
        const chipColor = isSelected
          ? CHART_COLORS[colorIdx % CHART_COLORS.length]
          : colors.border;
        const trend = priceTrends.get(l.distributorId);
        return (
          <TouchableOpacity
            key={l.distributorId}
            onPress={() => onToggle(l.distributorId)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isSelected
                ? chipColor + "18"
                : colors.surface,
              borderRadius: 14,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1.5,
              borderColor: isSelected ? chipColor : colors.border,
              opacity: !hasHistory && !isSelected ? 0.5 : 1,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: isSelected ? chipColor : colors.border,
                backgroundColor: isSelected ? chipColor : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              {isSelected && (
                <IconSymbol name="checkmark" size={12} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {distributor?.countryFlag}{" "}
                {distributor?.name ?? l.distributorId}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {hasHistory
                  ? `${l.priceHistory!.length} price points`
                  : "No price history"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: isSelected ? chipColor : colors.foreground,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {formatPrice(l.price, l.currency)}
              </Text>
              {trend && trend.dir !== "flat" && (
                <Text
                  style={{
                    color:
                      trend.dir === "down"
                        ? colors.success
                        : colors.error,
                    fontSize: 11,
                    fontWeight: "600",
                    marginTop: 1,
                  }}
                >
                  {trend.dir === "down" ? "▼" : "▲"}{" "}
                  {trend.pct.toFixed(1)}%
                </Text>
              )}
              <View
                style={{
                  backgroundColor:
                    l.stockStatus === "in_stock"
                      ? colors.success + "22"
                      : colors.warning + "22",
                  borderRadius: 8,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  marginTop: 2,
                }}
              >
                <Text
                  style={{
                    color:
                      l.stockStatus === "in_stock"
                        ? colors.success
                        : colors.warning,
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {l.stockStatus === "in_stock"
                    ? "In Stock"
                    : l.stockStatus === "back_order"
                      ? "Back Order"
                      : l.stockStatus === "unknown"
                        ? "Unknown"
                        : "Out of Stock"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Update `app/compare/[id].tsx` to use DistributorSelector**

Remove lines 989-1160 (the inline distributor selector) and replace with:
```typescript
import { DistributorSelector } from "@/components/compare/distributor-selector";

<DistributorSelector
  sortedListings={sortedListings}
  selected={selected}
  sortBy={sortBy}
  onSortChange={setSortByMode}
  onToggle={toggleSelect}
  priceTrends={priceTrends}
/>
```

- [ ] **Step 3: Remove unused imports from `app/compare/[id].tsx`**

Remove: `Fragment` (if unused after MultiLineChart extraction). Keep all other imports that are still used.

- [ ] **Step 4: Update `todo.md`**

Append Phase 72 section at the end:
```
## Phase 72: Compare Screen Refactor (v5.20)

- [x] Extract compare-utils.ts
- [x] Extract MultiLineChart to components/compare/
- [x] Extract CheapestRegionCard to components/compare/
- [x] Extract CompareHeader to components/compare/
- [x] Extract ChartCard to components/compare/
- [x] Extract CrossAlertCTA to components/compare/
- [x] Extract CurrentPricesTable to components/compare/
- [x] Extract DistributorSelector to components/compare/
- [x] Refactor main component to composition root
```

- [ ] **Step 5: Run `pnpm check` — 0 errors**

- [ ] **Step 6: Run `pnpm test` — all pass**

- [ ] **Step 7: Run `wc -l app/compare/\[id\].tsx` — should be ~100-120 lines**

- [ ] **Step 8: Commit and push**

```bash
git add app/compare/\[id\].tsx components/compare/ todo.md
git commit -m "refactor: extract DistributorSelector, cleanup compare screen"
git push origin main
```

---

## Summary

| File | Before | After |
|------|--------|-------|
| `app/compare/[id].tsx` | 1,165 | ~100-120 |
| New: `lib/compare-utils.ts` | — | ~20 |
| New: `components/compare/` (7 files) | — | ~890 |
| **Net** | 1,165 | ~1,010 |

**Key metrics:**
- compare/[id].tsx: 90% reduction
- 7 new component files + 1 util module
- Same decomposition pattern as watchlist/alerts/settings
