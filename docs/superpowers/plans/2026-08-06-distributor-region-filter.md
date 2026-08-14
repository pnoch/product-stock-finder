# Distributor Region Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a distributor region filter to the Watchlist and Product Detail screens in both mobile (Expo) and desktop (Tauri) apps.

**Architecture:** A shared pure utility `lib/region-filter.ts` provides `getAllRegions()`, `productHasRegion()`, and `filterListingsByRegion()`. All four screens (mobile/desktop × watchlist/product-detail) import these helpers and render region filter chips. The utility uses `getDistributorById()` from `lib/distributors.ts`.

**Tech Stack:** TypeScript, Expo Router (mobile), React Router (desktop), existing distributor registry.

---

## File Structure

### New Files

- `lib/region-filter.ts` — shared region filter utility
- `tests/region-filter.test.ts` — unit tests

### Modified Files

- `app/(tabs)/watchlist.tsx` — add region filter chips
- `app/product/[id].tsx` — add region filter chips
- `desktop/src/pages/Watchlist.tsx` — add region filter chips
- `desktop/src/pages/ProductDetail.tsx` — add region filter chips

---

## Task 1: Create Shared Region Filter Utility

**Files:**

- Create: `lib/region-filter.ts`
- Test: `tests/region-filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/region-filter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getAllRegions,
  productHasRegion,
  filterListingsByRegion,
} from "@/lib/region-filter";
import { Product, DistributorListing } from "@/lib/types";

function makeListing(distributorId: string): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
  };
}

function makeProduct(listings: DistributorListing[]): Product {
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

describe("getAllRegions", () => {
  it("returns distinct regions from distributors", () => {
    const regions = getAllRegions();
    expect(regions).toContain("Europe");
    expect(regions).toContain("Asia-Pacific");
    expect(regions).toContain("North America");
    expect(regions).toContain("Africa");
    expect(regions).toContain("Middle East");
  });
});

describe("productHasRegion", () => {
  it("returns true when a listing's distributor is in the region", () => {
    const product = makeProduct([makeListing("server2u-my")]); // Asia-Pacific
    expect(productHasRegion(product, "Asia-Pacific")).toBe(true);
  });

  it("returns false when no listing's distributor is in the region", () => {
    const product = makeProduct([makeListing("server2u-my")]); // Asia-Pacific
    expect(productHasRegion(product, "Europe")).toBe(false);
  });

  it("returns false for unknown distributor", () => {
    const product = makeProduct([makeListing("unknown-dist")]);
    expect(productHasRegion(product, "Europe")).toBe(false);
  });
});

describe("filterListingsByRegion", () => {
  it("filters listings to the given region", () => {
    const listings = [
      makeListing("server2u-my"), // Asia-Pacific
      makeListing("linitx-uk"), // Europe
    ];
    const filtered = filterListingsByRegion(listings, "Europe");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].distributorId).toBe("linitx-uk");
  });

  it("excludes unknown distributors", () => {
    const listings = [makeListing("unknown-dist"), makeListing("linitx-uk")];
    const filtered = filterListingsByRegion(listings, "Europe");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].distributorId).toBe("linitx-uk");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/region-filter.test.ts`
Expected: FAIL with "Cannot find module '@/lib/region-filter'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/region-filter.ts`:

```typescript
import { DISTRIBUTORS, getDistributorById } from "./distributors";
import type { Product, DistributorListing } from "./types";

export function getAllRegions(): string[] {
  const regions = new Set<string>();
  for (const d of DISTRIBUTORS) {
    if (d.region) regions.add(d.region);
  }
  return Array.from(regions);
}

export function productHasRegion(product: Product, region: string): boolean {
  return (product.listings ?? []).some((listing) => {
    const distributor = getDistributorById(listing.distributorId);
    return distributor?.region === region;
  });
}

export function filterListingsByRegion(
  listings: DistributorListing[],
  region: string,
): DistributorListing[] {
  return listings.filter((listing) => {
    const distributor = getDistributorById(listing.distributorId);
    return distributor?.region === region;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/region-filter.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/region-filter.ts tests/region-filter.test.ts
git commit -m "feat: add region filter utility with tests"
```

---

## Task 2: Add Region Filter to Mobile Watchlist

**Files:**

- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `app/(tabs)/watchlist.tsx`:

```typescript
import { getAllRegions, productHasRegion } from "@/lib/region-filter";
```

- [ ] **Step 2: Add region state**

In the `WatchlistScreen` component, add state near the other useState calls:

```typescript
const [regionFilter, setRegionFilter] = useState<string>("all");
const regions = getAllRegions();
```

- [ ] **Step 3: Filter the watchlist**

After the `watchlist` state is loaded, add a filtered list. Find where `watchlist` is used for rendering (the FlatList `data` prop) and change it to use a filtered version. Add:

```typescript
const filteredWatchlist = useMemo(
  () =>
    regionFilter === "all"
      ? watchlist
      : watchlist.filter((p) => productHasRegion(p, regionFilter)),
  [watchlist, regionFilter],
);
```

Then use `filteredWatchlist` wherever `watchlist` was used for rendering (FlatList data, sort, summary). Note: the summary card should compute from `filteredWatchlist` too.

- [ ] **Step 4: Render the region filter chips**

Add a region filter chip row below the sort bar. Find the sort bar section and add after it:

```tsx
<View
  style={{
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  }}
>
  {["all", ...regions].map((region) => (
    <TouchableOpacity
      key={region}
      onPress={() => setRegionFilter(region)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor:
          regionFilter === region ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: regionFilter === region ? "#fff" : colors.foreground,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {region === "all" ? "All" : region}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

- [ ] **Step 5: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/watchlist.tsx
git commit -m "feat: add region filter to mobile watchlist"
```

---

## Task 3: Add Region Filter to Mobile Product Detail

**Files:**

- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `app/product/[id].tsx`:

```typescript
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
```

- [ ] **Step 2: Add region state**

In the `ProductDetailScreen` component, add state near the other useState calls (around line 392):

```typescript
const [regionFilter, setRegionFilter] = useState<string>("all");
const regions = getAllRegions();
```

- [ ] **Step 3: Filter the listings**

After `sortedListings` is defined (around line 594), add a filtered version:

```typescript
const visibleListings =
  regionFilter === "all"
    ? sortedListings
    : filterListingsByRegion(sortedListings, regionFilter);
```

Then change the render loop at line 1259 from `sortedListings.map` to `visibleListings.map`.

- [ ] **Step 4: Render the region filter chips**

Add a region filter chip row above the "ALL DISTRIBUTORS" label (around line 1256). Add before the `{bestInStockListing && (...)}` block:

```tsx
<View
  style={{ flexDirection: "row", marginBottom: 12, flexWrap: "wrap", gap: 8 }}
>
  {["all", ...regions].map((region) => (
    <TouchableOpacity
      key={region}
      onPress={() => setRegionFilter(region)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor:
          regionFilter === region ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: regionFilter === region ? "#fff" : colors.foreground,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {region === "all" ? "All" : region}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

- [ ] **Step 5: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 6: Commit**

```bash
git add app/product/[id].tsx
git commit -m "feat: add region filter to mobile product detail"
```

---

## Task 4: Add Region Filter to Desktop Watchlist

**Files:**

- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `desktop/src/pages/Watchlist.tsx`:

```typescript
import { getAllRegions, productHasRegion } from "../../../lib/region-filter";
```

- [ ] **Step 2: Add region state**

In the `Watchlist` component, add state:

```typescript
const [regionFilter, setRegionFilter] = useState<string>("all");
const regions = getAllRegions();
```

- [ ] **Step 3: Filter the products**

Add a filtered list:

```typescript
const filteredProducts = useMemo(
  () =>
    regionFilter === "all"
      ? products
      : products.filter((p) => productHasRegion(p, regionFilter)),
  [products, regionFilter],
);
```

Then use `filteredProducts` wherever `products` was used for rendering (the list map, the summary card). Note: the summary card should compute from `filteredProducts`.

- [ ] **Step 4: Render the region filter chips**

Add a region filter chip row. Find the filter row (the existing FILTER_OPTIONS row) and add the region chips after it:

```tsx
<div className="flex flex-wrap gap-2 mb-4">
  {["all", ...regions].map((region) => (
    <button
      key={region}
      onClick={() => setRegionFilter(region)}
      className={`px-3 py-1 rounded-full text-sm font-semibold border ${
        regionFilter === region
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-800 border-gray-300"
      }`}
    >
      {region === "all" ? "All" : region}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "feat: add region filter to desktop watchlist"
```

---

## Task 5: Add Region Filter to Desktop Product Detail

**Files:**

- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `desktop/src/pages/ProductDetail.tsx`:

```typescript
import {
  getAllRegions,
  filterListingsByRegion,
} from "../../../lib/region-filter";
```

- [ ] **Step 2: Add region state**

In the `ProductDetail` component, add state:

```typescript
const [regionFilter, setRegionFilter] = useState<string>("all");
const regions = getAllRegions();
```

- [ ] **Step 3: Filter the listings**

Find where `product.listings` is used for rendering the distributor list. Add a filtered version:

```typescript
const visibleListings =
  regionFilter === "all"
    ? product.listings
    : filterListingsByRegion(product.listings, regionFilter);
```

Then use `visibleListings` in the render loop that maps over listings.

- [ ] **Step 4: Render the region filter chips**

Add a region filter chip row above the distributor listings:

```tsx
<div className="flex flex-wrap gap-2 mb-4">
  {["all", ...regions].map((region) => (
    <button
      key={region}
      onClick={() => setRegionFilter(region)}
      className={`px-3 py-1 rounded-full text-sm font-semibold border ${
        regionFilter === region
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-800 border-gray-300"
      }`}
    >
      {region === "all" ? "All" : region}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "feat: add region filter to desktop product detail"
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

Add Phase 18 entry for the distributor region filter.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 18 distributor region filter to todo.md"
```
