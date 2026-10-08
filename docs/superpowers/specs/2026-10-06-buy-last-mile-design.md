# Buy Last-Mile — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Close the loop from "it's back in stock" to "I bought it" — make the highest-intent
moment (a restock alert) one tap from the store, and make the watchlist actionable.

## Problem

The app tells you *when* and *where* a part is available, then stops one tap short
of the purchase:

- A restock notification says *"CRS804 is now available at Getic for USD 209.00"*
  but tapping it routes to `/product/[id]` — a comparison view, not the store.
- The watchlist card shows a best price but has **no Buy action**; tapping opens
  the detail screen.
- The notification carries `distributorName` but not the store URL, so it cannot
  point at the exact product page.

The strongest buy signal the app produces (a restock alert) is the one moment it
makes the user hunt for the buy button.

## Scope

**In scope:** the notification `url`/`distributorId` payload, a watchlist **Buy**
button, a best-deal **Visit** CTA, and tests.

**Out of scope:** cart/checkout/payments (we hand off to the store);
auto-opening the external URL from a notification tap (deliberately — see below).

## Architecture

### 1. Notification payload — `lib/notifications.ts`

`scheduleStockAlert` gains `url` and `distributorId`:

```ts
export async function scheduleStockAlert(
  productName: string,
  distributorName: string,
  price: number,
  currency: string,
  productId?: string,
  distributorId?: string,
  url?: string,
): Promise<string | null>;
```

`data` becomes `{ type: "stock_alert", productName, distributorName, productId, distributorId, url }`.

The caller `lib/restock.ts` passes the first in-stock listing's `distributorId`
and `url` (it already has `newlyInStock[0]`).

**Notification tap routing is unchanged** (`notificationRouteFor` → `/product/[id]`).
Rationale: a notification tap should open the app's own product view (predictable,
in-app, testable); auto-launching an external browser from a tap is jarring and
untestable. The product detail then surfaces the in-stock store as the next action.

### 2. Watchlist Buy button — `components/watchlist/product-card.tsx`

Add a `bestInStockListing` memo (the cheapest **in-stock** listing, distinct from
`getBestPrice` which also accepts back-order):

```ts
const bestInStockListing = useMemo(() => {
  const inStock = (product.listings ?? []).filter(
    (l) => l.stockStatus === "in_stock" && l.price > 0 && Number.isFinite(l.price),
  );
  if (inStock.length === 0) return null;
  return inStock.reduce((best, l) => (l.price < best.price ? l : best));
}, [product.listings]);
```

When `bestInStockListing` exists, render a small **Buy** button (icon `cart.fill`,
`colors.primary`) that calls `openListingUrl(bestInStockListing.url)`. It must
`stopPropagation` so it does not also trigger the card's `onPress`. When no
in-stock listing exists, render nothing (the card's `onPress` still opens detail).

### 3. Best-deal Visit CTA — `components/product/distributor-listing-section.tsx`

The best-deal card is currently informational. Add a **Visit store** button
(icon `arrow.up.right.square`) that opens the best-deal distributor's listing URL.
The card has `bestDeal.distributorId`; find that listing in `sortedListings` and
`openListingUrl(listing.url)`. When no URL is resolvable, fall back to
`onOpenChart`-style no-op or hide the button.

### Why this shape
- **Closes the loop** — find → watch → alert → **buy**.
- **Wiring, not infrastructure** — `openListingUrl`, `listing.url`, and
  `distributorName` all exist; the notification already carries the store name.
- **Honest** — we hand off to the store; no cart/checkout.

## Data Flow

1. A restock fires → the notification carries the store's product URL.
2. The user taps → the product detail opens; the in-stock row's "Visit" is the
   obvious next tap.
3. On the watchlist, the **Buy** button opens the cheapest in-stock store directly.

## Error Handling

- A stale/unopenable `url` → `openListingUrl` already shows a "Cannot Open Link"
  alert; the product detail remains the fallback.
- No in-stock listing → the Buy button is absent (no dead button).
- No resolvable URL on the best-deal card → the Visit button is hidden.

## Testing

- `tests/notifications-stock-url.test.ts` — `scheduleStockAlert` includes `url` and
  `distributorId` in the notification `data`.
- `tests/restock-any-scope.test.ts` (extend) — the restock path passes the first
  in-stock listing's `url`/`distributorId` to `scheduleStockAlert`.
- `tests/product-card-buy.test.tsx` — the Buy button renders when an in-stock
  listing exists, calls `openListingUrl` with its URL, and is absent otherwise.
- A source-guard test that the best-deal card renders a Visit CTA.
- Existing tests stay green.

## Success Criteria

- A restock notification carries the store URL; the watchlist shows a Buy button
  that opens the cheapest in-stock store; the best-deal card offers Visit.
- No dead buttons when no in-stock listing / URL exists.
- `pnpm verify` stays green.

## Risks

- **Stale URLs** → `openListingUrl` handles it; detail is the fallback.
- **Accidental navigation** → the Buy button stops propagation so it doesn't also
  open the detail.
- **Desktop parity** → desktop has no notification path, and its watchlist
  (`desktop/src/pages/Watchlist.tsx`) has no per-listing action today. Adding a
  Buy button there is a separate surface; keep it out of scope for this phase
  (mobile-first) and note it as a follow-up.
