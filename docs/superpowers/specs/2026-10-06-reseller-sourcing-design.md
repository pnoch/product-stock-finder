# Reseller Sourcing Sheet — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Serve the reseller audience: per-product **quantity** + a user-supplied **target
sell price** → **margin per unit and total**, plus the **cross-distributor price
spread** (the buy-low/sell-high signal) — without pretending to know the market.

## Problem

The app is a **buy-side** tool: it finds the cheapest landed price for a part. A
reseller needs the other half — *"if I buy 20 at $209 and sell at $280, what's my
margin?"* — plus the spread (the same part at $209 here and $340 there is an
arbitrage signal). Both are derivable from existing data; the app just doesn't
express them.

## Honest boundary

There is **no sell-side data source** (no eBay/Amazon/marketplace comps). The app
never claims to know the market price: **the user supplies the sell price**, and
the app computes the margin. Products without a sell price show "—" and are
excluded from the margin total.

## Scope

**In scope:** two `Product` fields, a pure `computeSourcing`, a "Sourcing sheet"
screen, a watchlist entry, and tests.

**Out of scope:** automated sell-side comps (no data source); a full
inventory/P&L system; desktop parity.

## Architecture

### 1. Data model — `Product` gains fields (`lib/types.ts`)

```ts
/** Units the user intends to buy (reseller sourcing). Default 1. */
quantity?: number;
/** User-supplied target sell price per unit, in `sellCurrency`. */
targetSellPrice?: number;
sellCurrency?: string;
```

Set via a **"Sourcing"** sheet (quantity + target sell price) reachable from the
watchlist card and the sourcing screen. Synced with the watchlist (it is product
data).

### 2. Pure math — `lib/reseller.ts` (new)

```ts
import type { Destination, LandedCostOptions } from "./landed-cost";
import type { Product } from "./types";

export interface SourcingLine {
  productId: string;
  productName: string;
  quantity: number;
  /** Best landed cost per unit (cheapest purchasable listing), or null. */
  buyUnit: number | null;
  /** Min / max landed price across in-stock listings (the spread), or null. */
  spreadMin: number | null;
  spreadMax: number | null;
  /** User-supplied sell price per unit, or null. */
  sellUnit: number | null;
  /** sellUnit - buyUnit, or null when either is missing. */
  marginUnit: number | null;
  /** marginUnit * quantity, or null. */
  marginTotal: number | null;
  currency: string;
}

export interface SourcingSummary {
  lines: SourcingLine[];
  /** Sum of marginTotal across lines with a margin, or null when none. */
  totalMargin: number | null;
  /** Sum of buyUnit * quantity across lines with a buy price. */
  totalOutlay: number;
  currency: string;
}

export function computeSourcing(
  watchlist: Product[],
  destination: Destination,
  options: LandedCostOptions,
): SourcingSummary;
```

- `buyUnit` = the cheapest `rankByLandedCost` total (per unit), or null.
- `spreadMin/Max` = min/max landed total across **in-stock** listings (the
  arbitrage signal), or null when fewer than one in-stock listing.
- `sellUnit` = `targetSellPrice` converted to the destination currency, or null.
- `marginUnit = sellUnit - buyUnit` (null when either missing);
  `marginTotal = marginUnit × quantity`.
- `totalOutlay` = Σ `buyUnit × quantity` (lines with a buy price).
- `totalMargin` = Σ `marginTotal` (lines with a margin), or null when none.

### 3. Screen — `app/sourcing.tsx` (new)

Reachable from the watchlist via a **"Sourcing sheet"** entry (shown when the
watchlist is non-empty). Uses `getWatchlist` + settings to build the
`Destination`/options, then renders a table:

- Per line: product, qty, buy/unit, sell/unit, margin/unit, margin total, and the
  **spread** ("$209–$340").
- Summary: **total outlay** (capital needed) and **total margin**.
- Products without a sell price show "—" and are excluded from the margin total.
- A "Set sell price" affordance per row opens the sourcing sheet.

Uses `useColors()`, `IconSymbol`, `ScreenContainer`, `formatEstimate`, and a back
affordance (`goBackOrHome`).

### 4. Sourcing sheet — `components/sourcing/sourcing-sheet.tsx` (new)

A modal with a quantity stepper and a target-sell-price input; saves via a new
`updateProductSourcing(productId, { quantity, targetSellPrice, sellCurrency })`
storage helper (mirroring `updateProductDetails`, serialized via `enqueue`).

### 5. Watchlist entry — `app/(tabs)/watchlist.tsx`

A **"Sourcing sheet"** row beside "Plan order" (shown when `watchlist.length > 0`)
→ `router.push("/sourcing")`.

## Data Flow

1. The watchlist + destination feed `computeSourcing`.
2. It returns per-line buy/sell/margin/spread and the summary.
3. The screen renders the table; the sourcing sheet edits quantity/sell price.

## Error Handling

- No destination → the screen prompts "Set where you ship to" (link to Settings).
- A product with no purchasable listing → `buyUnit` null → margin null → "—".
- No sell price → margin null → excluded from the total (never guessed).
- Non-finite quantity/sell price → treated as absent.

## Testing

- `tests/reseller.test.ts` — `buyUnit` is the cheapest landed; spread min/max
  across in-stock listings; `marginUnit`/`marginTotal`; null when no sell price or
  no buy price; `totalOutlay`/`totalMargin` sums; quantity default 1.
- `tests/sourcing-screen.test.tsx` — renders lines and the summary; the
  destination-null prompt; a line without a sell price shows "—".
- `tests/sourcing-storage.test.ts` — `updateProductSourcing` round-trips; wiped by
  `clearAllData`.
- Existing tests stay green.

## Success Criteria

- A reseller can set quantity + sell price per product and see margin per unit,
  margin total, total outlay, and the cross-distributor spread.
- No sell price → no invented margin.
- `pnpm verify` stays green.

## Risks

- **Margin accuracy** → the UI labels both the landed cost and the sell price as
  user/estimate inputs; it never invents a sell price.
- **No sell-side comps** → explicitly out of scope; the user supplies the number.
- **Sync** → the fields ride the existing watchlist sync (product data).
