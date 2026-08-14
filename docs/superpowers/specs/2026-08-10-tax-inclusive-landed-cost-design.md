# Tax-Inclusive Landed Cost Design Spec

**Date:** 2026-08-10
**Status:** Approved
**Scope:** Add tax to the landed-cost calculation so the app shows the true "best price globally" (price + tax + shipping to the user's location). Update the Best Deal card, distributor listings table, and distributor analysis screen to show tax-inclusive costs.

## Overview

The app's core value is checking a specific item's price globally for the best landed cost, accounting for tax differences between locations and shipping to the user's location. Currently the Best Deal feature computes `price + shipping`. This feature adds tax (per distributor country) so the total reflects the true cost. A shared tax module keeps the calculation consistent across all three screens.

## Architecture

### Shared Module: `lib/tax.ts`

A platform-agnostic module with a country→tax-rate map and a lookup helper.

**Types:**

```typescript
export const COUNTRY_TAX_RATES: Record<string, number> = {
  // e.g. "Malaysia": 0, "United Kingdom": 0.20, "Germany": 0.19, "Australia": 0.10, ...
};

export function getTaxRate(country: string): number;
```

**Behavior:**

- `getTaxRate(country)` returns the tax rate for a country (e.g. 0.20 for 20% VAT)
- Unknown country → returns 0
- Tax-free countries → returns 0

### Data Model

Add `taxRate` to `DistributorListing`:

```typescript
interface DistributorListing {
  // ...existing fields
  taxRate?: number; // set by scraper from country map
}
```

### Scrapers

Each scraper sets `taxRate` on the listing it returns, using `getTaxRate(distributor.country)`. This flows into the listing's `taxRate` field.

### Best Deal Update

`findBestDeal` becomes tax-aware:

```typescript
const tax = price * (listing.taxRate ?? 0);
const total = price + tax + shipping;
```

`BestDeal` gains a `tax` field.

### All Three Screens

1. **Best Deal card** — shows price, tax, shipping, and total (all in display currency), with a 3-part breakdown
2. **Listings table** — each row shows the tax amount (or "Tax-free" if 0)
3. **Distributor analysis** — `totalCost` includes tax

## Data Flow

1. **Scraper** — when a scraper returns a `ScrapeResult`, it sets `taxRate` from `getTaxRate(distributor.country)`. This flows into the listing's `taxRate`.
2. **Best Deal** — `findBestDeal` computes `total = price + tax + shipping`, where `tax = price * (listing.taxRate ?? 0)`.
3. **Best Deal card** — shows price, tax, shipping, and total (all in display currency).
4. **Listings table** — each row shows the tax amount (or "Tax-free" if 0).
5. **Distributor analysis** — `totalCost` includes tax.

## Error Handling

- Listing with no `taxRate` → treated as 0% tax (no tax)
- Unknown country → `getTaxRate` returns 0
- Tax rate of 0 → shown as "Tax-free"
- All conversions use existing `convertPrice`

## Testing

- Unit tests for `getTaxRate` (known country, unknown country, tax-free country)
- Unit tests for `findBestDeal` with tax (tax-inclusive total, tax breakdown)
- Unit tests for `analyzeDistributors` with tax (totalCost includes tax)
- Component tests for the three screens (tax breakdown renders)

## Files

**New:**

- `lib/tax.ts` — shared tax module
- `tests/tax.test.ts` — unit tests

**Modified:**

- `lib/types.ts` — add `taxRate` to `DistributorListing`
- `lib/scrapers/types.ts` — add `taxRate` to `ScrapeResult`
- 25 scraper files — set `taxRate` from country map
- `lib/best-deal.ts` — include tax in total, add `tax` to `BestDeal`
- `lib/distributor-analysis.ts` — include tax in totalCost
- `app/product/[id].tsx` — Best Deal card + listings table show tax
- `desktop/src/pages/ProductDetail.tsx` — Best Deal card + listings table show tax
- `app/distributor-analysis.tsx` — show tax-inclusive total
- `desktop/src/pages/DistributorAnalysis.tsx` — show tax-inclusive total
