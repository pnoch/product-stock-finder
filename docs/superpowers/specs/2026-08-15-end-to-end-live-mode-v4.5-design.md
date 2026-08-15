# End-to-End Live Mode v4.5 — Design Spec

## Goal

Make backend connectivity explicit and live price data user-facing in the Expo app, while keeping the current local-only mode as a graceful fallback. The app is already "backend-first with silent graceful degradation": every server call is wrapped in try/catch and the app functions identically without env vars. There is no explicit connectivity signal, no health probe, and product detail/compare screens render prices only from AsyncStorage — live prices flow only through launch/background/manual `checkPriceDropsNow` runs.

v4.5 delivers three user-visible outcomes:
1. **Transparency:** a single source of truth for connection state, surfaced as a Home header badge (three states) and a Settings Connection card.
2. **On-demand live refresh, both levels:** per-product "Refresh" on product detail + compare, and a watchlist-wide "Refresh all".
3. **Live-as-primary rendering:** product detail, compare, and watchlist cards render React Query live price snapshots merged over the AsyncStorage seed, with AsyncStorage remaining the persisted source of truth.

Scope: **Expo app only** (iOS/Android/web). The Tauri desktop client is out of scope. No server changes are required — the existing `prices.get`, `system.health`, `/api/health`, and `fetchServerPrice` machinery is reused.

## Architecture Overview

Two sources of truth with a clean boundary:

- **AsyncStorage** remains the source of truth for *persisted* state (watchlist, alerts, reminders, settings). Unchanged behavior.
- **React Query** becomes the source of truth for *transient live price snapshots*. This phase establishes the app's first real `useQuery` consumers (`QueryClientProvider` + `trpc.Provider` are already provisioned in `app/_layout.tsx:174-187,249-250`).

Data flow for live prices:

```
AsyncStorage seed (getWatchlist + sample fallback)
        │
        ▼
useLiveProduct / useLiveWatchlist
   ├─ useQueries per (distributorId, modelNumber) → prices.get via fetchServerPrice
   ├─ applyServerPrice(listing, serverResult)  (pure merge)
   ├─ compose liveListings
   └─ persist merged listings via updateProductListings (debounced, on success)
        │
        ▼
screens render liveListings (price/stock/history/lastChecked)
```

Failure path: a query that fails or times out leaves the seed listing untouched; screens show the existing `lastChecked` staleness. Explicit refresh failures surface a toast.

## 1. Connection Layer

### `hooks/use-connection.ts` (new)

Built on React Query, consistent with the live-data approach:

- **Probe:** `useQuery(["connection"], () => checkHealth())` where `checkHealth()` is a small exported function that `fetch`es `${getApiBaseUrl()}/api/health` with a ~3s timeout and resolves `true` on 2xx, `false` on non-2xx, timeout, or empty base URL. Plain GET, no auth, no credentials needed.
- **Refetch policy:** on mount, on app-state active (`AppState.addEventListener("change", ...)` where state becomes "active"), and via `refetchInterval: 60_000`.
- **Status derivation:** exported pure function `deriveConnectionStatus({ reachable: boolean; isAuthenticated: boolean }): ConnectionStatus` where `ConnectionStatus = "connected" | "signed-out" | "offline"`:
  - `reachable && isAuthenticated` → `"connected"`
  - `reachable && !isAuthenticated` → `"signed-out"`
  - `!reachable` → `"offline"`
  - `isAuthenticated` comes from the existing `useAuth()`.
- **Exposed value:** `{ status: ConnectionStatus, reachable: boolean, lastCheckedAt: number | null, refetch: () => void }`.

### Home badge (`app/(tabs)/index.tsx`)

A small status pill in the Home header:
- `"connected"` → green dot + "Connected"
- `"signed-out"` → amber dot + "Signed out"; tap navigates to Settings
- `"offline"` → red dot + "Offline"

Colors come from theme tokens via `useColors()` (success/warning/error) — no hardcoded brand colors.

### Settings Connection card (`app/(tabs)/settings.tsx`)

New section above the existing Account/sign-in area:
- Status text (Connected / Signed out / Offline) with a colored dot
- "Last checked" timestamp (relative)
- Sign-in CTA reusing the existing "Sign in to sync" row (`settings.tsx:494-521`) when signed out
- A short note that live refresh requires the backend (only when `"offline"`)

The hook is the single source of truth for both surfaces.

## 2. Live Price Data Layer

### `lib/live-prices.ts` (new — pure helpers)

- **`applyServerPrice(listing: DistributorListing, serverResult: ServerPriceResult | null): DistributorListing`**
  - `serverResult == null` → returns `listing` unchanged.
  - Else: when `snapshot` is present, override `price`, `currency`, `stockStatus`, `expectedDate`, `url`, and set `lastChecked = Date.now()`. Always compute `priceHistory = appendPricePoint(mergePriceHistory(listing.priceHistory, serverResult.history), snapshotPoint, 90)` when `history` is non-empty (reuses `lib/price-history.ts` pure helpers). Build the snapshot `PricePoint` from the snapshot's price/currency/date the same way `refreshListing` does (`lib/background-price-check.ts:78-83`).
  - No network, no storage, no side effects.

- **`deriveListingQueries(product: Product, listings: DistributorListing[])`**
  - Returns an array of React Query configs: `{ queryKey: ["price", distributorId, modelNumber], queryFn: () => fetchServerPrice(distributorId, modelNumber), staleTime: 60_000, retry: 1 }`, one per listing, with a stable identity across renders (memoized upstream).

### `hooks/use-live-prices.ts` (new — React Query hooks)

**`useLiveProduct(productId: string)`**:
1. Seeds product + listings from `getWatchlist()` with `SAMPLE_LISTINGS`/`PRODUCT_CATALOG` backfill fallback — the same lookup/backfill logic the detail screen's `loadData` performs today (`app/product/[id].tsx:427-449`), extracted into the hook so both share it.
2. `useQueries({ queries: deriveListingQueries(...) })` to fan out one query per listing.
3. Composes `liveListings`: each seed listing mapped through `applyServerPrice` with its query result.
4. On any successful query result, persists the composed product's listings via `updateProductListings(productId, liveListings)` (debounced ~500ms per product, using a `useEffect` over the results).
5. Exposes `{ product, listings: liveListings, isRefreshingAny, refresh, lastUpdatedAt }` where `refresh()` invalidates the `["price", ...]` keys for this product's listings.

**`useLiveWatchlist()`**:
1. Seeds the whole watchlist from `getWatchlist()`.
2. `useQueries` across every listing of every product.
3. Composes per-product live listings; exposes `{ products, isRefreshingAny, refreshAll, lastUpdatedAt }`.
4. Same persistence behavior as `useLiveProduct` per product.

**Identity/loop rules:** hooks are called at top level. The seed load happens first (fast AsyncStorage read in the hook body via a `useEffect`-driven state or a storage-read hook); the `useQueries` array is derived from the loaded seeds, so it is stable. First render may show a lightweight loading state until seeds resolve, then queries mount.

**Persistence note:** `updateProductListings` writes trigger `storage.setOnChange` → sync dirty-marking → push, consistent with the existing background-check persistence (`lib/background-price-check.ts:195`). This is the current behavior for price persistence and is left as-is.

### Query keys

- `["price", distributorId, modelNumber]` — one cache slot per distributor/model; cacheable across screens (detail, compare, watchlist share the same slots).
- `["connection"]` — health probe.

## 3. Screen Integration

### Product detail (`app/product/[id].tsx`)

- Replace the `loadData`-populated `listings` local state with `useLiveProduct(id)` results for everything that renders listing data: distributor rows (`:1469-1699`), `PriceSparkline` history (`:1572-1578`, chart modal `:1898-1905`), best-deal card, `lastChecked` timestamps (`:1626-1647`), stock badge + expected date.
- The existing **Refresh** button (`:1061-1093`) now calls `live.refresh()` (server-first invalidation) instead of `loadData`, with a spinner while `isRefreshingAny`.
- Keep the alert/reminder/stock-watch/insight/image flows as-is.

### Compare (`app/compare/[id].tsx`)

- Switch `listings` to `useLiveProduct(id)`: `chartSeries` memo (`:590-608`), current-prices table (`:886-1005`), and `CheapestRegionCard` (`:238-393`) read live history/snapshots.
- Add a **Refresh** button in the header (`:650-688`) calling `refresh()`, and a `useFocusEffect` reload so returning from detail after a refresh picks up fresh data (the screen currently loads only on mount `:410-471`).

### Watchlist (`app/(tabs)/watchlist.tsx`)

- Switch card data (best price `:112`, stock badge `:113-117`, distributor count `:118`, last refreshed `:232-245`, price-drop % `:183-214`) to `useLiveWatchlist()`.
- Add a **"Refresh all"** header action beside the existing "Check Now" (`:388-412`) that calls `refreshAll()`; reuse the existing progress-bar UI (`:331-346,522-535`) keyed off `isRefreshingAny` counts. Keep "Check Now" as the deep full check (alerts/restocks/digest/scrape fallback) — the two buttons are labeled distinctly.
- Wire the existing pull-to-refresh `RefreshControl` (`:299-304`) to `refreshAll()` (in addition to its current behavior).
- Add `useFocusEffect` reload (currently mount-only `:282-284`).

### Home (`app/(tabs)/index.tsx`)

- Add the connection badge to the header (Section 1).

## 4. Error Handling & Fallback

- **Query failure/timeout:** `fetchServerPrice` already returns `null` on 4s timeout/error/empty snapshot (`lib/server-prices.ts:6-23`). `applyServerPrice(listing, null)` returns the seed unchanged. Screens show existing `lastChecked` staleness. No crash, no blank state.
- **Explicit refresh failure:** if `refresh()`/`refreshAll()` yields no successful results for the targeted listings, show the existing toast/snackbar pattern with "Couldn't refresh prices".
- **No env / empty base URL:** health resolves offline, queries fail-fast → the app stays in today's local-only mode; badge reads "Offline" (or "Signed out" if reachable but unauthenticated).
- **Non-goal:** background task, sync engine, `checkPriceDropsNow`, and `cleanupStaleDevices` are unchanged. The live layer is additive.

## 5. Testing

- `tests/live-prices.test.ts` — pure `applyServerPrice`: snapshot present (price/stock/url/lastChecked override + history merge/append), snapshot absent (history-only merge), `null` result returns input unchanged. Plus `deriveConnectionStatus` full 3-state table. Plus `checkHealth` (mocked fetch: 2xx true, non-2xx false, network error false, empty base URL false).
- `tests/use-live-prices.test.tsx` — `renderHook` with a `QueryClientProvider` and mocked `fetchServerPrice`: seed renders immediately, server result hydrates the listing, `refresh()` invalidates and refetches, successful fetch persists via `updateProductListings` (debounced), failure keeps the seed.
- Screen integration is verified via the hook tests + existing screens' typecheck; no new end-to-end screen tests.

## Files

**New:**
- `hooks/use-connection.ts`
- `hooks/use-live-prices.ts`
- `lib/live-prices.ts`
- `tests/live-prices.test.ts`
- `tests/use-live-prices.test.tsx`

**Modified:**
- `app/(tabs)/index.tsx` (Home header badge)
- `app/(tabs)/watchlist.tsx` (live data + "Refresh all" + focus reload)
- `app/(tabs)/settings.tsx` (Connection card)
- `app/product/[id].tsx` (live data + refresh wiring)
- `app/compare/[id].tsx` (live data + refresh + focus reload)

**Unchanged:** `lib/background-price-check.ts`, `lib/sync.ts`, `lib/server-prices.ts`, `lib/price-history.ts`, all server modules, `lib/_core/*`, `server/_core/*`.

## Out of Scope

- Tauri desktop client
- Server-side changes (endpoints, schema)
- Changing the background task / `checkPriceDropsNow` semantics
- Requiring sign-in (local-only mode remains fully functional)
