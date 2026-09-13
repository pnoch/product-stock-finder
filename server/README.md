# Backend Guide

The Product Stock Finder backend: Express + tRPC v11 + Drizzle (MySQL) + email/password auth.

## Overview

The backend powers: account sync (watchlist/alerts/reminders/settings), server-side price
scraping with caching + a full-catalog warmer, live FX rates, LLM price insights, product
images, server-scheduled notification events, Expo push, and device management. When the
app runs without a configured backend it degrades gracefully to local-only mode.

## Router Reference

`server/routers.ts` exports `appRouter`. Procedures (all under `/api/trpc`):

- `system` — health/system (framework router)
- `auth.me`, `auth.logout`
- `sync.pull({ since })`, `sync.push({ items })` — protected; LWW + tombstones, see `sync-db.ts`
- `prices.get({ distributorId, modelNumber })`, `prices.uploadHistory(...)` — public
- `fx.get` — live FX rates
- `insights.get({ productId })` — LLM price insight
- `images.get({ productId })` — product image
- `notifications.uploadConfig`, `notifications.pull`, `notifications.registerPushToken`
- `devices.list`, `devices.current`, `devices.rename`, `devices.signOut`, `devices.cleanupStale`

## Files

- `db.ts` — Drizzle connection (`getDb()`), `upsertUser`, `getUserByOpenId`
- `sync-db.ts` — sync item upserts, tombstone purge, LWW conflict resolution
- `prices.ts` — server-side scraping via `resilientFetch` (from `lib/scrapers/resilient.ts`),
  circuit breakers, price cache; `startWarmer()` full-catalog warmer (guarded by `NODE_ENV`)
- `price-cache.ts`, `price-history.ts` (`mergeHistory`), `price-insights.ts` (`getInsight`),
  `product-images.ts` (`getProductImage`)
- `fx.ts` — `getFxRates()` live FX source
- `notifications.ts` — device notification configs + pending event pull (`upsertDeviceConfig`,
  `pullPendingEvents`)
- `push-notifications.ts` — Expo push token storage (`upsertPushToken`)
- `devices.ts` — device binding, labels, rename, sign-out, stale cleanup
- `storage.ts` — S3 helpers (`storagePut`)

## Database

Drizzle schema in `drizzle/schema.ts` — 15 tables: users, watchlistItems, priceAlerts,
backOrderReminders, appSettings, priceCache, priceHistory, priceInsights, productImages,
deviceNotificationConfigs, notificationEvents, notificationEventDeliveries, devicePushTokens,
deviceLabels, revokedDevices. Migrations in `drizzle/migrations/`; apply with `pnpm db:push`.

## Environment

- `DATABASE_URL` (MySQL), `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`,
  `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `OWNER_NAME`, `BUILT_IN_FORGE_API_URL`,
  `BUILT_IN_FORGE_API_KEY`
- `CORS_ALLOWED_ORIGINS` — comma-separated list of allowed browser origins (e.g.
  `http://localhost:8081,https://app.example.com`). Required when the web app is
  served from a different origin than the API (cross-origin dev). Not needed if
  the web build is hosted behind the same origin as the API.
- Expo runtime: `EXPO_PUBLIC_APP_ID`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_OAUTH_PORTAL_URL`

## Web Build

The web app exports as an SPA (`web.output: "single"` in `app.config.ts`), so
`pnpm build:web` produces a single `dist-web/index.html`. The API server hosts
it same-origin via `server/spa.ts` (`registerSpa`, mounted after `/api/*`):
static files served directly (`dist-web/sw.js` for web push, hashed
`/_expo/static/*` immutable, shell + SW `no-store`), unknown GET paths fall
back to `index.html` (SPA routing). There is no per-route server-rendered HTML.
Without a web export the server runs API-only.

## Web Push (VAPID)

Web push delivery requires three env vars (generate a keypair with
`node scripts/generate-vapid-keys.js`):

- `VAPID_SUBJECT` — a `mailto:` contact for the push service
- `VAPID_PUBLIC_KEY` — the VAPID public key
- `VAPID_PRIVATE_KEY` — the VAPID private key

The client needs the matching public key bundled as
`EXPO_PUBLIC_VAPID_PUBLIC_KEY`. Without these vars, web push silently no-ops
and the app keeps working (foreground pull only).

## Running & Testing

- Dev: `pnpm dev:server` (tsx watch). Build: `pnpm build` (esbuild → `dist/` + web export → `dist-web/`). Prod: `pnpm start`.
- Tests: `pnpm test` (vitest). DB-backed tests are gated on `RUN_DB_TESTS=1` + `TEST_DATABASE_URL`
  (e.g. `tests/sync-db.test.ts`, `tests/sync-e2e.test.ts`). Router tests use `appRouter.createCaller(ctx)`
  with a mock context (see `tests/*-router.test.ts`).