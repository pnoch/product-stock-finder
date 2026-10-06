# Estimated Shipping + Exact-Rate CTA — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Be honest about shipping: the app ranks by an **estimated** landed cost, and
points the user to the store to get the **exact** rate (which each store
computes at checkout after a country is selected). No fabricated precision.

## Problem

Phase 1114/1115 rank listings by landed cost using a region-based shipping
estimate (`resolveShipping` → region fallback). But each distributor computes
shipping at checkout *after* the destination is chosen (often after adding to
cart) — there is no static per-country rate to scrape reliably. Presenting the
estimate as a firm number overstates precision; hiding it loses the ranking.

## Decision

**Estimate for ranking, exact rate at checkout.**

- Keep the region-based shipping as a clearly-labelled **estimate** used only for
  ranking ("which store is cheapest to me").
- Add an explicit **"Get exact shipping"** affordance that opens the
  distributor's product page, where the user selects their country and sees the
  real rate.
- Never present the estimate as a quote.

This is deliberately **not** scraping ~30 shipping calculators (fragile, often
session/cart-bound). Revisit for the top few distributors only if traffic
justifies it.

## Architecture

### 1. Estimate labelling — `lib/landed-cost.ts` / UI

`LandedCost.isEstimate` is already `true`. Surface it:
- The best-deal breakdown's shipping term is labelled `est.` (e.g.
  `Ship: ~$38 est.`).
- The breakdown equation line reads
  `$209 + ~$38 est. shipping + $0 tax = $247 est.` — the total is also an
  estimate.
- A one-line note under the breakdown: "Shipping is estimated. Check exact rates
  at checkout."

Add a small shared formatter `lib/estimate-format.ts`:
```ts
export function formatEstimate(amount: number, currency: string): string;
// e.g. "~$38 est."
```
so the `~`/`est.` convention is consistent everywhere.

### 2. "Get exact shipping" CTA — `components/product/distributor-listing-card.tsx`

The card already has a **Visit** button (`openListingUrl(listing.url)`) that
opens the store page — the exact place the user selects their country. Make the
intent explicit:
- When a destination is active, relabel the button **"Visit · exact shipping"**
  (or add a small caption "Get exact shipping at checkout").
- Keep the existing `Visit` behaviour (open `listing.url`); no new plumbing.

### 3. Per-row estimate — `components/product/distributor-listing-card.tsx`

If the row shows a shipping figure, label it `est.` too. If it does not, leave it
(the best-deal card carries the breakdown).

### 4. Crowd-sourced correction (follow-on, not this spec)

Let a user optionally record the exact quote they saw, stored per
`distributor + country`, so the estimate self-corrects over time. Deferred — it
needs a storage key, a UI, and a trust model.

## Data Flow

1. Product detail ranks by `rankByLandedCost` (estimate) — unchanged.
2. The best-deal card renders the estimate with `~`/`est.` labels and the note.
3. "Visit · exact shipping" opens `listing.url`; the store computes the real rate
   for the user's country.

## Error Handling

- `shipping === null` (unknown) → "N/A" (unchanged); the CTA still works.
- No destination set → the region path renders as today (no `est.` labels needed,
  since the region card is already labelled "incl. shipping to <region>").

## Testing

- `lib/estimate-format.ts`: `formatEstimate` unit tests (rounding, currency
  symbol, the `~`/`est.` affixes).
- A source/guard test that the best-deal breakdown labels shipping as an estimate
  when a destination is active (string guard, mirroring existing UI guard tests).
- Existing landed-cost tests stay green (no engine change).

## Success Criteria

- With a destination set, the best-deal card labels shipping and the total as
  estimates and shows the "check exact rates at checkout" note.
- The card offers "Visit · exact shipping" which opens the store page.
- No engine/ranking change; `pnpm verify` stays green.

## Risks

- **Estimate accuracy** → mitigated by explicit labelling; ranking is the value.
- **CTA confusion** → the button keeps its existing "open the store" behaviour;
  only the label changes.
