# Server-Side Health Checks — Design Spec (2026-09-10)

Web/PWA desktop users get Health "Test All" failures: the page only calls Tauri's `check_distributor_health`. Client-side fetching was rejected (CORS marks everything blocked); graceful-disable was rejected (no feature). This spec adds a server-side check endpoint plus a desktop fallback. Sub-project (a) of desktop web viability; OAuth web path is a separate spec.

## §A — Server `health.check`

New `server/health.ts` exporting `checkAllDistributors()`: builds the existing `createHealthService` (`lib/scrapers/health.ts:268`) with a tiny in-memory `StorageAdapter` (`lib/storage/adapter.ts:1` — breaker state only; history writes go nowhere), then calls `testAllDistributors()` (concurrency 3, probe models, `classifyProbeOutcome` — all reused, zero new scraping logic). The client persists results through its own service, exactly as desktop does with Tauri results today.

Router entry mirrors `prices.get`: `health: { check: publicProcedure.query(...) }` — public (health data is not sensitive) with stricter rate limiting, `checkRateLimit(ctx, "health.check", 5, 60_000)` (25 distributor fetches per call vs 1 for prices). Response is `DistributorHealth[]`, identical to Tauri's shape — no client save/stats changes.

Tests: router-level test with mocked `server/health`, plus a contract test on the real function (fetch-level mocking per per-scraper-test convention; exact seam resolved in planning).

## §B — Desktop web fallback

`desktop/src/pages/Health.tsx` `runTest`: try `invoke("check_distributor_health")` as today; only on invoke failure call `client.health.check.query()` via the existing `createTRPCClient` (same form as `server-notifications.ts`). Progress for the server path is local animation (no progress channel in v1; exact form in planning). The post-fetch path (`setHealth`, `saveDistributorHealth`, `recordSample` loop, stats) stays shared and untouched. Server failure falls into the existing `healthError` box — no new error UI. Tauri remains the default; zero behavior change in the shell.

## Non-goals

- Progress streaming; result caching; OAuth web path (separate spec); mobile changes; new scraping/classification logic.
