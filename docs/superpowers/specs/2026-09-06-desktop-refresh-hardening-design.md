# Desktop Refresh Hardening — Design

Date: 2026-09-06. Scope: timeout + progress for server price
refresh (approved over abort/parallel rework).

## Problem

`fetchServerPricesForWatchlist` (`desktop/src/pages/Watchlist.tsx`)
awaits each `prices.get` with no timeout: one hung query stalls its
worker (and that product's remaining listings) indefinitely. The
Refresh button shows only a spinner — no progress feedback.

## Approach

Per-query timeout raced into the existing miss path + progress
callback on the existing pool. Same 3 workers, same rate profile.

## Timeout

- `const QUERY_TIMEOUT_MS = 20_000` beside
  `MAX_CONCURRENT_SERVER_FETCHES`.
- Each listing query raced against a timeout rejection; timeouts
  land in the existing per-listing try/catch → `null` (miss), worker
  moves on. No other control-flow change.
- Helper signature gains optional `onProgress?: (done: number,
  total: number) => void` (called per attempted listing, misses
  included; existing return shape unchanged).

## Progress

- `handleRefresh` passes a setter into a `refreshProgress` state;
  Refresh button label shows "Refreshing x/y" while active
  (mirroring the existing Check-Now progress pattern); cleared in
  `finally` alongside `refreshing`.
- Tauri path unchanged (no progress there — out of scope).

## Testing

- Source-guard tests: timeout const, `onProgress` wiring, progress
  label. No timing-based unit tests (flaky by construction).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Abort-on-unmount, parallelism/rate-limit changes, server changes.
