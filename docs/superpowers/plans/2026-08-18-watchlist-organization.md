# Watchlist Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stock-status filtering, grouping, more sort modes, watchlist search, and bulk actions to the watchlist screen.

**Architecture:** Pure-function logic in a new `lib/watchlist-org.ts` (filter/sort/group/search + price-drop), fully unit-tested, then an inline enhancement of `app/(tabs)/watchlist.tsx`. View prefs (`watchlistSort`, `watchlistGroup`) persist in `AppSettings` and sync via the existing `settings` collection. Bulk tag-add uses a new storage helper `addTagsToProducts` and a new `BulkTagSheet` component.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.81 + Expo Router 6, NativeWind 4, vitest. Commands: `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm vitest run <file>`.

**Spec:** `docs/superpowers/specs/2026-08-18-watchlist-organization-design.md`

---

## File Map

- Modify: `lib/types.ts` — add `WatchlistSort` / `WatchlistGroup` types + two `AppSettings` fields.
- Modify: `lib/storage.ts` — `DEFAULT_SETTINGS` defaults + new `addTagsToProducts` storage function.
- Create: `lib/watchlist-org.ts` — filter/sort/group/search/price-drop pure functions.
- Create: `tests/watchlist-org.test.ts` — unit tests for the above.
- Create: `tests/storage-bulk-tags.test.ts` — unit test for `addTagsToProducts`.
- Create: `components/bulk-tag-sheet.tsx` — multi-select tag-add sheet.
- Modify: `app/(tabs)/watchlist.tsx` — wire filters/sort/group/search, grouped sections, bulk selection.
- Modify: `docs/superpowers/plans/` — this plan (no code).
- Modify: `todo.md` + `AGENTS.md` — Phase 55 notes (final task).

---

## Task 1: Types + settings defaults

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/storage.ts`

- [ ] **Step 1: Add the view-pref types to `lib/types.ts`**

Add after the `TagDefinition` interface (around line 19):

```ts
export type WatchlistSort =
  | "recent"
  | "best_price"
  | "az"
  | "price_drop"
  | "status"
  | "region";

export type WatchlistGroup = "off" | "tag" | "status" | "region";
```

Add two optional fields to `AppSettings` (after `tagDefinitions?`):

```ts
  tagDefinitions?: Record<string, TagDefinition>;
  watchlistSort?: WatchlistSort;
  watchlistGroup?: WatchlistGroup;
```

- [ ] **Step 2: Add defaults to `DEFAULT_SETTINGS` in `lib/storage.ts`**

In `lib/storage.ts` around line 83, after `webNotificationsEnabled: false,`:

```ts
    watchlistSort: "recent",
    watchlistGroup: "off",
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: 0 TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/storage.ts
git commit -m "feat: add watchlistSort/watchlistGroup view-pref types and defaults"
```

---

## Task 2: `addTagsToProducts` storage helper

**Files:**
- Modify: `lib/storage.ts`
- Create: `tests/storage-bulk-tags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/storage-bulk-tags.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Product } from "../lib/types";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

import {
  addTagsToProducts,
  getWatchlist,
  saveWatchlist,
} from "../lib/storage";

function makeProduct(id: string, tags?: string[]): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: `M-${id}`,
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
    tags,
  };
}

beforeEach(() => {
  store.clear();
});

describe("addTagsToProducts", () => {
  it("adds tags to the given products, deduping existing tags", async () => {
    await saveWatchlist([makeProduct("p1", ["t1"]), makeProduct("p2")]);

    await addTagsToProducts(["p1", "p2"], ["t1", "t2"]);

    const list = await getWatchlist();
    expect(list.find((p) => p.id === "p1")?.tags).toEqual(["t1", "t2"]);
    expect(list.find((p) => p.id === "p2")?.tags).toEqual(["t1", "t2"]);
  });

  it("leaves non-targeted products untouched", async () => {
    await saveWatchlist([makeProduct("p1"), makeProduct("p2")]);

    await addTagsToProducts(["p1"], ["t9"]);

    const list = await getWatchlist();
    expect(list.find((p) => p.id === "p1")?.tags).toEqual(["t9"]);
    expect(list.find((p) => p.id === "p2")?.tags).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/storage-bulk-tags.test.ts`
Expected: FAIL — `addTagsToProducts is not a function`.

- [ ] **Step 3: Implement `addTagsToProducts` in `lib/storage.ts`**

Add inside the `createStorage` factory, right after the `setProductTags` function (around line 277):

```ts
  async function addTagsToProducts(
    productIds: string[],
    tagIds: string[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const idSet = new Set(productIds);
      const updated = list.map((p) =>
        idSet.has(p.id)
          ? { ...p, tags: Array.from(new Set([...(p.tags ?? []), ...tagIds])) }
          : p,
      );
      await saveWatchlist(updated);
      for (const id of productIds) notify("watchlist", id);
    });
  }
```

Add `addTagsToProducts` to the returned object of `createStorage` (next to `setProductTags` in the return block around line 674) and to the named-exports destructure (around line 731, next to `setProductTags`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/storage-bulk-tags.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts tests/storage-bulk-tags.test.ts
git commit -m "feat: add addTagsToProducts bulk tag storage helper"
```

---

## Task 3: `lib/watchlist-org.ts` tests (TDD)

**Files:**
- Create: `tests/watchlist-org.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/watchlist-org.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  filterWatchlist,
  groupWatchlist,
  priceDropPercent,
  productRegion,
  productStatus,
  sortWatchlist,
  type WatchlistFilters,
} from "../lib/watchlist-org";
import type { DistributorListing, Product, TagDefinition } from "../lib/types";

function makeListing(
  distributorId: string,
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
  return {
    distributorId,
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

function makeProduct(
  overrides: Partial<Product> = {},
  listings: DistributorListing[] = [],
): Product {
  return {
    id: "p1",
    name: "Test Product",
    modelNumber: "TP-1",
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings,
    ...overrides,
  };
}

const defs: Record<string, TagDefinition> = {
  t1: { id: "t1", name: "Home", color: "#0F52BA" },
  t2: { id: "t2", name: "Lab", color: "#00C896" },
};

const baseFilters: WatchlistFilters = {
  region: "all",
  tagIds: [],
  status: "all",
  query: "",
};

describe("productStatus", () => {
  it("returns in_stock when any listing is in stock", () => {
    const p = makeProduct({}, [
      makeListing("d1", { stockStatus: "out_of_stock" }),
      makeListing("d2", { stockStatus: "in_stock" }),
    ]);
    expect(productStatus(p)).toBe("in_stock");
  });

  it("returns back_order when no listing is in stock but one is back-ordered", () => {
    const p = makeProduct({}, [
      makeListing("d1", { stockStatus: "out_of_stock" }),
      makeListing("d2", { stockStatus: "back_order" }),
    ]);
    expect(productStatus(p)).toBe("back_order");
  });

  it("returns out_of_stock when all listings are out of stock", () => {
    const p = makeProduct({}, [
      makeListing("d1", { stockStatus: "out_of_stock" }),
    ]);
    expect(productStatus(p)).toBe("out_of_stock");
  });

  it("returns unknown when there are no listings", () => {
    expect(productStatus(makeProduct({}))).toBe("unknown");
  });
});

describe("productRegion", () => {
  it("returns the first listing's distributor region", () => {
    const p = makeProduct({}, [makeListing("server2u-my")]);
    expect(productRegion(p)).toBe("Asia-Pacific");
  });

  it("returns Unknown when there are no listings", () => {
    expect(productRegion(makeProduct({}))).toBe("Unknown");
  });
});

describe("priceDropPercent", () => {
  it("returns null when there is no best in-stock price", () => {
    const p = makeProduct({}, [
      makeListing("d1", { price: 100, stockStatus: "out_of_stock" }),
    ]);
    expect(priceDropPercent(p)).toBeNull();
  });

  it("returns null when there is no price history", () => {
    const p = makeProduct({}, [makeListing("d1")]);
    expect(priceDropPercent(p)).toBeNull();
  });

  it("computes the all-time drop percentage", () => {
    const p = makeProduct({}, [
      makeListing("d1", {
        price: 80,
        stockStatus: "in_stock",
        priceHistory: [
          { date: "2026-01-01", price: 100, currency: "USD", stockStatus: "in_stock" },
          { date: "2026-01-15", price: 120, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ]);
    expect(priceDropPercent(p)).toBeCloseTo((120 - 80) / 120 * 100);
  });
});

describe("filterWatchlist", () => {
  const inStock = makeProduct(
    { id: "a", name: "Alpha", modelNumber: "A-1" },
    [makeListing("server2u-my", { stockStatus: "in_stock" })],
  );
  const backOrder = makeProduct(
    { id: "b", name: "Beta", modelNumber: "B-1" },
    [makeListing("server2u-my", { stockStatus: "back_order" })],
  );
  const tagged = makeProduct(
    { id: "c", name: "Gamma", modelNumber: "C-1", tags: ["t1"] },
    [makeListing("linitx-uk", { stockStatus: "out_of_stock" })],
  );

  it("matches query against name and model, case-insensitive", () => {
    const list = [inStock, backOrder, tagged];
    expect(filterWatchlist(list, { ...baseFilters, query: "ALPHA" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterWatchlist(list, { ...baseFilters, query: "c-1" }).map((p) => p.id)).toEqual(["c"]);
  });

  it("filters by region", () => {
    const list = [inStock, tagged];
    expect(filterWatchlist(list, { ...baseFilters, region: "Asia-Pacific" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterWatchlist(list, { ...baseFilters, region: "Europe" }).map((p) => p.id)).toEqual(["c"]);
  });

  it("filters by tag ids (OR)", () => {
    const list = [inStock, tagged];
    expect(filterWatchlist(list, { ...baseFilters, tagIds: ["t1"] }).map((p) => p.id)).toEqual(["c"]);
    expect(filterWatchlist(list, { ...baseFilters, tagIds: ["t1", "t2"] }).map((p) => p.id)).toEqual(["c"]);
  });

  it("filters by status", () => {
    const list = [inStock, backOrder, tagged];
    expect(filterWatchlist(list, { ...baseFilters, status: "in_stock" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterWatchlist(list, { ...baseFilters, status: "back_order" }).map((p) => p.id)).toEqual(["b"]);
  });

  it("combines filters with AND", () => {
    const list = [inStock, tagged];
    expect(
      filterWatchlist(list, { ...baseFilters, region: "Europe", tagIds: ["t1"] }).map((p) => p.id),
    ).toEqual(["c"]);
  });
});

describe("sortWatchlist", () => {
  const recent = makeProduct({ id: "a", addedAt: "2026-01-01" });
  const older = makeProduct({ id: "b", addedAt: "2025-01-01" });
  const cheap = makeProduct({ id: "c" }, [makeListing("d1", { price: 50 })]);
  const pricey = makeProduct({ id: "d" }, [makeListing("d1", { price: 200 })]);

  it("sorts by recent addedAt desc", () => {
    expect(sortWatchlist([older, recent], "recent").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("sorts by best price asc", () => {
    expect(sortWatchlist([pricey, cheap], "best_price").map((p) => p.id)).toEqual(["c", "d"]);
  });

  it("sorts alphabetically", () => {
    expect(sortWatchlist([older, recent], "az").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("sorts by price drop desc with nulls last", () => {
    const dropped = makeProduct({ id: "x" }, [
      makeListing("d1", {
        price: 50,
        priceHistory: [
          { date: "2026-01-01", price: 100, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ]);
    const noHistory = makeProduct({ id: "y" }, [makeListing("d1", { price: 50 })]);
    expect(sortWatchlist([noHistory, dropped], "price_drop").map((p) => p.id)).toEqual(["x", "y"]);
  });

  it("sorts by status precedence", () => {
    const inStock = makeProduct({ id: "a" }, [makeListing("d1", { stockStatus: "in_stock" })]);
    const out = makeProduct({ id: "b" }, [makeListing("d1", { stockStatus: "out_of_stock" })]);
    const back = makeProduct({ id: "c" }, [makeListing("d1", { stockStatus: "back_order" })]);
    expect(sortWatchlist([out, inStock, back], "status").map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by region alphabetically", () => {
    const eu = makeProduct({ id: "a" }, [makeListing("linitx-uk")]);
    const apac = makeProduct({ id: "b" }, [makeListing("server2u-my")]);
    expect(sortWatchlist([eu, apac], "region").map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("groupWatchlist", () => {
  const inStock = makeProduct({ id: "a" }, [makeListing("server2u-my", { stockStatus: "in_stock" })]);
  const backOrder = makeProduct({ id: "b" }, [makeListing("server2u-my", { stockStatus: "back_order" })]);
  const tagged = makeProduct({ id: "c", tags: ["t1", "t2"] });
  const untagged = makeProduct({ id: "d" });

  it("returns a single flat section for off", () => {
    const sections = groupWatchlist([inStock, tagged], "off", defs);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("all");
    expect(sections[0].products.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("returns empty when the list is empty", () => {
    expect(groupWatchlist([], "off", defs)).toEqual([]);
  });

  it("groups by tag with an untagged section at the end", () => {
    const sections = groupWatchlist([untagged, tagged], "tag", defs);
    expect(sections.map((s) => s.key)).toEqual(["tag-t1", "tag-t2", "untagged"]);
    expect(sections[0].products.map((p) => p.id)).toEqual(["c"]);
    expect(sections[2].products.map((p) => p.id)).toEqual(["d"]);
  });

  it("groups by status, omitting empty sections", () => {
    const sections = groupWatchlist([inStock, backOrder], "status", defs);
    expect(sections.map((s) => s.key)).toEqual(["status-in_stock", "status-back_order"]);
  });

  it("groups by region alphabetically", () => {
    const apac = makeProduct({ id: "a" }, [makeListing("server2u-my")]);
    const eu = makeProduct({ id: "b" }, [makeListing("linitx-uk")]);
    const sections = groupWatchlist([eu, apac], "region", defs);
    expect(sections.map((s) => s.key)).toEqual(["region-Asia-Pacific", "region-Europe"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/watchlist-org.test.ts`
Expected: FAIL — module `../lib/watchlist-org` not found.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/watchlist-org.test.ts
git commit -m "test: watchlist-org filter/sort/group/price-drop tests (failing)"
```

---

## Task 4: `lib/watchlist-org.ts` implementation

**Files:**
- Create: `lib/watchlist-org.ts`

- [ ] **Step 1: Implement the module**

Create `lib/watchlist-org.ts`:

```ts
import type {
  Product,
  StockStatus,
  TagDefinition,
  WatchlistGroup,
  WatchlistSort,
} from "./types";
import { convertPrice, getBestPrice } from "./currency";
import { getDistributorById } from "./distributors";
import { productHasRegion } from "./region-filter";
import { matchesTagFilter } from "./tags";

export type { WatchlistGroup, WatchlistSort };

export type StatusFilter = "all" | StockStatus;

export interface WatchlistFilters {
  region: string;
  tagIds: string[];
  status: StatusFilter;
  query: string;
}

export interface WatchlistSection {
  key: string;
  title: string;
  products: Product[];
}

export const SORT_OPTIONS: { key: WatchlistSort; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "best_price", label: "Best Price" },
  { key: "az", label: "A–Z" },
  { key: "price_drop", label: "Price Drop" },
  { key: "status", label: "Status" },
  { key: "region", label: "Region" },
];

export const GROUP_OPTIONS: { key: WatchlistGroup; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "tag", label: "Tag" },
  { key: "status", label: "Status" },
  { key: "region", label: "Region" },
];

export const STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "In Stock",
  back_order: "Back Order",
  out_of_stock: "Out of Stock",
  unknown: "Unknown",
};

const STATUS_ORDER: StockStatus[] = [
  "in_stock",
  "back_order",
  "out_of_stock",
  "unknown",
];

export function productStatus(product: Product): StockStatus {
  const listings = product.listings ?? [];
  if (listings.some((l) => l.stockStatus === "in_stock")) return "in_stock";
  if (listings.some((l) => l.stockStatus === "back_order")) return "back_order";
  if (listings.some((l) => l.stockStatus === "out_of_stock"))
    return "out_of_stock";
  return "unknown";
}

export function productRegion(product: Product): string {
  const first = (product.listings ?? [])[0];
  if (!first) return "Unknown";
  return getDistributorById(first.distributorId)?.region ?? "Unknown";
}

export function priceDropPercent(product: Product): number | null {
  const best = getBestPrice(product.listings ?? [], "USD");
  if (!best || best.price <= 0) return null;
  const history = (product.listings ?? []).flatMap((l) => l.priceHistory ?? []);
  let max = 0;
  for (const point of history) {
    const usd = convertPrice(point.price, point.currency, "USD");
    if (usd > max) max = usd;
  }
  if (max <= 0) return null;
  return ((max - best.price) / max) * 100;
}

export function filterWatchlist(
  list: Product[],
  filters: WatchlistFilters,
): Product[] {
  const q = filters.query.trim().toLowerCase();
  return list.filter((p) => {
    if (filters.region !== "all" && !productHasRegion(p, filters.region))
      return false;
    if (!matchesTagFilter(p, filters.tagIds)) return false;
    if (filters.status !== "all" && productStatus(p) !== filters.status)
      return false;
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.modelNumber.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

export function sortWatchlist(
  list: Product[],
  sort: WatchlistSort,
): Product[] {
  const copy = [...list];
  switch (sort) {
    case "recent":
      return copy.sort(
        (a, b) =>
          new Date(b.addedAt ?? 0).getTime() -
          new Date(a.addedAt ?? 0).getTime(),
      );
    case "az":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "best_price":
      return copy.sort((a, b) => {
        const pa = getBestPrice(a.listings ?? [], "USD")?.price ?? Infinity;
        const pb = getBestPrice(b.listings ?? [], "USD")?.price ?? Infinity;
        return pa - pb;
      });
    case "price_drop":
      return copy.sort((a, b) => {
        const da = priceDropPercent(a) ?? -Infinity;
        const db = priceDropPercent(b) ?? -Infinity;
        return db - da;
      });
    case "status":
      return copy.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(productStatus(a)) -
          STATUS_ORDER.indexOf(productStatus(b)),
      );
    case "region":
      return copy.sort((a, b) => productRegion(a).localeCompare(productRegion(b)));
    default:
      return copy;
  }
}

export function groupWatchlist(
  list: Product[],
  group: WatchlistGroup,
  tagDefinitions: Record<string, TagDefinition>,
): WatchlistSection[] {
  if (list.length === 0) return [];
  if (group === "off") return [{ key: "all", title: "All", products: list }];
  if (group === "tag") {
    const sections: WatchlistSection[] = Object.values(tagDefinitions).map(
      (tag) => ({
        key: `tag-${tag.id}`,
        title: tag.name,
        products: list.filter((p) => (p.tags ?? []).includes(tag.id)),
      }),
    );
    const untagged = list.filter((p) => (p.tags ?? []).length === 0);
    if (untagged.length > 0)
      sections.push({ key: "untagged", title: "Untagged", products: untagged });
    return sections.filter((s) => s.products.length > 0);
  }
  if (group === "status") {
    return STATUS_ORDER.map((status) => ({
      key: `status-${status}`,
      title: STATUS_LABELS[status],
      products: list.filter((p) => productStatus(p) === status),
    })).filter((s) => s.products.length > 0);
  }
  const regions = Array.from(new Set(list.map(productRegion))).sort();
  return regions.map((region) => ({
    key: `region-${region}`,
    title: region,
    products: list.filter((p) => productRegion(p) === region),
  }));
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `pnpm vitest run tests/watchlist-org.test.ts`
Expected: PASS (all tests).

- [ ] **Step 3: Verify + lint**

Run: `pnpm check` then `pnpm lint`
Expected: 0 TypeScript errors, lint clean.

- [ ] **Step 4: Commit**

```bash
git add lib/watchlist-org.ts tests/watchlist-org.test.ts
git commit -m "feat: watchlist-org filter/sort/group/search logic"
```

---

## Task 5: Watchlist screen — state, search, sort dropdown, group chips, tappable summary

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Update imports and remove the local sort helpers**

Replace the import block at the top of `app/(tabs)/watchlist.tsx` (lines 1-34) so it becomes:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLiveWatchlist } from "@/hooks/use-live-prices";
import {
  getSettings,
  saveSettings,
  getTagDefinitions,
  removeFromWatchlist,
} from "@/lib/storage";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { Product, TagDefinition, WatchlistGroup, WatchlistSort } from "@/lib/types";
import { formatPrice, getBestPrice, convertPrice } from "@/lib/currency";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { checkPriceDropsNow } from "@/lib/background-price-check";
import { getAllRegions, productHasRegion } from "@/lib/region-filter";
import { getTagById, matchesTagFilter } from "@/lib/tags";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { TagManageSheet } from "@/components/tag-manage-sheet";
import { BulkTagSheet } from "@/components/bulk-tag-sheet";
import { fetchProductImage } from "@/lib/server-images";
import {
  filterWatchlist,
  groupWatchlist,
  productStatus,
  sortWatchlist,
  GROUP_OPTIONS,
  SORT_OPTIONS,
  type StatusFilter,
} from "@/lib/watchlist-org";
```

Delete the local `SortMode` type, `SORT_OPTIONS` const, and `sortWatchlist` function (lines 36-63).

- [ ] **Step 2: Update the `ProductCard` component**

Replace `const bestStatus =` block inside `ProductCard` (lines 116-121) with:

```tsx
  const bestStatus = productStatus(product);
```

Add `onLongPress` and selection props to the `ProductCard` signature (lines 102-114):

```tsx
function ProductCard({
  product,
  onPress,
  onDelete,
  onTagPress,
  tagDefinitions,
  selectionMode = false,
  selected = false,
  onLongPress,
}: {
  product: Product;
  onPress: () => void;
  onDelete: () => void;
  onTagPress: () => void;
  tagDefinitions: Record<string, TagDefinition>;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
}) {
```

Update the card's outer `TouchableOpacity` (lines 139-149) to:

```tsx
    <TouchableOpacity
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: selectionMode ? 2 : 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
```

Add a selection checkmark as the first child of the top row (before the `{imageUrl && (` block at line 157):

```tsx
        {selectionMode && (
          <View
            style={{
              width: 26,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <IconSymbol
              name={selected ? "checkmark.circle.fill" : "circle.fill"}
              size={22}
              color={selected ? colors.primary : colors.muted}
            />
          </View>
        )}
```

- [ ] **Step 3: Replace the screen state + filtering pipeline**

Replace the state block (lines 344-358) with:

```tsx
  const [sortMode, setSortMode] = useState<WatchlistSort>("recent");
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [tagDefinitions, setTagDefinitions] = useState<
    Record<string, TagDefinition>
  >({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [manageVisible, setManageVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagVisible, setBulkTagVisible] = useState(false);
  const regions = useMemo(() => getAllRegions(), []);
```

Replace `loadData` (lines 360-366) with:

```tsx
  const loadData = useCallback(async () => {
    const settings = await getSettings();
    setDisplayCurrency(settings?.displayCurrency ?? "USD");
    setSortMode(settings?.watchlistSort ?? "recent");
    setGroupMode(settings?.watchlistGroup ?? "off");
    const defs = await getTagDefinitions();
    setTagDefinitions(defs);
    setSelectedTagIds((prev) => prev.filter((id) => id in defs));
  }, []);
```

Replace the `filteredWatchlist` memo (lines 375-383) with:

```tsx
  const filteredWatchlist = useMemo(
    () =>
      filterWatchlist(watchlist, {
        region: regionFilter,
        tagIds: selectedTagIds,
        status: statusFilter,
        query,
      }),
    [watchlist, regionFilter, selectedTagIds, statusFilter, query],
  );

  const sections = useMemo(
    () => groupWatchlist(sortWatchlist(filteredWatchlist, sortMode), groupMode, tagDefinitions),
    [filteredWatchlist, sortMode, groupMode, tagDefinitions],
  );
```

Replace the `summary` memo (lines 385-388) with (full watchlist, per spec):

```tsx
  const summary = useMemo(
    () => computeWatchlistSummary(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );
```

- [ ] **Step 4: Add selection + bulk handlers**

Add after `toggleTagFilter` (line 396):

```tsx
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    const doRemove = async () => {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      for (const id of ids) await removeFromWatchlist(id);
      await reload();
      exitSelection();
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
        )
      ) {
        void doRemove();
      }
      return;
    }
    Alert.alert(
      "Remove Products",
      `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ],
    );
  }, [selectedIds, reload, exitSelection]);

  const handleBulkTagChanged = useCallback(() => {
    void reload();
    void loadData();
    exitSelection();
  }, [reload, loadData, exitSelection]);
```

- [ ] **Step 5: Persist sort/group on change**

Add after `handleCheckNow` (line 446):

```tsx
  const persistViewPrefs = useCallback(
    async (sort: WatchlistSort, group: WatchlistGroup) => {
      const settings = await getSettings();
      await saveSettings({ ...settings, watchlistSort: sort, watchlistGroup: group });
    },
    [],
  );
```

Add `saveSettings` to the storage import in Step 1 (already included above).

- [ ] **Step 6: Swap the header for selection mode**

Wrap the existing header (lines 462-583) so that when `selectionMode` is true the header shows the selection toolbar instead. Replace the opening of the header block:

```tsx
  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
          <Text className="text-muted text-sm">
            {filteredWatchlist.length} product
            {filteredWatchlist.length !== 1 ? "s" : ""} tracked
          </Text>
        </View>
```

with:

```tsx
  return (
    <ScreenContainer>
      {selectionMode ? (
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              {selectedIds.size} Selected
            </Text>
            <Text className="text-muted text-sm">Tap products to select</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={handleBulkDelete}
              style={{
                backgroundColor: colors.error,
                borderRadius: 20,
                paddingHorizontal: 14,
                height: 40,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconSymbol name="trash.fill" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                Delete
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBulkTagVisible(true)}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 20,
                paddingHorizontal: 14,
                height: 40,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconSymbol name="tag.fill" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                Tag
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exitSelection}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <IconSymbol name="xmark" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
            <Text className="text-muted text-sm">
              {filteredWatchlist.length} product
              {filteredWatchlist.length !== 1 ? "s" : ""} tracked
            </Text>
          </View>
```

Then close the ternary after the existing header's closing `</View>` (the one right before the `{watchlist.length > 0 && (` summary card block at line 585) by adding `)}`:

```tsx
        </View>
      )}
```

- [ ] **Step 7: Make the summary counts tappable + add the search bar**

Replace the summary-card stat columns block (lines 617-670, the `flexDirection: "row", marginTop: 12, gap: 12` View) with:

```tsx
          <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
            {(
              [
                { key: "in_stock", label: "In Stock", value: summary.inStock, color: colors.success },
                { key: "back_order", label: "Back Order", value: summary.backOrder, color: colors.warning },
                { key: "out_of_stock", label: "Out of Stock", value: summary.outOfStock, color: colors.error },
              ] as const
            ).map((col) => (
              <TouchableOpacity
                key={col.key}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatusFilter((prev) => (prev === col.key ? "all" : col.key));
                }}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 4,
                  paddingHorizontal: 6,
                  backgroundColor:
                    statusFilter === col.key ? col.color + "22" : "transparent",
                }}
              >
                <Text
                  style={{ color: col.color, fontSize: 16, fontWeight: "600" }}
                >
                  {col.value}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {col.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}
              >
                {summary.listingCount}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Listings</Text>
            </View>
          </View>
```

Insert the search bar right after the summary card's closing `</View>` (after line 671, before the `{checking && checkProgress && (` block):

```tsx
      {watchlist.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 16,
            marginBottom: 10,
            paddingHorizontal: 12,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search watchlist..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, marginLeft: 8, color: colors.foreground, fontSize: 14 }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} style={{ padding: 4 }}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}
```

- [ ] **Step 8: Replace the sort bar with sort dropdown + group chips**

Replace the entire "Sort Bar" block (lines 689-730) with:

```tsx
      {watchlist.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 10,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSortMenuOpen((v) => !v);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>
              Sort: {SORT_OPTIONS.find((o) => o.key === sortMode)?.label}
            </Text>
            <IconSymbol name="chevron.down" size={12} color={colors.muted} />
          </TouchableOpacity>
          {GROUP_OPTIONS.map((opt) => {
            const active = groupMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setGroupMode(opt.key);
                  void persistViewPrefs(sortMode, opt.key);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.muted,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {sortMenuOpen && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 10,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSortMode(opt.key);
                  setSortMenuOpen(false);
                  void persistViewPrefs(opt.key, groupMode);
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: active ? colors.primary + "18" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.foreground,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
```

- [ ] **Step 9: Verify**

Run: `pnpm check` then `pnpm lint`
Expected: 0 TypeScript errors, lint clean.

- [ ] **Step 10: Commit**

```bash
git add app/\(tabs\)/watchlist.tsx
git commit -m "feat: watchlist search, sort dropdown, group chips, tappable status summary"
```

---

## Task 6: Watchlist screen — grouped sections + empty state

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Switch the list to `SectionList`**

Replace the `FlatList` import with `SectionList` in the react-native import block (Step 1 of Task 5 added `FlatList`; change it):

```tsx
import {
  SectionList,
  Image,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
```

Replace the entire `FlatList` block (lines 829-927) with:

```tsx
      <SectionList
        sections={sections.map((s) => ({ ...s, data: s.products }))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingAny}
            onRefresh={refreshAll}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 80,
            }}
          >
            <IconSymbol name="list.bullet" size={48} color={colors.muted} />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 18,
                marginTop: 16,
              }}
            >
              {regionFilter !== "all" ||
              selectedTagIds.length > 0 ||
              statusFilter !== "all" ||
              query.trim().length > 0
                ? "No products match your filters"
                : "No products yet"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              {regionFilter !== "all" ||
              selectedTagIds.length > 0 ||
              statusFilter !== "all" ||
              query.trim().length > 0
                ? "Try clearing your filters or adding products"
                : "Add products to track their availability and prices globally"}
            </Text>
            {regionFilter !== "all" ||
            selectedTagIds.length > 0 ||
            statusFilter !== "all" ||
            query.trim().length > 0 ? (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => {
                  setRegionFilter("all");
                  setSelectedTagIds([]);
                  setStatusFilter("all");
                  setQuery("");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Clear Filters
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/search");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Add Product
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => {
          if (groupMode === "off") return null;
          const tag =
            groupMode === "tag"
              ? Object.values(tagDefinitions).find(
                  (t) => t.name === section.title,
                )
              : undefined;
          return (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 8,
                backgroundColor: colors.background,
              }}
            >
              {tag && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: tag.color,
                  }}
                />
              )}
              <Text
                style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}
              >
                {section.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                · {section.products.length}
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onPress={() => {
              if (selectionMode) {
                toggleSelection(item.id);
              } else {
                router.push(`/product/${item.id}`);
              }
            }}
            onLongPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectionMode(true);
              setSelectedIds(new Set([item.id]));
            }}
            onDelete={() => handleDelete(item.id, item.name)}
            onTagPress={() => setPickerProduct(item)}
            tagDefinitions={tagDefinitions}
          />
        )}
      />
```

- [ ] **Step 2: Add the `BulkTagSheet` to the render**

Add after the `TagManageSheet` (line 937-944):

```tsx
      <BulkTagSheet
        visible={bulkTagVisible}
        productIds={Array.from(selectedIds)}
        tagDefinitions={tagDefinitions}
        onClose={() => setBulkTagVisible(false)}
        onChanged={handleBulkTagChanged}
      />
```

- [ ] **Step 3: Verify**

Run: `pnpm check` then `pnpm lint`
Expected: 0 TypeScript errors, lint clean.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/watchlist.tsx
git commit -m "feat: watchlist grouped sections and bulk selection UI"
```

---

## Task 7: `BulkTagSheet` component

**Files:**
- Create: `components/bulk-tag-sheet.tsx`

- [ ] **Step 1: Implement the component**

Create `components/bulk-tag-sheet.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { addTagsToProducts, createTag, getTagDefinitions } from "@/lib/storage";
import { nextTagColor } from "@/lib/tags";
import { TagDefinition } from "@/lib/types";

interface Props {
  visible: boolean;
  productIds: string[];
  tagDefinitions: Record<string, TagDefinition>;
  onClose: () => void;
  onChanged: () => void;
}

export function BulkTagSheet({
  visible,
  productIds,
  tagDefinitions,
  onClose,
  onChanged,
}: Props) {
  const colors = useColors();
  const [defs, setDefs] = useState<Record<string, TagDefinition>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void getTagDefinitions()
      .then(setDefs)
      .catch(() => {});
    setSelected([]);
    setNewTagName("");
    setError(null);
  }, [visible]);

  const toggleTag = (tagId: string) => {
    setSelected((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleApply = async () => {
    if (selected.length === 0 || productIds.length === 0) return;
    try {
      await addTagsToProducts(productIds, selected);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply tags");
    }
  };

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const current = await getTagDefinitions();
      const tag = await createTag(name, nextTagColor(current));
      setDefs({ ...current, [tag.id]: tag });
      setSelected((prev) => [...prev, tag.id]);
      setNewTagName("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tag");
    }
  };

  const tags = Object.values(defs);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "70%",
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Add Tags
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}
          >
            Apply to {productIds.length} product
            {productIds.length !== 1 ? "s" : ""}
          </Text>
          <ScrollView style={{ maxHeight: 260 }}>
            {tags.length === 0 && (
              <Text
                style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}
              >
                No tags yet — create one below.
              </Text>
            )}
            {tags.map((tag) => {
              const active = selected.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      borderWidth: 2,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.primary : colors.surface,
                      marginRight: 10,
                    }}
                  >
                    {active && (
                      <IconSymbol name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: tag.color,
                      marginRight: 8,
                    }}
                  />
                  <Text style={{ color: colors.foreground, fontSize: 15 }}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="New tag name"
              placeholderTextColor={colors.muted}
              maxLength={24}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: colors.foreground,
                fontSize: 15,
              }}
            />
            {error && (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>
                {error}
              </Text>
            )}
            <TouchableOpacity
              onPress={() => void handleCreate()}
              disabled={!newTagName.trim()}
              style={{
                marginTop: 8,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                opacity: newTagName.trim() ? 1 : 0.5,
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                Create tag
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleApply()}
              disabled={selected.length === 0}
              style={{
                marginTop: 8,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                opacity: selected.length === 0 ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Add {selected.length > 0 ? `${selected.length} tag${selected.length !== 1 ? "s" : ""} ` : ""}to selected
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm check` then `pnpm lint`
Expected: 0 TypeScript errors, lint clean.

- [ ] **Step 3: Commit**

```bash
git add components/bulk-tag-sheet.tsx
git commit -m "feat: bulk tag sheet for multi-product tag-add"
```

---

## Task 8: Final verification + docs

**Files:**
- Modify: `todo.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Run the full verification suite**

Run: `pnpm check`
Expected: 0 TypeScript errors.

Run: `pnpm lint`
Expected: clean.

Run: `pnpm test`
Expected: all pass (existing 710 + new watchlist-org + storage-bulk-tags tests).

- [ ] **Step 2: Browser smoke test**

With the DB-backed server + HTTPS static server running (see `/tmp/opencode/webpush/run-server-db.sh` and `https-static.cjs`), load the app in headed Chromium and verify:
1. Watchlist shows the search bar, Sort button, and group chips (Off/Tag/Status/Region).
2. Tapping a summary count filters to that status; tapping again clears.
3. Sort menu shows all six modes; selecting "Price Drop" reorders the list.
4. Group "Tag" shows tag sections + Untagged; group "Status" shows status sections; group "Region" shows region sections.
5. Typing in search narrows the list.
6. Long-press a card enters selection mode; Delete confirms and removes; Tag opens the bulk sheet and applies tags.
7. Reload the page — sort/group prefs persist; filters/search reset.

- [ ] **Step 3: Update `todo.md`**

Append a Phase 55 section:

```markdown
## Phase 55: Watchlist Organization (v5.3)

- [x] lib/watchlist-org.ts: productStatus/productRegion/priceDropPercent, filterWatchlist (region+tag+status+query AND), sortWatchlist (6 modes), groupWatchlist (off/tag/status/region with untagged + multi-tag duplication)
- [x] Tappable summary counts filter by stock status; search bar matches name+model; Sort dropdown + group chips
- [x] Grouped section headers (tag color dot, status, region) above the list
- [x] Long-press bulk selection: delete (confirm) + add-tags via BulkTagSheet (addTagsToProducts storage helper)
- [x] watchlistSort/watchlistGroup persisted in AppSettings and synced via settings collection
- [x] Tests: watchlist-org unit tests + addTagsToProducts storage test
```

- [ ] **Step 4: Update `AGENTS.md`**

In the `lib/` directory listing, add a line for `watchlist-org.ts`:

```
  watchlist-summary.ts, last-refreshed.ts
```
becomes
```
  watchlist-summary.ts, watchlist-org.ts, last-refreshed.ts
```

- [ ] **Step 5: Commit**

```bash
git add todo.md AGENTS.md
git commit -m "docs: Phase 55 watchlist organization (v5.3) in todo.md and AGENTS.md"
```

---

## Self-Review Notes

- **Spec coverage:** status filter (Task 5 Step 7 + Task 6), grouping (Task 5 Step 8 + Task 6 Step 1), more sort modes (Task 4 + Task 5 Step 8), search (Task 5 Step 7), bulk actions (Task 5 Steps 4-6 + Task 7), persistence (Task 1 + Task 5 Steps 3/5/8), testing (Tasks 2-4, 8).
- **Type consistency:** `WatchlistSort` / `WatchlistGroup` defined in `lib/types.ts` (Task 1), re-exported from `lib/watchlist-org.ts` (Task 4), used by the screen (Task 5). `StatusFilter`, `WatchlistFilters`, `WatchlistSection`, `SORT_OPTIONS`, `GROUP_OPTIONS` all defined in `lib/watchlist-org.ts` and imported by the screen.
- **Icon names used:** `magnifyingglass`, `xmark.circle.fill`, `chevron.down`, `checkmark.circle.fill`, `circle.fill`, `trash.fill`, `tag.fill`, `xmark`, `checkmark` — all already mapped in `components/ui/icon-symbol.tsx`.
- **Distributor ids used in tests:** `server2u-my` (Asia-Pacific) and `linitx-uk` (Europe) — both exist in `lib/distributors.ts`.