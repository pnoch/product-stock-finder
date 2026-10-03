# Split `server/routers.ts` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move each inline sub-router out of `server/routers.ts` into `server/routers/<name>.ts`, leaving `routers.ts` as composition + re-exports. Pure move, no behavior change.

**Architecture:** Mirror the existing `server/routers/{discovery,trending,llm}.ts`. Each new file exports `<name>Router = router({ … })`; `appRouter` composes them. `tsc` enforces imports; the router test suite guards behavior.

**Tech Stack:** TypeScript, tRPC, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-split-routers-design.md`

---

## Conventions for every task

- Locate each inline router in `server/routers.ts` by its key: the block `  <name>: router({` through its matching `  }),`. (Approx current lines: auth 136-174, sync 175-335, prices 336-411, health 412-437, fx 438-444, insights 445-453, images 454-462, products 463-471, notifications 472-654, devices 661-712, sharedWatchlists 713-1089.)
- New file shape:
  ```ts
  import { router, ... } from "../_core/trpc";
  // …plus exactly the imports this router uses, moved out of routers.ts…
  export const <name>Router = router({ …block body… });
  ```
- In `server/routers.ts`: delete the block and any imports now used only by it; add `import { <name>Router } from "./routers/<name>";`; replace `  <name>: router({ … }),` with `  <name>: <name>Router,`.
- After each task: `pnpm check` must be 0 (tsc finds any missing/unused import), `pnpm test` green, `pnpm lint` 0 warnings.
- Never change a procedure's logic, name, or input/output schema.

---

## Task 1: helpers + the small routers (fx, insights, images, products, health)

**Files:**
- Create: `server/routers/helpers.ts`, `server/routers/fx.ts`, `server/routers/insights.ts`, `server/routers/images.ts`, `server/routers/products.ts`, `server/routers/health.ts`
- Modify: `server/routers.ts`

- [ ] **Step 1: Create `helpers.ts`** with the shared origin helpers moved verbatim from `routers.ts`:
  `LOCAL_ORIGIN_FALLBACK`, `cleanHttpUrl`, `getOrigin` (keep `export function getOrigin`).
- [ ] **Step 2: Extract `health.ts`** — move the `health` router **and** its cache (`HEALTH_CACHE_TTL_MS`, `healthCache`, `healthInFlight`) and `clearHealthCacheForTests` (keep it `export`ed). It uses `checkAllDistributors`, `getAllParserIds`, `mapWithConcurrency`.
- [ ] **Step 3: Extract `fx.ts`, `insights.ts`, `images.ts`, `products.ts`** — each small router with its imports.
- [ ] **Step 4: `routers.ts`** — compose (`health: healthRouter, fx: fxRouter, insights: insightsRouter, images: imagesRouter, products: productsRouter`), and re-export the test surface:
  ```ts
  export { getOrigin } from "./routers/helpers";
  export { clearHealthCacheForTests } from "./routers/health";
  ```
  (Remove the now-moved local definitions; if `getOrigin` is still used inside `routers.ts` — e.g. by a not-yet-extracted router — import it from `./routers/helpers` too.)
- [ ] **Step 5: Verify + commit**
  ```bash
  pnpm check && pnpm test && pnpm lint
  git add server/routers.ts server/routers/helpers.ts server/routers/health.ts server/routers/fx.ts server/routers/insights.ts server/routers/images.ts server/routers/products.ts
  git commit -m "refactor: extract small server routers + shared helpers"
  ```

---

## Task 2: auth, sync, prices

**Files:**
- Create: `server/routers/auth.ts`, `server/routers/sync.ts`, `server/routers/prices.ts`
- Modify: `server/routers.ts`

- [ ] **Step 1: Extract `sync.ts`** — move the `sync` router and the tombstone-purge consts (`lastTombstonePurgeAt`, `TOMBSTONE_PURGE_INTERVAL_MS`) it owns; imports from `./sync-db`, `./db`, `../shared/const.js`, `z`, etc.
- [ ] **Step 2: Extract `auth.ts`** — the `auth` router with its imports.
- [ ] **Step 3: Extract `prices.ts`** — the `prices` router with its imports.
- [ ] **Step 4: `routers.ts`** — compose `auth: authRouter, sync: syncRouter, prices: pricesRouter`.
- [ ] **Step 5: Verify + commit**
  ```bash
  pnpm check && pnpm test && pnpm lint
  git add server/routers.ts server/routers/auth.ts server/routers/sync.ts server/routers/prices.ts
  git commit -m "refactor: extract auth, sync and prices server routers"
  ```

---

## Task 3: notifications

**Files:**
- Create: `server/routers/notifications.ts`
- Modify: `server/routers.ts`

- [ ] **Step 1: Extract the `notifications` router** (the largest, ~183 lines) with its imports (`upsertDeviceConfig`, `pullPendingEvents`, `upsertPushToken`, `pruneDeviceToken`, `checkRateLimit`, the `notifications` server module, etc.). Preserve `testWebhook` exactly.
- [ ] **Step 2: `routers.ts`** — compose `notifications: notificationsRouter`.
- [ ] **Step 3: Verify + commit**
  ```bash
  pnpm vitest run tests/notifications-router.test.ts tests/webhook-alerts-router.test.ts && pnpm check && pnpm test && pnpm lint
  git add server/routers.ts server/routers/notifications.ts
  git commit -m "refactor: extract notifications server router"
  ```

---

## Task 4: devices + sharedWatchlists, finalize composition

**Files:**
- Create: `server/routers/devices.ts`, `server/routers/shared-watchlists.ts`
- Modify: `server/routers.ts`

- [ ] **Step 1: Extract `devices.ts`** (imports `listDevicesForUser`, `getDeviceBinding`, `renameDevice`, `signOutDevice`, `pruneStaleDevices`, etc.).
- [ ] **Step 2: Extract `shared-watchlists.ts`** — move the share router and `SHARED_WATCHLIST_MAX_ITEMS`; it uses `getOrigin` (import from `./helpers`), `watchlistItems`, `sharedWatchlists`, `sharedWatchlistMembers`.
- [ ] **Step 3: Finalize `routers.ts`** — `appRouter` should now contain only sub-router references (no inline `router({` blocks); keep `export { appRouter }`, `export type AppRouter = typeof appRouter`, and the helper re-exports. `routers.ts` should be short (composition + re-exports).
- [ ] **Step 4: Verify + commit**
  ```bash
  pnpm check && pnpm test && pnpm lint
  git add server/routers.ts server/routers/devices.ts server/routers/shared-watchlists.ts
  git commit -m "refactor: extract devices + sharedWatchlists; routers.ts is composition only"
  ```

---

## Task 5: Full verification + docs

- [ ] **Step 1: Run the full suite**
  Run: `pnpm check && pnpm lint && pnpm test && pnpm check:desktop && pnpm --dir desktop test`
  Expected: all green; lint 0 warnings (ratchet). If a DB is available, also `RUN_DB_TESTS=1 TEST_DATABASE_URL=... pnpm test:db`.
- [ ] **Step 2: Confirm `routers.ts` size dropped** and the public surface is intact (`grep -n "export" server/routers.ts` shows `appRouter`, `AppRouter`, `getOrigin`, `clearHealthCacheForTests`).
- [ ] **Step 3: Append the phase entry to `todo.md`**
  ```md
  ## Phase 1050: Split server/routers.ts into per-router modules

  - [x] Extracted the 11 inline sub-routers into `server/routers/<name>.ts` (auth, sync, prices, health, fx, insights, images, products, notifications, devices, shared-watchlists) plus `helpers.ts`; `routers.ts` is now composition + re-exports.
  - [x] Preserved the public surface (`appRouter`, `AppRouter`, `getOrigin`, `clearHealthCacheForTests`); pure move, no behavior change. `tsc 0`, lint 0 warnings, root + desktop suites green.
  ```
- [ ] **Step 4: Commit**
  ```bash
  git add todo.md
  git commit -m "Docs: split server routers phase entry (Phase 1050)"
  ```
