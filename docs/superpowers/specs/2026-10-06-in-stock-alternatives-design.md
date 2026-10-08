# In-Stock Alternatives — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

When the product a user is viewing is out of stock everywhere, show what *is*
available in the same category — turning the app's most common dead end into a
path forward.

## Problem

The app is built around a **specific part**. When it is unavailable, the app says
"out of stock" and stops. It never suggests the equivalent that *is* available —
yet the scarcity workflow's terminal move is buying the substitute, and the data
(`category`, the available board) already exists. The app answers "where is *this*
part?" but not "what else could work?"

## Scope

**In scope:** a pure `pickAlternatives`, an "In stock now in {category}" section on
product detail (shown only when the product is out of stock), the standalone
fallback, and tests.

**Out of scope:** a recommendation engine/ML (category + availability is enough);
desktop parity (mobile-first).

## Architecture

### 1. Pure selector — `lib/alternatives.ts` (new)

```ts
import type { AvailableProduct } from "./types";

export interface Alternative {
  id: string;
  name: string;
  brand: string;
  modelNumber: string;
  bestPrice: number;
  bestCurrency: string;
  storeCount: number;
}

/**
 * In-stock catalog products in the same category as `product`, excluding the
 * product itself, cheapest first. Returns [] when none — the caller hides the
 * section. "Same category" is a coarse notion of equivalent (a 24-port and a
 * 5-port switch share a category), so the UI says "in stock in {category}", not
 * "equivalent to this".
 */
export function pickAlternatives(input: {
  product: { id: string; category: string };
  available: AvailableProduct[];
  limit?: number; // default 5
}): Alternative[];
```

- Filter `available` to `category === product.category` and `id !== product.id`.
- Sort by `bestPrice` ascending; slice to `limit` (default 5).
- Map to `Alternative`.

### 2. Section — `components/product/alternatives-section.tsx` (new)

```ts
export function AlternativesSection({
  category,
  alternatives,
}: {
  category: string;
  alternatives: Alternative[];
}): JSX.Element | null;
```

Renders nothing when `alternatives.length === 0`. Otherwise a card:
> **In stock now in {category}**
> [name · bestPrice · N stores] … (each row taps → `/product/[id]`)

Uses `useColors()`, `IconSymbol`, the app card style.

### 3. Wiring — `app/product/[id].tsx`

The product detail uses `useState`/`useEffect` (not React Query). Add:

- State `const [alternatives, setAlternatives] = useState<Alternative[]>([]);`.
- An effect that runs when `product?.category` and `effectiveCurrency` are known and
  the product is out of stock (`bestInStockListing == null`): call
  `fetchAvailable({ category: product.category, currency: effectiveCurrency })`,
  then `pickAlternatives({ product: { id, category: product.category }, available })`
  and `setAlternatives(...)`. On the standalone path
  (`!isServerConfigured()`), use `localAlternatives(product, await getWatchlist(), effectiveCurrency)`.
  Guard with an `active` flag (the file's existing effect pattern) so a stale
  response can't set state after unmount.
- Render `<AlternativesSection category={product.category} alternatives={alternatives} />`
  after `DistributorListingSection`, **only when `bestInStockListing == null`** (the
  dead end).

### 4. Standalone fallback

When `!isServerConfigured()`, `fetchAvailable` returns `[]`. Build the alternatives
from the **watchlist's in-stock products** in the same category instead (reusing the
board's fallback logic: filter `getWatchlist()` to in-stock, same category, exclude
self, cheapest first). A small helper `localAlternatives(product, watchlist, currency)`
in `lib/alternatives.ts` keeps this testable.

## Data Flow

1. Product detail loads; if the product has no in-stock listing, the section is eligible.
2. `fetchAvailable({ category })` (server) or `localAlternatives` (standalone) supplies candidates.
3. `pickAlternatives` filters/sorts; the section renders; each row navigates.

## Error Handling

- No category → no section.
- No alternatives → section renders nothing.
- Server error → `fetchAvailable` throws → the effect catches and leaves
  `alternatives` empty (the section hides; the product detail still works).

## Testing

- `tests/alternatives.test.ts` — filters to the category; excludes self; sorts by
  price; respects `limit`; returns `[]` when none; `localAlternatives` builds from
  in-stock watchlist products in the category.
- `tests/alternatives-section.test.tsx` — renders the header + rows; renders
  nothing when empty; a row taps to `/product/[id]`.
- Existing product-detail tests stay green.

## Success Criteria

- Viewing an out-of-stock product shows in-stock alternatives in its category
  (server and standalone), each tappable.
- A healthy (in-stock) product shows no alternatives section.
- `pnpm verify` stays green.

## Risks

- **"Equivalent" over-claim** → the copy says "in stock in {category}", not
  "equivalent"; it is a starting point.
- **Noise** → only shown at the dead end (out of stock), capped at 5.
- **Extra query** → one `catalog.available` call per out-of-stock product view,
  cached by React Query.
