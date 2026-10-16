# Search → Preview → Track → Alert → Restart verification

Date: 2026-10-18

## Goal

Prove the launch-critical workflow end to end: an untracked catalog product found
through search can be previewed, added to the watchlist, given a price alert,
and both survive an app restart.

## Background

The session added an untracked-product preview (search result → detail with
"Add to Watchlist") and a currency-prefixed alert input. Existing tests cover
the pieces in isolation:

- `tests/discover-search-integration.test.tsx` — search screen wiring (mocked storage).
- `tests/use-live-prices.test.tsx` — `allowCatalog` fallback returns the catalog product.
- `tests/storage.test.ts` / `tests/storage-alerts.test.ts` — `addToWatchlist` / `addAlert` persist.

No test covers the pieces together, and nothing proves persistence across a
restart of the real app.

## Automated coverage (new test)

`tests/workflow-track-alert-restart.test.ts` (vitest, real `createStorage`,
no React):

1. Create storage over adapter A.
2. `addToWatchlist` with a catalog-shaped product (`mikrotik-crs518`,
   empty listings, `isWatched: true`).
3. `addAlert` with an active drop alert on that product (`targetPrice 900`,
   `currency "USD"`).
4. Create a **new** storage instance over the same adapter A (simulates app
   restart; AsyncStorage is re-read from disk).
5. Assert: watchlist contains the product with `isWatched`; alerts contain the
   alert with `isActive: true`, matching target price and currency.

This pins the persistence contract the UI depends on. It is deliberately not a
component test — the pieces are already component-tested; the gap is the
storage round-trip.

## Emulator verification (no code change)

Drive the installed release APK on `emulator-5566`:

1. Discover → search `crs518`.
2. Tap the result card body → untracked preview opens with "Add to Watchlist".
3. Tap "Add to Watchlist" → header flips to tracked controls.
4. Scroll to Price Alert → enter `900` → Add Alert → success toast.
5. `am force-stop` + relaunch.
6. Verify: Watchlist shows CRS518; Alerts tab shows the active $900 alert.

Evidence screenshots under `/tmp/opencode/psf-evidence/`.

## Acceptance criteria

- New test passes and the full `pnpm verify` gate stays green.
- Emulator flow completes with product and alert surviving the restart.
- No production code changes required (test-only commit) unless the flow
  exposes a bug, in which case the bug is fixed with its own regression test.

## Out of scope

- Server sync paths (local-only emulator), notification delivery, desktop flow.
