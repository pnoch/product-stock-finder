# Live FX Rates — Design

**Date:** 2026-08-13
**Status:** Approved
**Feature target:** v3.17

## Problem

`lib/currency.ts` ships static, approximate USD-base exchange rates for the 12 display currencies (USD, EUR, GBP, MYR, AUD, NZD, CAD, ZAR, THB, SGD, HKD, AED). Every conversion in the app (Best Deal card, watchlist summary, distributor analysis, price digest, price-drop alerts, savings totals, server-side notification evaluation) uses these frozen rates, so multi-currency totals drift from reality over time.

## Goal

Replace the frozen rates with live rates sourced from a server-side FX provider, cached with a 1-hour TTL and refreshed on app launch and on visiting Settings. All existing `convertPrice`/`getBestPrice`/`hasExchangeRate` call sites keep working unchanged — the currency module becomes dynamic without changing its interface.

## Decisions (user-approved)

1. **Scope:** mobile + server only. The desktop (Tauri Rust) app keeps its static rates (`desktop/src-tauri/src/lib.rs`); this is a display-only feature there and out of scope.
2. **Data source:** free no-key public API — `https://open.er-api.com/v6/latest/USD`. The URL is overridable via server env `FX_API_URL` so the provider can be swapped without code changes. No API key required.
3. **Cadence:** 1-hour TTL, matching the existing price TTL (`PRICE_TTL_MS`). Refresh triggers: app launch (if stored rates are stale) and Settings visit (where the currency is chosen). The app renders last-known rates instantly and refreshes in the background (stale-while-revalidate).

## Architecture

```
[FX provider API] ──GET──> [server/fx.ts] ──fx.get──> [mobile lib/fx.ts] ──> AsyncStorage fx_rates
                          (memory cache + single-       (4s timeout,          (last-known)
                           flight, 1h TTL)               null on failure)
                                │
                                └── setExchangeRates() ──> lib/currency.ts (effective rates)
```

Two independent processes each run the shared `lib/currency.ts` module and each apply live rates in-process:

- **Server process:** `server/fx.ts` calls `setExchangeRates()` on every successful provider fetch, so server-side conversions (`server/notifications.ts` alert evaluation) use live rates automatically (same module instance).
- **Mobile process:** `lib/fx.ts` applies stored/last-known rates at launch and refreshed rates after each fetch.

## Components

### Shared type (`lib/types.ts`)

Add `FxRatesResult` to `lib/types.ts` (the shared cross-platform types module, alongside `PriceSnapshot`/`ServerPriceResult`), so both server and mobile reference the same shape:

```ts
export interface FxRatesResult {
  rates: Record<string, number>; // effective rates (static ∪ live)
  fetchedAt: number | null; // null when never successfully fetched
}
```

### `server/fx.ts` (new)

A TTL-cached FX service, mirroring the established pattern in `server/prices.ts`:

- Module-level `let cache: { rates: Record<string, number>; fetchedAt: number } | null` and a single-flight `inFlight: Promise<...> | null`.
- `const FX_TTL_MS = 60 * 60 * 1000;` (1 hour).
- Provider URL from `process.env.FX_API_URL ?? "https://open.er-api.com/v6/latest/USD"`.
- `getFxRates(): Promise<FxRatesResult>`:
  - cache present and `now - cache.fetchedAt < FX_TTL_MS` → return cache.
  - cache present and stale → kick background refresh (non-awaited) and return current cache.
  - no cache → await a single-flight fetch; on failure fall back to static rates with `fetchedAt: null`.
  - **Never throws.**
- `refreshFxRates(): Promise<void>`: single-flight fetch of the provider URL via global `fetch` (already used throughout `server/`). Validates the response: `result === "success"` (or 2xx + JSON with a `rates` object); keeps only numeric rate values; sets the cache (`fetchedAt = Date.now()`); calls `setExchangeRates(parsedRates)` so the server process converts with live rates. On any error logs a warning and leaves the cache untouched.
- `clearFxCache()` exported for tests.

Response shape consumed (open.er-api.com): `{ result: "success", base_code: "USD", rates: { "AED": 3.67, ... } }`.

### `server/routers.ts` (modify)

Add a public procedure to the router:

```ts
fx: router({
  get: publicProcedure.query(async () => {
    return getFxRates();
  }),
}),
```

Returns `{ rates: Record<string, number>, fetchedAt: number | null }`.

### `lib/currency.ts` (modify)

Keep `EXCHANGE_RATES` as the static fallback and the source of truth for the 12 supported codes. Add a mutable live overlay:

```ts
let liveRates: Record<string, number> | null = null;

export function setExchangeRates(rates: Record<string, number> | null): void {
  liveRates = rates;
}

function effectiveRates(): Record<string, number> {
  return { ...EXCHANGE_RATES, ...liveRates };
}
```

- `convertPrice` and `hasExchangeRate` read `effectiveRates()` instead of `EXCHANGE_RATES`.
- `setExchangeRates(null)` restores static-only behavior (also the module default).
- Exporting `setExchangeRates` keeps the module's public surface a single addition; no other call sites change.

### `lib/fx.ts` (new)

Mobile-side FX helper, mirroring `lib/server-prices.ts`:

```ts
export async function fetchFxRates(): Promise<FxRatesResult | null>; // fx.get via createTRPCClient + 4s timeout, null on failure
export async function loadFxRates(): Promise<void>; // read stored fx_rates → setExchangeRates (last-known)
export async function refreshFxRates(): Promise<void>; // fetch → saveFxRates → setExchangeRates; swallows errors
export async function maybeRefreshFxRates(): Promise<void>; // only refresh if stored rates are missing or stale (> 1h)
```

- `maybeRefreshFxRates` returns early when stored rates are fresh, avoiding a network round-trip on every launch.
- All functions are best-effort and never throw to the caller.

### `lib/storage.ts` (modify)

- New key `fx_rates` storing `{ rates: Record<string, number>, fetchedAt: number }`.
- `getFxRates()` → returns `null` when absent/corrupt.
- `saveFxRates(payload)` — follows the existing enqueued single-key write pattern.
- Add `fx_rates` to `clearAllData()`.

### Wiring

- `app/_layout.tsx`: in a launch effect (alongside the existing sync/price-check setup), call `loadFxRates()` then `maybeRefreshFxRates()`.
- `app/(tabs)/settings.tsx`: in the Settings screen (e.g. the existing `useEffect` that loads settings), call `maybeRefreshFxRates()` so visiting Settings refreshes rates when the user is about to read or change the display currency.

## Error handling & fallback

Every layer degrades gracefully; conversions always have a value:

1. Live rates (fresh) → used.
2. Live rates (stale) → last-known used, background refresh attempted.
3. No live data (first launch, no server, provider down) → static `EXCHANGE_RATES`.

- Server fetch failure: log warning, return static with `fetchedAt: null`, never throw.
- Mobile fetch failure/timeout: return null, keep whatever is already applied.
- Corrupt stored payload: `getFxRates` returns null; next successful refresh overwrites it.
- A provider missing a supported currency code: effective merge `{...static, ...live}` keeps the static rate for that code.

## Testing

- **`tests/fx.test.ts`** (new, server service): mock global `fetch` —
  - success: parses rates, sets cache + applies via `setExchangeRates`, returns fresh data
  - fresh cache: no second fetch
  - stale cache: returns cached while a background refresh is triggered
  - failure (network/404/bad shape): returns static rates with `fetchedAt: null`, never throws
  - single-flight: two concurrent `getFxRates` calls with an empty cache share one fetch
- **`tests/currency.test.ts`** (extend): `setExchangeRates` —
  - `convertPrice` uses live rates when set
  - falls back to static rates for codes missing from the live set
  - `setExchangeRates(null)` restores static-only behavior
- **`tests/storage.test.ts`** (extend): `fx_rates` round-trip + corrupt-payload → null.
- **`tests/fx-client.test.ts`** (new, mobile helper): `maybeRefreshFxRates` skips when stored rates are fresh; `refreshFxRates` persists + applies on success and is a no-op on failure (mocked trpc client + in-memory storage).

## Non-goals

- No desktop (Tauri Rust) changes — static rates stay there.
- No UI changes — rates feed existing displays only.
- No currency-code additions or settings changes.
- No keyed/FX-pro provider support beyond the env-overridable URL.

## Files touched

- New: `server/fx.ts`, `lib/fx.ts`, `tests/fx.test.ts`, `tests/fx-client.test.ts`
- Modify: `server/routers.ts`, `lib/types.ts`, `lib/currency.ts`, `lib/storage.ts`, `app/_layout.tsx`, `app/(tabs)/settings.tsx`, `tests/currency.test.ts`, `tests/storage.test.ts`

## Open questions

None.
