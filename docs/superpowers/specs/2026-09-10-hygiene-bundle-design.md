# Hygiene Bundle — Design Spec (2026-09-10)

Eight verified micro-fixes in three sections. No new features, no UI redesign, no behavior change on success paths. Open questions flagged inline are resolved during planning, not implementation.

## §A — Search performance + dedup

**Files:** `desktop/src/pages/Search.tsx`, `desktop/src/components/SearchModal.tsx`, `app/search.tsx`, `shared/src/catalog.ts`.

- Memoize the Fuse index on `combinedCatalog` only; defer the query via `useDeferredValue` exactly like mobile (`app/search.tsx:223,257`). No per-keystroke index rebuild.
- One shared `SEARCH_OPTIONS` (keys/weights, `threshold: 0.4`, `minMatchCharLength: 2`, `ignoreLocation: true`); home resolved in planning (`shared/src/catalog.ts` preferred, desktop import must stay clean). All 5 sites use it.
- Delete dead exports `buildFuse`/`searchCatalogAsync` (zero callers) unless planning finds a consumer.
- `pendingTagsDerived` void-hacks on all three surfaces: consume for real or delete + fix deps (per-surface decision in planning); no behavior change.
- One shared price-fallback sorter carrying mobile's comment (`app/search.tsx:322-324`); mobile + both desktop surfaces use it.

## §B — Silent-failure audibility

**Files:** `lib/storage/idb-adapter.ts`, `desktop/src/pages/Settings.tsx`, `desktop/src/background.ts`.

- `removeItem`/`multiRemove`: warn + rethrow like `setItem` (`:65-68`). Add the module's first unit test (mocked failing backend at minimum if IDB is unavailable in vitest).
- Settings poller effect: await start/stop with failure toast + dev log; effect cleanup on unmount/toggle-off; failed start leaves UI showing OFF.
- No new UI beyond one toast; success paths unchanged.

## §C — Dead-code removal

**Files:** `desktop/src/background.ts`, `server/db.ts`.

- Delete unused Tauri `checkPriceDropsNow` wrapper (live path uses `lib/background-price-check`); retype-to-throw only if planning finds a reference use.
- Delete legacy `markPasswordResetTokenUsed`/`markEmailVerificationTokenUsed` (production uses atomic `consume*`); update the 5 mocking test files to the `consume*` surface if they mock prod seams rather than the legacy functions themselves.

## Non-goals

- Search relevance tuning; new sort options; poller scheduling changes; token-system redesign; any mobile UI changes beyond the shared sorter/comment.
