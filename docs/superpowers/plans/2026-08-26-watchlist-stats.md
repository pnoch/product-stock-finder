# Watchlist Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Statistics screen reachable from the Watchlist summary card showing price movers (7d/30d/All toggle), basket value at best in-stock prices, stock health, and data freshness.

**Architecture:** Pure computation module (`lib/watchlist-stats.ts`) with TDD coverage; four presentational cards under `components/stats/`; thin `app/stats.tsx` route following the existing custom-header pattern (global `headerShown: false`).

**Tech Stack:** Expo Router 6, React Native, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/watchlist-stats.ts` | Pure: `computeMovers`, `computeBasketValue`, `computeStockHealth`, `computeDataFreshness`, `computeWatchlistStats` |
| `tests/watchlist-stats.test.ts` | Unit tests incl. edge cases |
| `components/stats/movers-card.tsx` | Segmented control + ranked drop/gainer rows |
| `components/stats/basket-value-card.tsx` | Basket total card |
| `components/stats/stock-health-card.tsx` | Stock percentages |
| `components/stats/data-freshness-card.tsx` | Freshness metrics |
| `app/stats.tsx` | Screen composition root |
| `components/watchlist/summary-card.tsx` | Add "View stats" tap target (new `onViewStats` prop) |
| `app/(tabs)/watchlist.tsx` | Wire `onViewStats` → `router.push("/stats")` |

**Existing patterns to follow:** custom header with back button (see `app/search.tsx` lines ~112-135); `ScreenContainer`; named storage imports (`getWatchlist`, `getSettings`); `useColors()` tokens; haptics guard `Platform.OS !== "web"`.

---

## Task 1: Stats computation module (TDD)

**Files:**
- Create: `lib/watchlist-stats.ts`
- Test: `tests/watchlist-stats.test.ts`

- [ ] **Step 1: Write failing test `tests/watchlist-stats.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import {
  computeMovers,
  computeBasketValue,
  computeStockHealth,
  computeDataFreshness,
} from "../lib/watchlist-stats";
import type { DistributorListing, Product } from "../lib/types";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function listing(
  overrides: Partial<DistributorListing> & { distributorId: string },
): DistributorListing {
  return {
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date(NOW - DAY).toISOString(),
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

function product(
  id: string,
  listings: DistributorListing[],
  name = id,
): Product {
  return {
    id,
    name,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: new Date(NOW).toISOString(),
    listings,
  } as unknown as Product;
}

describe("computeMovers", () => {
  it("ranks drops and gainers by magnitude within the window", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 80, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ], "Router A"),
      product("p2", [
        listing({
          distributorId: "winncom",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 200, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 250, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ], "Router B"),
      product("p3", [
        listing({
          distributorId: "miro",
          priceHistory: [
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 50, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 40, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ], "Router C"),
    ];
    const result = computeMovers(wl, "USD", 30, NOW);
    expect(result.drops.map((d) => d.productId)).toEqual(["p3", "p1"]);
    expect(result.drops[0].changePct).toBe(-20);
    expect(result.gainers.map((g) => g.productId)).toEqual(["p2"]);
    expect(result.gainers[0].changePct).toBe(25);
  });

  it("excludes points outside the window", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore",
          priceHistory: [
            { date: new Date(NOW - 90 * DAY).toISOString(), price: 300, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW - 3 * DAY).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 95, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
    ];
    const result = computeMovers(wl, "USD", 7, NOW);
    expect(result.drops[0]).toMatchObject({ changePct: -5 });
  });

  it("skips listings with fewer than two points in window", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "mikrotikstore",
          priceHistory: [
            { date: new Date(NOW).toISOString(), price: 100, currency: "USD", stockStatus: "in_stock" },
          ],
        }),
      ]),
    ];
    expect(computeMovers(wl, "USD", 30, NOW)).toEqual({ drops: [], gainers: [] });
  });

  it("converts foreign currencies into the display currency", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "interprojekt",
          priceHistory: [
            { date: new Date(NOW - DAY).toISOString(), price: 100, currency: "EUR", stockStatus: "in_stock" },
            { date: new Date(NOW).toISOString(), price: 90, currency: "EUR", stockStatus: "in_stock" },
          ],
        }),
      ]),
    ];
    const result = computeMovers(wl, "USD", 30, NOW);
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0].currency).toBe("USD");
    expect(result.drops[0].oldPrice).toBeGreaterThan(0);
  });
});

describe("computeBasketValue", () => {
  it("sums cheapest in-stock price per product and counts exclusions", () => {
    const wl = [
      product("p1", [
        listing({ distributorId: "a", price: 120 }),
        listing({ distributorId: "b", price: 100 }),
      ]),
      product("p2", [listing({ distributorId: "a", price: 50 })]),
      product("p3", [
        listing({ distributorId: "a", stockStatus: "out_of_stock", price: 70 }),
      ]),
    ];
    expect(computeBasketValue(wl, "USD")).toEqual({
      total: 150,
      productCount: 2,
      excludedCount: 1,
    });
  });
});

describe("computeStockHealth", () => {
  it("computes percentage and per-product extremes", () => {
    const wl = [
      product("p1", [
        listing({ distributorId: "a", stockStatus: "in_stock" }),
        listing({ distributorId: "b", stockStatus: "back_order" }),
      ]),
      product("p2", [
        listing({ distributorId: "a", stockStatus: "out_of_stock" }),
        listing({ distributorId: "b", stockStatus: "out_of_stock" }),
      ]),
      product("p3", [
        listing({ distributorId: "a", stockStatus: "back_order" }),
      ]),
    ];
    expect(computeStockHealth(wl)).toEqual({
      totalListings: 5,
      inStockPct: 20,
      fullyOutOfStock: 1,
      backOrderOnly: 1,
    });
  });

  it("returns zeros for an empty watchlist", () => {
    expect(computeStockHealth([])).toEqual({
      totalListings: 0,
      inStockPct: 0,
      fullyOutOfStock: 0,
      backOrderOnly: 0,
    });
  });
});

describe("computeDataFreshness", () => {
  it("computes averages, staleness, and oldest check", () => {
    const wl = [
      product("p1", [
        listing({
          distributorId: "a",
          lastChecked: new Date(NOW - 10 * DAY).toISOString(),
          priceHistory: [{ date: "", price: 1, currency: "USD", stockStatus: "in_stock" }],
        }),
        listing({
          distributorId: "b",
          lastChecked: new Date(NOW - 2 * DAY).toISOString(),
          priceHistory: [],
        }),
      ]),
      product("p2", [
        listing({ distributorId: "a", lastChecked: undefined, priceHistory: [] }),
      ]),
    ];
    expect(computeDataFreshness(wl, NOW)).toEqual({
      avgHistoryPoints: 0.5,
      staleCount: 1,
      neverCheckedCount: 1,
      oldestCheck: new Date(NOW - 10 * DAY).toISOString(),
    });
  });
});
```

Note: adjust fixture fields to match the real `DistributorListing` type in `lib/types.ts` if required properties differ — run `pnpm check` to confirm.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/watchlist-stats.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/watchlist-stats.ts`**

```typescript
import type { Product } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";
import { getDistributorById } from "./distributors";

export type MoversWindow = 7 | 30 | null;

export interface PriceMove {
  productId: string;
  productName: string;
  distributorId: string;
  distributorName: string;
  countryFlag: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  changePct: number;
}

export interface MoversResult {
  drops: PriceMove[];
  gainers: PriceMove[];
}

export interface BasketValueResult {
  total: number;
  productCount: number;
  excludedCount: number;
}

export interface StockHealthResult {
  totalListings: number;
  inStockPct: number;
  fullyOutOfStock: number;
  backOrderOnly: number;
}

export interface DataFreshnessResult {
  avgHistoryPoints: number;
  staleCount: number;
  neverCheckedCount: number;
  oldestCheck: string | null;
}

export interface WatchlistStats {
  movers: MoversResult;
  basket: BasketValueResult;
  stockHealth: StockHealthResult;
  freshness: DataFreshnessResult;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 7 * DAY_MS;

function convertToDisplay(
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

export function computeMovers(
  watchlist: Product[],
  displayCurrency: string,
  days: MoversWindow,
  now: number = Date.now(),
): MoversResult {
  const cutoff = days !== null ? now - days * DAY_MS : null;
  const moves: PriceMove[] = [];

  for (const product of watchlist) {
    for (const listing of product.listings ?? []) {
      const points = (listing.priceHistory ?? [])
        .map((p) => ({ ...p, t: Date.parse(p.date) }))
        .filter((p) => Number.isFinite(p.t))
        .sort((a, b) => a.t - b.t);
      const windowed = cutoff !== null
        ? points.filter((p) => p.t >= cutoff)
        : points;
      if (windowed.length < 2) continue;

      const oldest = windowed[0];
      const newest = windowed[windowed.length - 1];
      const oldConverted = convertToDisplay(
        oldest.price,
        oldest.currency,
        displayCurrency,
      );
      const newConverted = convertToDisplay(
        newest.price,
        newest.currency,
        displayCurrency,
      );
      if (oldConverted === null || newConverted === null) continue;

      const changePct = Math.round(
        ((newConverted - oldConverted) / oldConverted) * 100,
      );
      if (changePct === 0) continue;

      const dist = getDistributorById(listing.distributorId);
      moves.push({
        productId: product.id,
        productName: product.name,
        distributorId: listing.distributorId,
        distributorName: dist?.name ?? listing.distributorId,
        countryFlag: dist?.countryFlag ?? "",
        oldPrice: oldConverted,
        newPrice: newConverted,
        currency: displayCurrency,
        changePct,
      });
    }
  }

  const byMagnitude = (a: PriceMove, b: PriceMove) =>
    Math.abs(b.changePct) - Math.abs(a.changePct);

  return {
    drops: moves
      .filter((m) => m.changePct < 0)
      .sort(byMagnitude)
      .slice(0, 5),
    gainers: moves
      .filter((m) => m.changePct > 0)
      .sort(byMagnitude)
      .slice(0, 5),
  };
}

export function computeBasketValue(
  watchlist: Product[],
  displayCurrency: string,
): BasketValueResult {
  let total = 0;
  let productCount = 0;
  let excludedCount = 0;

  for (const product of watchlist) {
    let best: number | null = null;
    for (const listing of product.listings ?? []) {
      if (listing.stockStatus !== "in_stock") continue;
      const converted = convertToDisplay(
        listing.price,
        listing.currency,
        displayCurrency,
      );
      if (converted !== null && (best === null || converted < best)) {
        best = converted;
      }
    }
    if (best !== null) {
      total += best;
      productCount += 1;
    } else {
      excludedCount += 1;
    }
  }

  return { total, productCount, excludedCount };
}

export function computeStockHealth(
  watchlist: Product[],
): StockHealthResult {
  let totalListings = 0;
  let inStock = 0;
  let fullyOutOfStock = 0;
  let backOrderOnly = 0;

  for (const product of watchlist) {
    const listings = product.listings ?? [];
    if (listings.length === 0) continue;
    let inStockCount = 0;
    let outOfStockCount = 0;
    let backOrderCount = 0;
    for (const listing of listings) {
      totalListings += 1;
      if (listing.stockStatus === "in_stock") {
        inStock += 1;
        inStockCount += 1;
      } else if (listing.stockStatus === "out_of_stock") {
        outOfStockCount += 1;
      } else if (listing.stockStatus === "back_order") {
        backOrderCount += 1;
      }
    }
    if (inStockCount === 0 && outOfStockCount === listings.length) {
      fullyOutOfStock += 1;
    } else if (backOrderCount === listings.length) {
      backOrderOnly += 1;
    }
  }

  const inStockPct =
    totalListings > 0 ? Math.round((inStock / totalListings) * 100) : 0;
  return { totalListings, inStockPct, fullyOutOfStock, backOrderOnly };
}

export function computeDataFreshness(
  watchlist: Product[],
  now: number = Date.now(),
): DataFreshnessResult {
  let listingCount = 0;
  let pointCount = 0;
  let staleCount = 0;
  let neverCheckedCount = 0;
  let oldest: number | null = null;

  for (const product of watchlist) {
    for (const listing of product.listings ?? []) {
      listingCount += 1;
      pointCount += listing.priceHistory?.length ?? 0;
      if (!listing.lastChecked) {
        neverCheckedCount += 1;
        continue;
      }
      const t = Date.parse(listing.lastChecked);
      if (!Number.isFinite(t)) {
        neverCheckedCount += 1;
        continue;
      }
      if (now - t > STALE_MS) staleCount += 1;
      if (oldest === null || t < oldest) oldest = t;
    }
  }

  return {
    avgHistoryPoints:
      listingCount > 0
        ? Math.round((pointCount / listingCount) * 10) / 10
        : 0,
    staleCount,
    neverCheckedCount,
    oldestCheck: oldest !== null ? new Date(oldest).toISOString() : null,
  };
}

export function computeWatchlistStats(
  watchlist: Product[],
  displayCurrency: string,
  days: MoversWindow,
  now: number = Date.now(),
): WatchlistStats {
  return {
    movers: computeMovers(watchlist, displayCurrency, days, now),
    basket: computeBasketValue(watchlist, displayCurrency),
    stockHealth: computeStockHealth(watchlist),
    freshness: computeDataFreshness(watchlist, now),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/watchlist-stats.test.ts` — PASS.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/watchlist-stats.ts tests/watchlist-stats.test.ts && git commit -m "feat: add watchlist statistics computation module"
```

---

## Task 2: Stat card components

**Files:**
- Create: `components/stats/movers-card.tsx`
- Create: `components/stats/basket-value-card.tsx`
- Create: `components/stats/stock-health-card.tsx`
- Create: `components/stats/data-freshness-card.tsx`

All four follow the card pattern of `components/watchlist/summary-card.tsx`: rounded surface container, muted section label, `useColors()` tokens.

- [ ] **Step 1: Create `components/stats/movers-card.tsx`**

```typescript
import { Text, View, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type {
  MoversResult,
  MoversWindow,
  PriceMove,
} from "@/lib/watchlist-stats";

const WINDOWS: Array<{ label: string; value: MoversWindow }> = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "All", value: null },
];

function MoveRow({ move, color }: { move: PriceMove; color: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 14 }}>{move.countryFlag}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}
          numberOfLines={1}
        >
          {move.productName}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
          {move.distributorName} · {formatPrice(move.oldPrice, move.currency)} →{" "}
          {formatPrice(move.newPrice, move.currency)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: color + "22",
          borderRadius: 10,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text style={{ color, fontSize: 12, fontWeight: "700" }}>
          {move.changePct > 0 ? "+" : ""}
          {move.changePct}%
        </Text>
      </View>
    </View>
  );
}

export function MoversCard({
  movers,
  days,
  onDaysChange,
}: {
  movers: MoversResult;
  days: MoversWindow;
  onDaysChange: (days: MoversWindow) => void;
}) {
  const colors = useColors();
  const empty =
    movers.drops.length === 0 &&
    movers.gainers.length === 0;

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Biggest Movers
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {WINDOWS.map((w) => (
            <TouchableOpacity
              key={w.label}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDaysChange(w.value);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor:
                  days === w.value ? colors.primary : "transparent",
              }}
            >
              <Text
                style={{
                  color: days === w.value ? "#fff" : colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {w.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {empty ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Not enough price history yet.
        </Text>
      ) : (
        <>
          {movers.drops.length > 0 && (
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600", marginTop: 4 }}>
              ▼ Top Drops
            </Text>
          )}
          {movers.drops.map((move) => (
            <MoveRow key={`${move.productId}-${move.distributorId}`} move={move} color={colors.success} />
          ))}
          {movers.gainers.length > 0 && (
            <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600", marginTop: 8 }}>
              ▲ Top Gainers
            </Text>
          )}
          {movers.gainers.map((move) => (
            <MoveRow key={`${move.productId}-${move.distributorId}`} move={move} color={colors.error} />
          ))}
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Create `components/stats/basket-value-card.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type { BasketValueResult } from "@/lib/watchlist-stats";

export function BasketValueCard({
  basket,
  displayCurrency,
}: {
  basket: BasketValueResult;
  displayCurrency: string;
}) {
  const colors = useColors();

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
        Basket Value (best in-stock prices)
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 26,
          fontWeight: "700",
          marginTop: 4,
        }}
      >
        {formatPrice(basket.total, displayCurrency)}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        {basket.productCount} products
        {basket.excludedCount > 0
          ? ` · ${basket.excludedCount} excluded (no stock)`
          : ""}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Create `components/stats/stock-health-card.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { StockHealthResult } from "@/lib/watchlist-stats";

export function StockHealthCard({ health }: { health: StockHealthResult }) {
  const colors = useColors();

  const rows = [
    {
      label: "Listings in stock",
      value: `${health.inStockPct}%`,
      color: colors.success,
    },
    {
      label: "Fully out of stock",
      value: `${health.fullyOutOfStock}`,
      color: colors.error,
    },
    {
      label: "Back-order everywhere",
      value: `${health.backOrderOnly}`,
      color: colors.warning,
    },
  ];

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
        Stock Health ({health.totalListings} listings)
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {rows.map((row) => (
          <View key={row.label} style={{ flex: 1 }}>
            <Text style={{ color: row.color, fontSize: 18, fontWeight: "700" }}>
              {row.value}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {row.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Create `components/stats/data-freshness-card.tsx`**

```typescript
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { DataFreshnessResult } from "@/lib/watchlist-stats";

export function DataFreshnessCard({
  freshness,
}: {
  freshness: DataFreshnessResult;
}) {
  const colors = useColors();

  const oldestLabel = freshness.oldestCheck
    ? new Date(freshness.oldestCheck).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const rows = [
    { label: "Avg data points / listing", value: `${freshness.avgHistoryPoints}` },
    { label: "Stale (>7 days)", value: `${freshness.staleCount}` },
    { label: "Never checked", value: `${freshness.neverCheckedCount}` },
    { label: "Oldest check", value: oldestLabel },
  ];

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
        Data Freshness
      </Text>
      {rows.map((row) => (
        <View
          key={row.label}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 13 }}>{row.label}</Text>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 5: Verify + commit**

Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

```bash
git add components/stats && git commit -m "feat: add statistics card components"
```

---

## Task 3: Stats screen + watchlist entry point + push

**Files:**
- Create: `app/stats.tsx`
- Modify: `components/watchlist/summary-card.tsx`
- Modify: `app/(tabs)/watchlist.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Create `app/stats.tsx`**

Follows the search-screen pattern: `ScreenContainer`, custom header with back button (global config hides native headers):

```typescript
import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getSettings, getWatchlist } from "@/lib/storage";
import type { Product } from "@/lib/types";
import {
  computeBasketValue,
  computeDataFreshness,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "@/lib/watchlist-stats";
import { MoversCard } from "@/components/stats/movers-card";
import { BasketValueCard } from "@/components/stats/basket-value-card";
import { StockHealthCard } from "@/components/stats/stock-health-card";
import { DataFreshnessCard } from "@/components/stats/data-freshness-card";

export default function StatsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [days, setDays] = useState<MoversWindow>(30);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [wl, settings] = await Promise.all([
        getWatchlist(),
        getSettings(),
      ]);
      setWatchlist(wl);
      setDisplayCurrency(settings.displayCurrency);
      setLoaded(true);
    })();
  }, []);

  const movers = useMemo(
    () => computeMovers(watchlist, displayCurrency, days),
    [watchlist, displayCurrency, days],
  );
  const basket = useMemo(
    () => computeBasketValue(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );
  const stockHealth = useMemo(() => computeStockHealth(watchlist), [watchlist]);
  const freshness = useMemo(() => computeDataFreshness(watchlist), [watchlist]);

  return (
    <ScreenContainer>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={{ padding: 4 }}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 20,
            fontWeight: "700",
            flex: 1,
          }}
        >
          Statistics
        </Text>
      </View>

      {loaded && watchlist.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 80, paddingHorizontal: 32 }}>
          <IconSymbol name="chart.bar" size={40} color={colors.muted} />
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 16,
              marginTop: 12,
            }}
          >
            No statistics yet
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              textAlign: "center",
              marginTop: 6,
            }}
          >
            Add products to your watchlist to see price trends and stock health.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <MoversCard movers={movers} days={days} onDaysChange={setDays} />
          <BasketValueCard basket={basket} displayCurrency={displayCurrency} />
          <StockHealthCard health={stockHealth} />
          <DataFreshnessCard freshness={freshness} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
```

If `chart.bar` is not in the IconSymbol Android/web mapping (`components/ui/icon-symbol.tsx`), either add the mapping (SF Symbol `chart.bar` → Material `bar-chart`) or reuse an already-mapped icon like `chart.line.uptrend.xyaxis` if present — check the mapping file first.

- [ ] **Step 2: Add "View stats" tap target to `components/watchlist/summary-card.tsx`**

Add an `onViewStats: () => void` prop. Below the status-filter row (before the closing `</View>` of the card), add:

```tsx
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onViewStats();
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
            View statistics
          </Text>
          <IconSymbol name="chevron.right" size={12} color={colors.primary} />
        </TouchableOpacity>
```

Add imports: `IconSymbol` from `@/components/ui/icon-symbol`.

- [ ] **Step 3: Wire the callback in `app/(tabs)/watchlist.tsx`**

At the `<SummaryCard …>` usage add: `onViewStats={() => router.push("/stats")}` (the component already has `useRouter` — verify; if not, import it).

- [ ] **Step 4: Verify**

Run: `pnpm check` — 0 errors (typed routes must accept `/stats`).
Run: `pnpm lint` — no new errors.
Run: `pnpm test` — all pass.

- [ ] **Step 5: Update `todo.md`**

Append Phase 79 section:

```markdown
## Phase 79: Watchlist Statistics (v5.27)

- [x] Add pure stats module (movers, basket value, stock health, freshness)
- [x] Unit-test stats computations incl. edge cases
- [x] Build Movers/Basket/StockHealth/Freshness cards
- [x] Add Statistics screen (app/stats.tsx) with empty state
- [x] Wire "View statistics" entry from Watchlist summary card
```

- [ ] **Step 6: Commit and push**

```bash
git add app/stats.tsx components/stats components/watchlist/summary-card.tsx "app/(tabs)/watchlist.tsx" todo.md && git commit -m "feat: add watchlist statistics screen"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New pure module | `lib/watchlist-stats.ts` (~230 lines) |
| New tests | `tests/watchlist-stats.test.ts` (~9 cases) |
| New screen | `app/stats.tsx` |
| New components | 4 stat cards |
| Modified | summary-card (+tap target), watchlist.tsx (+callback) |
