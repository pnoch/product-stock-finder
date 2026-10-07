# Available-Now Board — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Answer "what **can** I get?" — a board of catalog products that are currently in
stock somewhere, ranked by price, so a user can discover a part instead of only
checking one they already know.

## Problem

Discovery is model-first: the app checks a known model across 25 stores. There is
no way to browse availability — "show me in-stock networking switches." The
CRS804 story began with *"I need a 24-port MikroTik switch and don't know what's
in stock."* The app answers *"does anyone have **this**?"* but not *"what **can**
I get?"*

## Data reality

The catalog has **no listings**; listings come from scraping. But the server's
**price cache** (`price_cache`) is populated by the catalog warmer for all 121
products × 25 distributors and carries `stockStatus`. So the board is a
**server-backed** feature: it reads the cache, not the device.

**Standalone (no server) has no catalog-wide cache** — the board falls back to
the watchlist's in-stock products (a smaller, honest board) plus a "connect to
see all 121 products" prompt. This fits the monetization split (server-backed =
Pro).

## Scope

**In scope:** a server `catalog.available` endpoint + a cache query, the board
screen with filters, a Home section, the standalone fallback, and tests.

**Out of scope:** real-time refresh (the warmer's cadence is the freshness);
desktop parity.

## Architecture

### 1. Cache query — `server/price-cache.ts`

Add `listCachedInStock(now)` — one indexed scan of `price_cache` returning every
row with `stockStatus === "in_stock"` and `fetchedAt` within a freshness window
(reuse `PRICE_SNAPSHOT_TTL_MS` from `shared/const.ts`). Returns
`PriceSnapshot & { distributorId, modelNumber }`.

```ts
export async function listCachedInStock(
  now: number,
  maxAgeMs: number,
): Promise<Array<PriceSnapshot & { distributorId: string; modelNumber: string }>>;
```

### 2. Endpoint — `server/routers/catalog.ts` (new)

`catalog.available` (public, no auth — it is catalog data, not user data):

- Calls `listCachedInStock`.
- Groups by `modelNumber`, joins to `PRODUCT_CATALOG` for name/brand/category.
- Keeps models with ≥1 in-stock row; computes `bestPrice` (min, converted to a
  requested display currency), `bestDistributorId`, `storeCount`, `fetchedAt`.
- Optional `category` / `brand` / `maxPrice` inputs (server-side filter).
- Returns up to ~100 rows sorted by `bestPrice` ascending.

```ts
export interface AvailableProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  modelNumber: string;
  bestPrice: number;
  bestCurrency: string;
  bestDistributorId: string;
  storeCount: number;
  fetchedAt: number;
}
```

Register the router in `server/routers.ts`.

### 3. Client wrapper — `lib/server-catalog.ts` (new)

`fetchAvailable({ category?, brand?, maxPrice?, currency? })` → `AvailableProduct[]`
via the tRPC client, returning `[]` when the server is unconfigured or errors
(mirrors `lib/server-prices.ts`).

### 4. Board screen — `app/available.tsx` (new)

- A `useQuery` over `fetchAvailable`.
- Filter chips: **category** (from `getAllCategories`), **brand**, **price**.
- Rows: product name, best price, "in stock at N stores", a scarcity badge
  (reuse `ScarcityBadge` when availability data exists), tap → `/product/[id]`.
- Standalone fallback: when `!isServerConfigured()`, render the watchlist's
  in-stock products (via `getBestPrice`) with a "Connect to see all 121 products"
  banner.
- Loading skeleton + empty state ("Nothing in stock right now — check back").

### 5. Home section — `components/home/available-section.tsx` (new)

A compact section (top ~5 rows) with a "See all" header that routes to
`/available`. Mirrors `TrendingSection`'s structure. Rendered on Home above
Trending.

## Data Flow

1. The warmer populates `price_cache` for the catalog.
2. `catalog.available` reads the cache, groups by model, filters to in-stock.
3. The board renders; filters re-query (server-side).
4. Standalone → the watchlist fallback.

## Error Handling

- Server unconfigured / error → `[]` → the standalone fallback (never a dead screen).
- No in-stock rows → an empty state, not a blank list.
- Stale cache rows → excluded by the freshness window.

## Testing

- `tests/price-cache-instock.test.ts` (DB-gated) — `listCachedInStock` returns
  only in-stock, fresh rows.
- `tests/catalog-available.test.ts` — the grouping/ranking logic (pure helper
  `groupAvailable(rows, catalog, currency)`), including: drops models with no
  in-stock row, picks the min price, counts distinct stores, sorts ascending.
- `tests/available-screen.test.tsx` — renders rows; the standalone fallback path.
- Existing tests stay green.

## Success Criteria

- With a server, the board lists in-stock catalog products ranked by price, with
  working category/brand/price filters.
- Without a server, the board shows the watchlist's in-stock products and a
  connect prompt.
- `pnpm verify` stays green.

## Risks

- **Freshness** → the board shows "as of X ago"; it is cache-cadence fresh, not live.
- **Cache coverage** → the warmer may not have warmed every pair; the board shows
  what is cached, which is honest.
- **Cost** → one indexed scan per request; the query is bounded and cached by
  React Query on the client.
