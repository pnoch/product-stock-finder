# Server-Side Price Scraping Design Spec

**Date:** 2026-08-12
**Phase:** 27 — Server-Side Price Scraping (hybrid cache + local fallback)
**Status:** Approved (brainstorming)

## Overview

Add a server-side price scraping service so clients (mobile + desktop) get live prices and stock status from a shared server cache instead of each device scraping independently. The server reuses the existing TypeScript parsers in `lib/scrapers/`, caches results in a new Drizzle table (with an in-memory fallback), refreshes near-expiry entries via an in-process background warmer, and exposes a single public tRPC endpoint. Clients try the server first and fall back to their existing local scraping when the server is unreachable or has no result.

This is the "scrape later" half of the Phase 26 "sync now, scrape later" decision.

## Goals

- Single shared source of truth for current prices/stock across all devices.
- No per-device duplicate scraping; mobile works even when background-task limits throttle local scraping.
- Graceful degradation: offline or server-less setups behave exactly as today (local scraping).
- Reuse the 25+ existing `lib/scrapers/` parsers — one parser set for mobile and server.
- Public endpoint — no login required (prices are non-sensitive product data).

## Non-Goals (out of scope this phase)

- Server-side price **history** — the server stores current snapshots only; clients keep building local `priceHistory` as today.
- Warming the full catalog or synced watchlists — the warmer only refreshes products that clients actually requested.
- New rate-limit/blocking heuristics beyond what `lib/scrapers` already provides.
- Multi-server cache coordination — assumes a single Express server instance.
- Changes to the desktop Rust scrapers themselves — only a server-first call is added to the poller flow.

## Architecture

**Approach A (chosen):** Single public tRPC endpoint + in-process background warmer.

```
Client (mobile/desktop)
   │  prices.get(distributorId, modelNumber)        (public, no auth)
   ▼
server/routers.ts ──► server/prices.ts
                        │
                        ├─► cache lookup (DB table | in-memory Map)
                        │      fresh?  ──► return snapshot
                        │      stale?  ──► return stale value + kick background refresh
                        │      miss?   ──► return null + kick background refresh
                        │
                        └─► background refresh (single-flight per key)
                              getParserByDistributorId → buildSearchUrl(model)
                              → fetchWithParser (rate-limited fetch | Playwright)
                              → parsePrice(html) → store { price, currency, stockStatus,
                                expectedDate, url, taxRate, fetchedAt }
```

The warmer runs on a `setInterval` in the server process and refreshes near-expiry entries so clients rarely pay scrape latency.

## Data Model

### Drizzle table `price_cache` (add to `drizzle/schema.ts`)

| Column          | Type            | Notes                                        |
| --------------- | --------------- | -------------------------------------------- |
| `distributorId` | `varchar(64)`   | PK (composite)                               |
| `modelNumber`   | `varchar(128)`  | PK (composite)                               |
| `price`         | `decimal(12,2)` | notNull                                      |
| `currency`      | `varchar(8)`    | notNull                                      |
| `stockStatus`   | `varchar(16)`   | notNull — `in_stock\|back_order\|out_of_stock\|unknown` |
| `expectedDate`  | `varchar(64)`   | nullable                                     |
| `url`           | `text`          | notNull — resolved product page              |
| `taxRate`       | `decimal(5,2)`  | nullable                                     |
| `fetchedAt`     | `bigint`        | notNull — epoch ms, TTL basis                |

Export `PriceCache` / `InsertPriceCache` types.

### In-memory fallback

A `Map<string, CacheEntry>` keyed by `` `${distributorId}:${modelNumber}` `` with the same fields. Used when `getDb()` returns null (no `DATABASE_URL`). Both backends expose the same interface so `server/prices.ts` doesn't care which is active.

### Cache semantics

- **Fresh:** `now - fetchedAt < TTL` (`TTL = 1 hour`).
- **Stale:** entry exists but older than TTL. Returned anyway (better than nothing), and a background refresh is triggered.
- **Miss:** no entry. Return `null` to the caller and trigger a background refresh.

## Server Price Service (`server/prices.ts`)

**`getPrice(distributorId, modelNumber): Promise<PriceSnapshot | null>`**

1. Look up the cache (DB or memory).
2. Fresh → return immediately.
3. Stale → return the stale snapshot immediately, kick a background refresh (fire-and-forget).
4. Miss → return `null`, kick a background refresh.
5. The background refresh: resolve parser via `getParserByDistributorId`; if none, bail. Build `buildSearchUrl(modelNumber)`, call `fetchWithParser(parser, url)` (reuses `lib/scrapers/utils.ts` — rate-limited fetch, or Playwright browser for `useBrowser` parsers), then `parsePrice(html)`. On success store `{ ...result, fetchedAt: Date.now() }`. On failure (network, blocked, parse null) log and store nothing — stale entry remains; a miss stays a miss.

**Single-flight:** a `Map<string, Promise>` keyed by `` `${distributorId}:${modelNumber}` `` dedupes concurrent refreshes for the same key. If a refresh is already in flight, new callers await the same promise instead of re-scraping.

**Warmer (`startWarmer()`):** a `setInterval` (every 5 min) that:
- Queries cache entries whose `fetchedAt < now - (TTL - 10min)` (near expiry).
- Refreshes them in the background, staggered with the parsers' `rateLimitMs` delays.
- Tracks in-memory entries too (same map iteration).
- Is best-effort: never blocks requests, failures are logged and skipped.
- Started at server boot. Because `server/_core/` is framework-level and off-limits, the warmer is started via a module-level `startWarmer()` call in `server/prices.ts` (imported by `server/routers.ts`, which `_core/index.ts` imports). Guard it so importing `server/prices.ts` in tests does not spawn the interval (e.g. only start when `process.env.NODE_ENV !== "test"`).

## tRPC Router

Add to `server/routers.ts`:

```
prices:
  get: publicProcedure
    input: { distributorId: string, modelNumber: string }
    → PriceSnapshot | null
```

`PriceSnapshot` shape: `{ price, currency, stockStatus, expectedDate, url, taxRate, fetchedAt }`. Public (no login). The lazy refresh happens server-side inside `getPrice`; the client never waits on a scrape.

## Client Integration

### Mobile

New `lib/server-prices.ts` with `fetchServerPrice(distributorId, modelNumber): Promise<PriceSnapshot | null>` that calls `trpcClient.prices.get.query({ distributorId, modelNumber })` with a short timeout (e.g. 4s). Returns `null` on timeout/failure. Because this runs from the background task (outside React), it uses a lazily-created module-level tRPC client via `createTRPCClient()` rather than the React `trpc` wrapper.

In `lib/background-price-check.ts` (both the background task and the foreground Check Now flow): try `fetchServerPrice` first → if a result comes back, apply it (append price point via existing `appendPricePoint`, update listing) → if `null`/unreachable, fall back to the existing local `fetchWithParser` path. The server result's `url` is used as the listing URL.

### Desktop (Rust poller)

The Tauri `start_price_poller` / `check_price_drops` commands add a server-first step: call the tRPC endpoint over HTTP (desktop already has `getApiBaseUrl()`), fall back to the Rust scrapers on failure/null. Keeps desktop behavior consistent with mobile. No changes to the Rust scraper implementations themselves.

### Offline behavior

If the server is unreachable, everything degrades to today's local scraping — no data loss, no user-facing errors.

## Error Handling

- Scrape failures never break the request: stale value or `null` is returned.
- Single-flight prevents duplicate concurrent scrapes for the same key.
- The warmer is best-effort and never blocks requests.
- `fetchServerPrice` on the client swallows all errors and returns `null` so the local fallback always runs.

## Testing

- `tests/price-cache.test.ts` — cache hit/stale/miss logic, TTL boundaries, single-flight dedup (two concurrent calls → one scrape), DB-vs-memory backend parity (memory backend fully testable without `DATABASE_URL`).
- `tests/prices-router.test.ts` — `prices.get` returns cached value; returns `null` on miss when scrape fails; works without auth (public procedure).
- Warmer test — near-expiry entries get refreshed, fresh ones skipped.
- Client fallback test — `fetchServerPrice` returns `null` on timeout/failure so the caller falls back.

## Files

**Modified:**
- `drizzle/schema.ts` — `price_cache` table + types
- `server/routers.ts` — `prices.get` procedure
- `lib/background-price-check.ts` — server-first flow with local fallback
- `desktop/src-tauri/src/lib.rs` — server-first step in poller commands

**New:**
- `server/prices.ts` — cache service, single-flight, warmer
- `server/price-cache.ts` — DB + memory cache backends (or folded into `prices.ts` if small)
- `lib/server-prices.ts` — mobile client helper
- `tests/price-cache.test.ts`
- `tests/prices-router.test.ts`
- `tests/server-prices.test.ts` (client fallback)

## Environment

No new env vars required. The server uses the existing `DATABASE_URL` (optional; memory fallback otherwise). Playwright browsers must be available on the server for `useBrowser` parsers (existing `lib/scrapers/browser.ts` requirement); fetch-only parsers need nothing extra.