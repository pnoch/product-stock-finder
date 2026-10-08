# Build-Order Consolidation — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Turn the watchlist (a build) into a **purchasing plan**: the cheapest single-store
order vs. the cheapest split order, with shipping counted once per store — so a
user sees whether consolidating saves money.

## Problem

The app is **per-product**. Every feature optimizes *"the best way to get **this one
part**."* But a homelab build is 5–20 parts, and **shipping/duty are per-order, not
per-item**. The app's per-item landed cost systematically overstates a consolidated
order and never surfaces the consolidation win. The app answers "where's the best
price for this part?" but not "what's the best way to buy my whole list?"

## Scope

**In scope:** a pure `computeBuildOrder`, a "Plan order" screen, a watchlist entry,
and tests.

**Out of scope:** a full cart/checkout; an arbitrary-constraint solver; desktop
parity.

## Architecture

### 1. Pure planner — `lib/build-order.ts` (new)

Reuses `computeLandedCost` per listing, but **counts shipping once per store**:

```ts
import type { Destination, LandedCostOptions } from "./landed-cost";
import type { Product } from "./types";

export interface BuildOrderItem {
  productId: string;
  productName: string;
  distributorId: string;
  /** price + tax + duty, converted, EXCLUDING shipping. */
  itemCost: number;
}

export interface BuildOrderStore {
  distributorId: string;
  distributorName: string;
  items: BuildOrderItem[];
  itemsTotal: number;
  /** One shipping fee for the whole store order. */
  shipping: number;
  total: number;
}

export interface BuildOrderPlan {
  stores: BuildOrderStore[];
  itemsTotal: number;
  shippingTotal: number;
  total: number;
  currency: string;
  /** Product ids with no orderable listing (no in_stock/back_order). */
  unassigned: string[];
}

export interface BuildOrderComparison {
  split: BuildOrderPlan;
  /** The cheapest store that carries every product, or null. */
  singleStore: BuildOrderPlan | null;
  /** split.total - singleStore.total; positive = consolidating saves money. */
  savings: number;
}

export function computeBuildOrder(
  watchlist: Product[],
  destination: Destination,
  options: LandedCostOptions,
): BuildOrderComparison;
```

**Split plan:** for each product, the cheapest orderable listing
(`in_stock`/`back_order`) by landed total; group by distributor; `itemCost =
cost.total - cost.shipping`; `shipping` = `resolveShipping(distributor, country)`
once; `total = itemsTotal + shipping`.

**Single-store plan:** for each distributor that carries **every** product, sum
its per-product cheapest item costs + one shipping; pick the min. `null` when none
carries everything.

**Unassigned:** product ids with no orderable listing (or whose shipping is
unknown) are listed, not silently dropped.

### 2. Screen — `app/build-order.tsx` (new)

Reachable from the watchlist via a **"Plan order"** button. Uses
`useLiveWatchlist`/`getWatchlist` + settings (`shipToCountry`, `displayCurrency`,
`taxExempt`, `includeImportEstimate`) to build the `Destination`/options, then
renders:

- **Cheapest single order:** *"Getic — 8 items, $1,240 + $38 shipping = $1,278"*
  (or "No single store has everything").
- **Cheapest split:** *"3 stores — $1,180 + 3 shipping fees = $1,290"*.
- **Verdict:** *"Order everything from Getic and save $12"* (or "Splitting saves
  $X").
- Per-store breakdown: each store, its items, subtotal, shipping, total.
- **Unassigned** parts called out.

Uses `useColors()`, `IconSymbol`, `ScreenContainer`, `formatPrice`/`formatEstimate`.

### 3. Watchlist entry — `app/(tabs)/watchlist.tsx`

A **"Plan order"** action (e.g. in the header or the summary area) →
`router.push("/build-order")`. Shown only when the watchlist has ≥2 products.

## Data Flow

1. The watchlist (the build) + the user's destination feed `computeBuildOrder`.
2. It returns the split plan, the single-store plan (or null), and the savings.
3. The screen renders the comparison and per-store breakdown.

## Error Handling

- No destination set → the screen prompts "Set where you ship to" (link to
  Settings) rather than showing a wrong plan.
- A product with no orderable listing → listed under "unassigned".
- A store with unknown shipping → excluded from the plan (its items become
  unassigned), so the total is never understated.
- `< 2` products → the entry button is hidden.

## Testing

- `tests/build-order.test.ts` — split groups by store and counts shipping once
  per store; single-store plan picks the store carrying everything; `null` when
  none does; `savings` sign; unassigned for a product with no orderable listing;
  unknown-shipping store excluded.
- `tests/build-order-screen.test.tsx` — renders the single/split totals and the
  verdict; shows the "set destination" prompt when no country is set.
- Existing watchlist tests stay green.

## Success Criteria

- A multi-product watchlist shows a purchasing plan: cheapest single-store order
  vs. cheapest split, with shipping counted once per store, and a clear verdict.
- No destination → a prompt, not a wrong plan.
- `pnpm verify` stays green.

## Risks

- **Shipping is an estimate** → the plan ranks and compares; the UI labels it an
  estimate (consistent with Phase 1116).
- **"Single store" rarely wins** → the view states that plainly rather than
  forcing a false consolidation.
- **Per-order duty** → duty is modeled per item (as elsewhere); only shipping is
  treated as per-order. This is stated in the UI copy.
