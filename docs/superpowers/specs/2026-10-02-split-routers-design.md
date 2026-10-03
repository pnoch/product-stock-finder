# Split `server/routers.ts` — Design Spec

**Date:** 2026-10-02
**Goal:** Break the 1090-line `server/routers.ts` into focused per-router modules under `server/routers/`, mirroring the existing `discovery.ts` / `trending.ts` / `llm.ts`, with no behavior change.

## Current structure

`server/routers.ts` holds one `appRouter` (line 133) whose body inlines eleven sub-routers (`auth`, `sync`, `prices`, `health`, `fx`, `insights`, `images`, `products`, `notifications`, `devices`, `sharedWatchlists`) alongside the already-extracted `system`, `discovery`, `trending`, `llm`, plus file-local helpers (`getOrigin`, `cleanHttpUrl`, tombstone-purge consts, the health cache, `SHARED_WATCHLIST_MAX_ITEMS`).

## Design

Extract each inline router into `server/routers/<name>.ts`, exporting `<name>Router`; `routers.ts` becomes composition + re-exports.

**New files:**
- `server/routers/auth.ts` → `authRouter`
- `server/routers/sync.ts` → `syncRouter` (owns the tombstone-purge consts)
- `server/routers/prices.ts` → `pricesRouter`
- `server/routers/health.ts` → `healthRouter` (owns the health cache + `clearHealthCacheForTests`)
- `server/routers/fx.ts` → `fxRouter`
- `server/routers/insights.ts` → `insightsRouter`
- `server/routers/images.ts` → `imagesRouter`
- `server/routers/products.ts` → `productsRouter`
- `server/routers/notifications.ts` → `notificationsRouter`
- `server/routers/devices.ts` → `devicesRouter`
- `server/routers/shared-watchlists.ts` → `sharedWatchlistsRouter` (owns `SHARED_WATCHLIST_MAX_ITEMS`)
- `server/routers/helpers.ts` → `getOrigin`, `cleanHttpUrl`, `LOCAL_ORIGIN_FALLBACK` (shared by the share router; re-exported from `routers.ts`)

**`server/routers.ts` after:** imports the sub-routers, defines `appRouter` composing them (`system: systemRouter`, `auth: authRouter`, …), and preserves the public surface so no importer changes:
- `export { appRouter }` (used by `server/_core/index.ts`)
- `export type AppRouter = typeof appRouter`
- `export { getOrigin }` (used by `tests/share-origin.test.ts`)
- `export { clearHealthCacheForTests }` (used by `tests/health-check-cache.test.ts`)

**Rules:** pure code movement — no logic, signature, or behavior changes. Router-specific imports move to their file; `routers.ts` keeps only what composition needs. Watch for a circular import if a sub-router imports a helper from `routers.ts` — helpers live in `helpers.ts`/the owning router to avoid that.

## Testing

- No new tests required (pure move); the existing suite is the guard: `tests/notifications-router.test.ts`, the router/auth/sync/health/share tests, and the DB-gated server tests all pass unchanged.
- `pnpm check` (tsc proves every import) and `pnpm lint` (0-warning ratchet) must stay green at each step.
- `server/_core/index.ts` and the two helper-importing tests must compile without edits.

## Out of scope

- Renaming or refactoring any router's logic/procedures.
- Extracting shared `procedure` middleware changes.
- `lib/sync.ts` (the other large module) — a separate effort if wanted.

## File summary

| Change | Files |
|--------|-------|
| New | 12 files under `server/routers/` (11 routers + `helpers.ts`) |
| Modified | `server/routers.ts` (composition + re-exports) |
| Unchanged importers | `server/_core/index.ts`, `tests/share-origin.test.ts`, `tests/health-check-cache.test.ts` |
