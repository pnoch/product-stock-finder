# Backend Guide

The Product Stock Finder backend: Express + tRPC v11 + Drizzle (MySQL) + Manus OAuth.

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
- Expo runtime: `EXPO_PUBLIC_APP_ID`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_OAUTH_PORTAL_URL`

## Running & Testing

- Dev: `pnpm dev:server` (tsx watch). Build: `pnpm build` (esbuild → `dist/`). Prod: `pnpm start`.
- Tests: `pnpm test` (vitest). DB-backed tests are gated on `RUN_DB_TESTS=1` + `TEST_DATABASE_URL`
  (e.g. `tests/sync-db.test.ts`, `tests/sync-e2e.test.ts`). Router tests use `appRouter.createCaller(ctx)`
  with a mock context (see `tests/*-router.test.ts`).