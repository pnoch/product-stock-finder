# Desktop Web-Preview Refresh Fix — Design

Date: 2026-09-06. Scope: make desktop Watchlist Refresh fetch live
prices when running outside Tauri (approved).

## Problem

`desktop/src/pages/Watchlist.tsx` `handleRefresh` tries Tauri
`check_all_prices`, and on failure calls
`storage.refreshWatchlistPrices()`, which only bumps `lastRefreshed`
timestamps (`lib/storage/watchlist.ts:148-156`) — no price is fetched.
The toast still says "Watchlist refreshed". Outside Tauri (web preview)
the button is a no-op that looks like success.

## Approach

Per-listing fetch through the existing public tRPC `prices.get`
endpoint using the desktop tRPC client. No new server API. Rejected:
new bulk endpoint (disproportionate scope), honest-labels-only (button
stays useless).

## Data flow

In `handleRefresh` (`desktop/src/pages/Watchlist.tsx`) only:

1. Try Tauri `invoke("check_all_prices", ...)` exactly as today.
2. On failure, if `getApiBaseUrl()` (from `../lib/api-base`) is
   non-empty: for every product listing, call
   `client.prices.get.query({ distributorId, modelNumber })` via
   `createTRPCClient()` (from `../lib/trpc`), max 3 concurrent
   (matches mobile `MAX_CONCURRENT_DEVICE_SCRAPEES`), each call in its
   own try/catch so one failure never aborts the rest.
3. Merge results with the pure `composeLiveListings(seeds, results)`
   helper from `lib/live-prices.ts` (same semantics as mobile: stale
   snapshots enrich history but are never presented as just-checked).
4. Persist per product with `storage.updateProductListings(productId,
   listings)` (bumps `lastRefreshed`, notifies watchers), then the
   existing `await refresh()`. The bare `storage.refreshWatchlistPrices()`
   timestamp-bump call is removed — `updateProductListings` already stamps
   refreshed products, and unrefreshed products must keep their old stamps.
5. If no server is configured, skip fetching entirely (no timestamp
   bump).

## Toasts

- At least one fresh snapshot: `"Refreshed X of Y prices"` where X =
  listings whose merged result carries a fresh snapshot and Y = total
  listings attempted.
- Server configured but zero fresh: existing `"Couldn't refresh
  prices"` error toast.
- No server and no Tauri: `"Live prices need a server connection or
  the Tauri app"`; no timestamp change, no success toast.

## Testing

- Source-guard test (style of `tests/shared-desktop-criticals.test.ts`):
  Watchlist page references `prices.get` and the `X of Y` toast, and no
  longer calls bare `refreshWatchlistPrices` as the refresh path.
- Unit tests for the refreshed/failed counting if extracted into a
  helper; otherwise covered by the guard.
- No component click-level test (desktop has no render harness).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new warnings),
  `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- No new server endpoints; no `prices.get` rate-limit changes (60/min
  stands; concurrency 3 keeps typical watchlists under it).
- No on-device scraping in web preview (distributor CORS).
- Tauri path, mobile code, and pull-to-refresh elsewhere untouched.
