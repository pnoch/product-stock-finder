# Destination Onboarding + Landed-Cost Filter Bar — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Make the landed-cost engine (Phase 1114) user-visible: let the user pick where
they ship, and rank every listing by the true cost to their door. This is the
user-facing half of the "global stock & price radar" repositioning.

## Problem

Phase 1114 built `computeLandedCost` / `rankByLandedCost`, but nothing calls
them. The product detail screen still ranks by `findBestDeal` (region-level) and
the only destination setting is a coarse `shippingRegion` pill. A user in
Thailand cannot say "ship to Thailand" and see the landed cost.

## Scope

**In scope:** a curated country list; a destination onboarding step; a
landed-cost filter bar (ship-to country + tax-exempt + include-import-estimate)
on the product detail screen; the Settings "Ship to" control.

**Out of scope (follow-on):** per-country shipping *rates* (the data task);
repositioned copy / app name; catalog expansion; billing/signing/telemetry.

## Architecture

### 1. Country data — `shared/src/countries.ts` (new)

A curated list of ~60 countries the distributors realistically ship to:

```ts
export interface Country {
  code: string;      // ISO-3166 alpha-2
  name: string;
  currency: string;  // default display currency
  region: string;    // distributor region (Asia-Pacific, Europe, …)
}

export const COUNTRIES: Country[] = [ /* ~60 entries */ ];

export function getCountry(code: string): Country | undefined;
export function searchCountries(query: string): Country[]; // name/code match
```

This is the single source for the picker. `lib/landed-cost.ts`'s
`COUNTRY_REGION` and `shared/src/duty.ts`'s `COUNTRY_VAT` stay as-is (they are
lookup tables with different concerns) but must be a subset of `COUNTRIES` —
a test asserts every `COUNTRY_REGION`/`COUNTRY_VAT` key exists in `COUNTRIES`.

### 2. Destination onboarding step — `components/onboarding/`

The existing 3-slide carousel gains a **4th step** rendered after the slides
(not a slide in the horizontal list, so the picker can be interactive): a
searchable country list, currency auto-filled from the country, and a
"I'm tax-exempt (VAT/EORI)" toggle. On finish it persists `shipToCountry`,
`displayCurrency`, `taxExempt`. Skippable — skipping leaves `shipToCountry`
unset (the app then falls back to `shippingRegion`).

A new `components/ui/country-picker.tsx` (searchable list, reusing the existing
modal/sheet patterns) is shared by onboarding and the filter bar.

### 3. Landed-cost filter bar — `components/product/distributor-listing-section.tsx`

The existing region chip row stays (browsing). Above it, a **landed-cost bar**:

- **Ship to** — opens the country picker; changing it re-ranks in place.
- **Tax-exempt** toggle.
- **Include import estimate** toggle (off by default).

Ranking switches from `findBestDeal` to `rankByLandedCost(listings, destination,
options)` when `shipToCountry` is set; when it is unset, keep the existing
`findBestDeal` region path (no regression). The best-deal card shows the
breakdown: `$209 + $38 shipping + $0 tax = $247 to Thailand`.

### 4. Settings — `app/(tabs)/settings.tsx`

Replace the "Shipping Region" pill with a **"Ship to"** row (country picker)
plus a **tax-exempt** toggle and an **include import estimate** toggle. Keep
`shippingRegion` (still used by the region chips and the fallback path).

## Data Flow

1. Onboarding (or Settings) sets `shipToCountry` + `displayCurrency` + `taxExempt`.
2. Product detail reads settings → builds `Destination { countryCode, currency }`.
3. `rankByLandedCost(listings, destination, { taxExempt, includeImportEstimate, category })`
   → sorted rows; the best-deal card renders the breakdown.
4. Changing the filter bar re-runs `rankByLandedCost` over already-fetched
   listings (no network) and persists the new default.

## Error Handling

- `shipToCountry` unset → fall back to the existing `findBestDeal` region path.
- A country with no shipping data → `rankByLandedCost` drops the row (as
  designed); the UI shows "shipping unknown" for those distributors rather than
  hiding them silently where feasible.
- Every landed-cost figure is labelled an estimate.

## Testing

- `shared/src/countries.ts`: `getCountry`, `searchCountries` (name + code,
  case-insensitive); every `COUNTRY_REGION` and `COUNTRY_VAT` key exists in
  `COUNTRIES`.
- Filter-bar logic: a pure helper `resolveDestination(settings)` →
  `Destination | null` (null when `shipToCountry` unset) and
  `landedCostOptions(settings)`; unit-tested.
- Ranking switch: with `shipToCountry` set, rows sort by landed cost; unset,
  the region path is used.
- Existing product-detail and settings tests stay green.

## Success Criteria

- A user picks Thailand in onboarding; the product detail ranks listings by
  landed cost to Thailand with a breakdown, and the tax-exempt toggle re-ranks
  instantly.
- With no country set, behavior is unchanged (region path).
- `pnpm verify` stays green.

## Risks

- **Country list vs. data coverage** → curated ~60; countries without shipping
  data fall back to region, then drop.
- **Onboarding friction** → the step is skippable and defaults from device locale.
- **Two ranking paths** (country vs. region) → gated on `shipToCountry`; the
  region path is untouched, so no regression.
