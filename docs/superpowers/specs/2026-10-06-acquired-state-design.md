# Acquired State — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Let a user mark a watched product as **acquired** (bought), so the app stops
treating it as something still to buy — fixing the build-order plan, the reseller
sheet, and the alert pipeline for anyone who has bought part of their list.

## Problem

Every feature treats the watchlist as **permanent**. But a build has a lifecycle:
you buy parts, the hunt ends. Three shipped features silently assume "not yet
bought":

- **Build-order plan** (Phase 1135) plans the *whole* watchlist → wrong "what I
  still need to order."
- **Reseller sheet** (Phase 1136) computes margin on the *whole* watchlist →
  includes parts already owned.
- **Alerts / restock / away-summary** fire on parts the user already owns →
  self-inflicted noise.

A user building a NAS over three weeks buys 6 of 8 parts; the app keeps nagging
about the 6, plans an order for all 8, and reports margins on all 8. This is a
**correctness bug in three shipped features**, not just a missing nicety.

## Scope

**In scope:** a `Product.acquiredAt` field, `updateProductAcquired`, a pure
`lib/acquired.ts`, filtering in the six consumers, the card/detail actions, a
"Show acquired" toggle, and tests.

**Out of scope:** purchase price / receipts; a project tracker; desktop parity.

## Architecture

### 1. Data model — `Product.acquiredAt?: string` (`lib/types.ts`)

An ISO timestamp; present = acquired. Set/cleared via
`updateProductAcquired(productId, acquiredAt: string | null)` in
`lib/storage/watchlist.ts` (mirroring `updateProductSourcing`: serialized via
`enqueue`, `notify("watchlist", productId)`, re-exported). Syncs with the
watchlist (product data; `sanitizePulledItem` preserves it).

### 2. Pure filter — `lib/acquired.ts` (new)

```ts
import type { Product } from "./types";

/** A product the user has marked as bought. */
export function isAcquired(product: Product): boolean {
  return typeof product.acquiredAt === "string" && product.acquiredAt.length > 0;
}

/** The products still to buy (unacquired). */
export function activeProducts(products: Product[]): Product[] {
  return products.filter((p) => !isAcquired(p));
}
```

One module so every consumer filters identically (no scattered checks).

### 3. Consumers filter to active products

- **Build-order** (`app/build-order.tsx`): `computeBuildOrder(activeProducts(watchlist), …)`;
  show **"remaining build cost"** and, when any are acquired, "N parts already
  acquired".
- **Sourcing** (`app/sourcing.tsx`): `computeSourcing(activeProducts(watchlist), …)`.
- **Basket** (`app/stats.tsx`): `computeBasketValue(activeProducts(watchlist), …)`.
- **Alerts** (`lib/background-tasks/price-check.ts`): skip an alert whose product
  is acquired — **leave it armed, do not fire** (unmarking restores it).
- **Restock** (`lib/restock.ts`): skip a watch whose product is acquired.
- **Away-summary** (`app/(tabs)/index.tsx`): compute over `activeProducts`.

### 4. UI

- **Watchlist card** + **product detail**: a **"Mark as acquired"** action (and
  "Unmark" when acquired). On the card, a small check action beside the existing
  actions; on the detail, a button in `DetailHeader` beside "Watch for restock".
- **Watchlist**: a **"Show acquired"** toggle (default hidden); acquired rows
  render dimmed with a check.
- **Product detail**: an "Acquired" badge when set.

## Data Flow

1. The user taps "Mark as acquired" → `updateProductAcquired(id, now)`.
2. Every consumer filters via `activeProducts`, so the part drops out of the
   build-order plan, sourcing sheet, basket, alerts, restock, and away-summary.
3. "Unmark" clears `acquiredAt` and restores the part everywhere.

## Error Handling

- Storage failure → alert, state unchanged.
- An acquired product with an armed alert → the alert is skipped, not deactivated
  (unmarking re-arms it).
- Acquired products still appear in the watchlist when "Show acquired" is on.

## Testing

- `tests/acquired.test.ts` — `isAcquired` (present/absent/empty string);
  `activeProducts` filters.
- `tests/acquired-storage.test.ts` — `updateProductAcquired` sets and clears;
  wiped by `clearAllData`.
- `tests/acquired-consumers.test.ts` — `computeBuildOrder`/`computeSourcing`/
  `computeBasketValue` over `activeProducts` exclude an acquired product.
- `tests/price-check-acquired.test.ts` — an alert for an acquired product does not
  fire and stays active.
- Existing tests stay green.

## Success Criteria

- Marking a product acquired removes it from the build-order plan, the sourcing
  sheet, the basket, alerts, restock, and the away-summary; unmarking restores it.
- The watchlist hides acquired products by default, with a toggle to show them.
- `pnpm verify` stays green.

## Risks

- **Manual only** → the app never infers acquisition (we hand off to the store, so
  we don't see the order); the user marks it.
- **Forgetting to unmark** → the "Show acquired" toggle makes it visible and
  reversible.
- **Filtering consistency** → a single `activeProducts` helper prevents drift.
