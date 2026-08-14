# Tax-Inclusive Landed Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tax to the landed-cost calculation so the app shows the true "best price globally" (price + tax + shipping to the user's location), across the Best Deal card, distributor listings table, and distributor analysis screen.

**Architecture:** A shared `lib/tax.ts` module provides a country→tax-rate map and `getTaxRate(country)`. Scrapers set `taxRate` on each listing from the country map. `findBestDeal` and `analyzeDistributors` include tax in their totals. All three screens display the tax breakdown.

**Tech Stack:** TypeScript, Expo Router (mobile), React Router (desktop), existing currency + best-deal + analysis utilities.

---

## File Structure

### New Files

- `lib/tax.ts` — shared tax module
- `tests/tax.test.ts` — unit tests

### Modified Files

- `lib/types.ts` — add `taxRate` to `DistributorListing`
- `lib/scrapers/types.ts` — add `taxRate` to `ScrapeResult`
- 25 scraper files — set `taxRate` from country map
- `lib/best-deal.ts` — include tax in total, add `tax` to `BestDeal`
- `lib/distributor-analysis.ts` — include tax in totalCost
- `app/product/[id].tsx` — Best Deal card + listings table show tax
- `desktop/src/pages/ProductDetail.tsx` — Best Deal card + listings table show tax
- `app/distributor-analysis.tsx` — show tax-inclusive total
- `desktop/src/pages/DistributorAnalysis.tsx` — show tax-inclusive total

---

## Task 1: Create Shared Tax Module

**Files:**

- Create: `lib/tax.ts`
- Test: `tests/tax.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tax.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getTaxRate } from "@/lib/tax";

describe("getTaxRate", () => {
  it("returns the tax rate for a known country", () => {
    expect(getTaxRate("United Kingdom")).toBeCloseTo(0.2, 2);
    expect(getTaxRate("Germany")).toBeCloseTo(0.19, 2);
    expect(getTaxRate("Australia")).toBeCloseTo(0.1, 2);
  });

  it("returns 0 for tax-free countries", () => {
    expect(getTaxRate("Malaysia")).toBe(0);
    expect(getTaxRate("United States")).toBe(0);
  });

  it("returns 0 for unknown countries", () => {
    expect(getTaxRate("Atlantis")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tax.test.ts`
Expected: FAIL with "Cannot find module '@/lib/tax'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/tax.ts`:

```typescript
export const COUNTRY_TAX_RATES: Record<string, number> = {
  Australia: 0.1,
  Canada: 0.13,
  "Czech Republic": 0.21,
  "European Union": 0.2,
  Germany: 0.19,
  Greece: 0.24,
  Malaysia: 0,
  "New Zealand": 0.15,
  Poland: 0.23,
  "South Africa": 0.15,
  UAE: 0,
  "United Kingdom": 0.2,
  "United States": 0,
};

export function getTaxRate(country: string): number {
  return COUNTRY_TAX_RATES[country] ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/tax.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tax.ts tests/tax.test.ts
git commit -m "feat: add shared tax module with country tax rates"
```

---

## Task 2: Add taxRate to Types

**Files:**

- Modify: `lib/types.ts`
- Modify: `lib/scrapers/types.ts`

- [ ] **Step 1: Add taxRate to DistributorListing**

In `lib/types.ts`, add `taxRate` to the `DistributorListing` interface (after `priceHistory`):

```typescript
export interface DistributorListing {
  distributorId: string;
  productId: string;
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string;
  url: string;
  lastChecked: string;
  priceHistory: PricePoint[];
  taxRate?: number; // set by scraper from country map
}
```

- [ ] **Step 2: Add taxRate to ScrapeResult**

In `lib/scrapers/types.ts`, add `taxRate` to the `ScrapeResult` interface:

```typescript
export interface ScrapeResult {
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string;
  url: string;
  taxRate?: number; // set by scraper from country map
}
```

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/scrapers/types.ts
git commit -m "feat: add taxRate to DistributorListing and ScrapeResult"
```

---

## Task 3: Set taxRate in Scrapers

**Files:**

- Modify: 25 scraper files in `lib/scrapers/`

- [ ] **Step 1: Update each scraper to set taxRate**

For each of the 25 scraper files in `lib/scrapers/`, update the `parseHtml` function to set `taxRate` from the country map. The country for each distributor is:

- server2u (MY): Malaysia → 0
- linitx (UK): United Kingdom → 0.2
- interprojekt (PL): Poland → 0.23
- nasstore (EU): European Union → 0.2
- aerial (GR): Greece → 0.24
- mikrotikstore (DE): Germany → 0.19
- miro (ZA): South Africa → 0.15
- gearup (AE): UAE → 0
- balticnetworks (US): United States → 0
- linktechs (US): United States → 0
- winncom (US): United States → 0
- bhphoto (US): United States → 0
- duxtel (AU): Australia → 0.1
- wisp (AU): Australia → 0.1
- pbtech (NZ): New Zealand → 0.15
- gowifi (NZ): New Zealand → 0.15
- getic (GR): Greece → 0.24
- mega (CZ): Czech Republic → 0.21
- hellascom (GR): Greece → 0.24
- rocnoc (US): United States → 0
- networkdevices (US): United States → 0
- flytec (US): United States → 0
- mbsiwav (CA): Canada → 0.13
- multilink (US): United States → 0
- neobits (US): United States → 0

For each scraper, add `taxRate` to the returned `ScrapeResult` object. Example for `server2u.ts`:

```typescript
import { getTaxRate } from "../tax";

return {
  price,
  currency: "MYR",
  stockStatus,
  url,
  taxRate: getTaxRate("Malaysia"),
};
```

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Run scraper tests to verify nothing broke**

Run: `pnpm test tests/scrapers/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/scrapers/
git commit -m "feat: set taxRate in all scrapers from country map"
```

---

## Task 4: Update Best Deal to Include Tax

**Files:**

- Modify: `lib/best-deal.ts`
- Modify: `tests/best-deal.test.ts`

- [ ] **Step 1: Add tax test**

Append to `tests/best-deal.test.ts`:

```typescript
it("includes tax in the total landed cost", () => {
  const listings = [
    makeListing({
      distributorId: "server2u-my",
      price: 100,
      currency: "USD",
      taxRate: 0.2,
    }),
  ];
  const deal = findBestDeal(listings, "Asia-Pacific", "USD");
  expect(deal).not.toBeNull();
  expect(deal!.tax).toBeCloseTo(20, 2); // 100 * 0.2
  expect(deal!.total).toBeCloseTo(deal!.price + deal!.tax + deal!.shipping, 2);
});

it("treats missing taxRate as tax-free", () => {
  const listings = [
    makeListing({ distributorId: "server2u-my", price: 100, currency: "USD" }),
  ];
  const deal = findBestDeal(listings, "Asia-Pacific", "USD");
  expect(deal!.tax).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/best-deal.test.ts`
Expected: FAIL (the `tax` field doesn't exist yet)

- [ ] **Step 3: Update the implementation**

Modify `lib/best-deal.ts`:

```typescript
import type { DistributorListing } from "./types";
import { getDistributorById } from "./distributors";
import { convertPrice } from "./currency";

export interface BestDeal {
  distributorId: string;
  price: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
}

export function findBestDeal(
  listings: DistributorListing[],
  destinationRegion: string,
  displayCurrency: string,
): BestDeal | null {
  let best: BestDeal | null = null;

  for (const listing of listings) {
    if (listing.stockStatus !== "in_stock" || listing.price <= 0) continue;
    const distributor = getDistributorById(listing.distributorId);
    if (!distributor?.shippingCosts) continue;
    const shippingCost = distributor.shippingCosts[destinationRegion];
    if (shippingCost == null) continue;

    const price = convertPrice(
      listing.price,
      listing.currency,
      displayCurrency,
    );
    // Shipping is denominated in the distributor's native currency
    const shipping = convertPrice(
      shippingCost,
      distributor.currency,
      displayCurrency,
    );
    const tax = price * (listing.taxRate ?? 0);
    const total = price + tax + shipping;

    if (!best || total < best.total) {
      best = {
        distributorId: listing.distributorId,
        price,
        tax,
        shipping,
        total,
        currency: displayCurrency,
      };
    }
  }

  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/best-deal.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/best-deal.ts tests/best-deal.test.ts
git commit -m "feat: include tax in best deal total landed cost"
```

---

## Task 5: Update Distributor Analysis to Include Tax

**Files:**

- Modify: `lib/distributor-analysis.ts`
- Modify: `tests/distributor-analysis.test.ts`

- [ ] **Step 1: Add tax test**

Append to `tests/distributor-analysis.test.ts`:

```typescript
it("includes tax in totalCost", () => {
  const watchlist = [
    makeProduct("p1", [
      makeListing({
        distributorId: "server2u-my",
        price: 100,
        currency: "USD",
        taxRate: 0.2,
      }),
    ]),
  ];
  const result = analyzeDistributors(watchlist, "USD");
  const server2u = result.find((r) => r.distributorId === "server2u-my");
  expect(server2u!.totalCost).toBeCloseTo(120, 2); // 100 + 20 tax
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/distributor-analysis.test.ts`
Expected: FAIL (totalCost doesn't include tax yet)

- [ ] **Step 3: Update the implementation**

Modify `lib/distributor-analysis.ts` to include tax in totalCost. The `cheapest` listing selection stays the same, but when adding to `totalCost`, include tax:

```typescript
coverage++;
const price = convertPrice(cheapest.price, cheapest.currency, displayCurrency);
totalCost += price + price * (cheapest.taxRate ?? 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/distributor-analysis.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/distributor-analysis.ts tests/distributor-analysis.test.ts
git commit -m "feat: include tax in distributor analysis totalCost"
```

---

## Task 6: Update Mobile Product Detail (Best Deal Card + Listings Table)

**Files:**

- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Update the Best Deal card**

In the Best Deal card (around line 1343), update the breakdown to show tax. Change the breakdown row from:

```tsx
<View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
  <Text style={{ color: colors.muted, fontSize: 12 }}>
    Price: {formatPrice(bestDeal.price, bestDeal.currency)}
  </Text>
  <Text style={{ color: colors.muted, fontSize: 12 }}>
    Shipping: {formatPrice(bestDeal.shipping, bestDeal.currency)}
  </Text>
</View>
```

to:

```tsx
<View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
  <Text style={{ color: colors.muted, fontSize: 12 }}>
    Price: {formatPrice(bestDeal.price, bestDeal.currency)}
  </Text>
  <Text style={{ color: colors.muted, fontSize: 12 }}>
    Tax:{" "}
    {bestDeal.tax > 0
      ? formatPrice(bestDeal.tax, bestDeal.currency)
      : "Tax-free"}
  </Text>
  <Text style={{ color: colors.muted, fontSize: 12 }}>
    Ship: {formatPrice(bestDeal.shipping, bestDeal.currency)}
  </Text>
</View>
```

- [ ] **Step 2: Update the listings table**

In the distributor listings table (where each listing row shows price), add a tax display. Find the row where the listing price is shown and add tax info:

```tsx
{
  listing.taxRate != null && listing.taxRate > 0 ? (
    <Text style={{ color: colors.muted, fontSize: 11 }}>
      +{formatPrice(listing.price * listing.taxRate, listing.currency)} tax
    </Text>
  ) : (
    <Text style={{ color: colors.muted, fontSize: 11 }}>Tax-free</Text>
  );
}
```

Place it near the price display in each listing row.

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add app/product/[id].tsx
git commit -m "feat: show tax in mobile best deal card and listings table"
```

---

## Task 7: Update Desktop Product Detail (Best Deal Card + Listings Table)

**Files:**

- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Update the Best Deal card**

In the Best Deal card (around line 226), update the breakdown to show tax. Change the breakdown row from:

```tsx
<div className="flex gap-4 mt-2">
  <p className="text-xs text-gray-500 dark:text-gray-400">
    Price: {formatPrice(bestDeal.price, bestDeal.currency)}
  </p>
  <p className="text-xs text-gray-500 dark:text-gray-400">
    Shipping: {formatPrice(bestDeal.shipping, bestDeal.currency)}
  </p>
</div>
```

to:

```tsx
<div className="flex gap-4 mt-2">
  <p className="text-xs text-gray-500 dark:text-gray-400">
    Price: {formatPrice(bestDeal.price, bestDeal.currency)}
  </p>
  <p className="text-xs text-gray-500 dark:text-gray-400">
    Tax:{" "}
    {bestDeal.tax > 0
      ? formatPrice(bestDeal.tax, bestDeal.currency)
      : "Tax-free"}
  </p>
  <p className="text-xs text-gray-500 dark:text-gray-400">
    Ship: {formatPrice(bestDeal.shipping, bestDeal.currency)}
  </p>
</div>
```

- [ ] **Step 2: Update the listings table**

In the distributor listings table (where each listing row shows price), add a tax display. Find the row where the listing price is shown and add tax info:

```tsx
{
  listing.taxRate != null && listing.taxRate > 0 ? (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      +{formatPrice(listing.price * listing.taxRate, listing.currency)} tax
    </p>
  ) : (
    <p className="text-xs text-gray-500 dark:text-gray-400">Tax-free</p>
  );
}
```

Place it near the price display in each listing row.

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "feat: show tax in desktop best deal card and listings table"
```

---

## Task 8: Update Distributor Analysis Screens

**Files:**

- Modify: `app/distributor-analysis.tsx`
- Modify: `desktop/src/pages/DistributorAnalysis.tsx`

- [ ] **Step 1: Update mobile analysis screen**

In `app/distributor-analysis.tsx`, the `totalCost` shown is now tax-inclusive (from Task 5). Update the row label to indicate it includes tax. Change the average-price line to note tax-inclusive:

```tsx
<Text style={{ color: colors.muted, fontSize: 12 }}>
  {a.coverage} product{a.coverage !== 1 ? "s" : ""} · avg{" "}
  {formatPrice(a.averagePrice, displayCurrency)} (incl. tax)
</Text>
```

- [ ] **Step 2: Update desktop analysis screen**

In `desktop/src/pages/DistributorAnalysis.tsx`, do the same:

```tsx
<p className="text-xs text-gray-500 dark:text-gray-400">
  {a.coverage} product{a.coverage !== 1 ? "s" : ""} · avg{" "}
  {formatPrice(a.averagePrice, displayCurrency)} (incl. tax)
</p>
```

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm check` and `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add app/distributor-analysis.tsx desktop/src/pages/DistributorAnalysis.tsx
git commit -m "feat: note tax-inclusive totals on distributor analysis screens"
```

---

## Task 9: Final Verification

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

Add Phase 22 entry for the tax-inclusive landed cost.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 22 tax-inclusive landed cost to todo.md"
```
