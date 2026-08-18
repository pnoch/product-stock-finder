# AGENTS.md — Product Stock Finder

Guidance for AI coding agents working in this repository. Read this before touching any code.

## Project Overview

**Product Stock Finder** (formerly "Stock Tracker Pro") is an Expo/React Native mobile + web app for tracking product availability and prices across 25 global electronics distributors (MikroTik, Ubiquiti networking gear focus). Users maintain a watchlist, set price alerts, schedule back-order reminders, watch for restocks, and compare price history across distributors.

- **App name in UI:** "Product Stock Finder" (see git log — was renamed from "Stock Tracker Pro"; do not revert)
- **Bundle ID:** `com.app.stock_tracker_pro`
- **Platform targets:** iOS, Android, Web (Expo web)
- **State:** Local-first with optional backend sync. AsyncStorage is the source of truth when signed out; when signed in, `lib/sync.ts` syncs watchlist/alerts/reminders/settings with the server (last-write-wins + tombstones, server-authoritative timestamps). Live scraping runs through `lib/scrapers/` (plain HTTP → headless browser escalation with circuit breakers). The backend (Express + tRPC + Drizzle) is fully integrated — see server routers below. CRS804 + CRS326 are auto-seeded from `lib/sample-data.ts` at first launch so Home/Watchlist/Product Detail have price history immediately.

## Tech Stack

| Layer              | Tech                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Expo SDK 54, React Native 0.81, React 19, Expo Router 6 (typed routes, react compiler enabled)                                          |
| Language           | TypeScript 5.9 (strict)                                                                                                                 |
| Styling            | NativeWind 4 (Tailwind) + inline styles. Theme tokens in `theme.config.js`, surfaced via `lib/_core/theme.ts` and `hooks/use-colors.ts` |
| State              | AsyncStorage (`lib/storage.ts`) as local source of truth + backend sync (`lib/sync.ts`). React Query + tRPC v11 client (`lib/trpc.ts`) |
| Notifications      | expo-notifications (local + server-scheduled events), expo-background-task for price-drop polling, server push (expo + push tokens)    |
| Charts             | react-native-svg (hand-rolled SVG polylines — no chart library)                                                                         |
| Scraping           | `lib/scrapers/` — typed parsers per distributor, `resilientFetch` (retry/backoff, plain→browser escalation, circuit breaker, blocked detection) |
| Backend            | Express + tRPC v11 + Drizzle (MySQL) + Manus OAuth. See `server/README.md`. Routers: sync, prices, fx, insights, images, notifications, devices |
| Package manager    | pnpm (via corepack; `packageManager: pnpm@9.12.0`). Node linker hoisted (`.npmrc`).                                                     |

## Commands

```bash
pnpm dev          # concurrently runs API server (tsx watch) + Metro (expo start --web --port 8081)
pnpm dev:server   # backend only
pnpm dev:metro    # metro/web only
pnpm check        # tsc --noEmit  (typecheck — run before claiming done)
pnpm lint         # expo lint (ESLint flat config, eslint-config-expo)
pnpm format       # prettier --write .
pnpm test         # vitest run
pnpm db:push      # drizzle-kit generate && migrate (requires DATABASE_URL)
pnpm build        # esbuild bundle server to dist/
pnpm start        # production node server
pnpm android      # expo start --android
pnpm ios          # expo start --ios
pnpm qr           # generate dev QR code
```

**Always run `pnpm check` and `pnpm lint` after non-trivial changes.** The project keeps TypeScript at 0 errors (see checkpoint commit messages).

## Directory Layout

```
app/                    Expo Router routes (file-based)
  _layout.tsx           Root layout — seeds CRS804 + CRS326, sets up notifications,
                        background price-check task, sync engine (setupSync), push-token
                        registration, server notification pull, fx rate loading, device
                        cleanup, tRPC/QueryClient providers
  (tabs)/               Bottom-tab screens: index (Home), watchlist, alerts, settings
  product/[id].tsx      Product detail (largest screen — ~1187 lines)
  compare/[id].tsx      Multi-distributor price history comparison chart
  search.tsx            Add-product search
  oauth/callback.tsx    Manus OAuth callback (backend auth flow)
  dev/theme-lab.tsx     Theme dev playground
components/             Reusable UI (PriceSparkline, ScreenContainer, HapticTab, IconSymbol,
                        notification-center, connection-badge)
components/ui/          IconSymbol (iOS .ios.tsx + cross-platform .tsx with Android/web mappings)
lib/                   App logic
  types.ts             Core domain types (Product, DistributorListing, PriceAlert, SyncItem, etc.)
  storage.ts           AsyncStorage CRUD + sync meta (watchlist, alerts, reminders, stock
                       watches, settings, digest snapshot, fx rates, notification history)
  sync.ts              Sync engine (setupSync, syncNow): pull/push, LWW merge, tombstones
  history-sync.ts      Price-history backfill/upload to server
  scrapers/            Distributor parsers + resilient.ts (resilientFetch, breakers, classifier).
                       browser.ts = node Playwright escalation; browser.web.ts = web stub with the
                       same export surface (keeps playwright out of the web bundle — guarded by
                       tests/scrapers/browser-web.test.ts)
  distributors.ts      Static distributor database (25 entries)
  catalog.ts           Pre-loaded product catalog
  sample-data.ts       Seeded 10-point 90-day price history per distributor (CRS804, CRS326)
  currency.ts          Static exchange rates, convertPrice, formatPrice, getBestPrice
  fx.ts                Live FX rates from server (loadFxRates, maybeRefreshFxRates)
  live-prices.ts       Live price fetching (server-first, local fallback), connection status
  server-prices.ts     tRPC wrappers for prices.get / prices.uploadHistory
  server-insights.ts   tRPC wrapper for insights.get (LLM price insight)
  server-images.ts     tRPC wrapper for images.get (product image)
  server-notifications.ts  tRPC wrappers for notifications.uploadConfig/pull
  push-token.ts        Expo push token registration
  notifications.ts     expo-notifications helpers (stock/price/back-order/test, event dedup)
  background-price-check.ts   TaskManager + expo-background-task price-drop polling
  devices.ts           Device list/rename/sign-out/cleanup via tRPC
  device-id.ts         Persistent device id generation
  device-revoked.ts    Device-revoked handling (sign-out on other device)
  price-chart.ts, price-history.ts, price-digest.ts, restock.ts, tax.ts, region-filter.ts,
  best-deal.ts, distributor-analysis.ts, watchlist-summary.ts, watchlist-org.ts, last-refreshed.ts
  health.ts            Distributor health probe (classifyResult → classifyFetchStatus)
  theme-provider.tsx   NativeWind + Appearance theme provider
  trpc.ts              tRPC React client setup
  _core/               Framework-level (manus-runtime, auth, api, theme) — avoid editing
hooks/                 use-auth, use-colors, use-color-scheme, use-alert-badge, use-live-prices,
                       use-connection
constants/             const.ts, oauth.ts, theme.ts (re-exports)
server/                Express + tRPC backend (see server/README.md)
  _core/               Framework backend code — do not modify unless extending infra
  routers.ts           App router — sync (pull/push), auth, prices, fx, insights, images,
                       notifications (uploadConfig/pull/registerPushToken), devices
  db.ts                Drizzle connection + user helpers
  sync-db.ts           Sync item upserts, tombstones, LWW conflict resolution
  prices.ts            Server-side scraping via resilientFetch + price cache
  price-cache.ts, price-history.ts, price-insights.ts, product-images.ts
  fx.ts                Live FX rate source
  notifications.ts, push-notifications.ts   Server notification scheduling + push tokens
  devices.ts           Device binding, labels, sign-out, stale cleanup
  catalog-warmer.ts    Full-catalog background warmer
  storage.ts           S3 helpers
drizzle/              MySQL schema — 15 tables: users, watchlistItems, priceAlerts,
                      backOrderReminders, appSettings, priceCache, priceHistory,
                      priceInsights, productImages, deviceNotificationConfigs,
                      notificationEvents, notificationEventDeliveries, devicePushTokens,
                      deviceLabels, revokedDevices
shared/               Cross-platform types/consts; shared/_core/ — don't modify
tests/                vitest (80+ files, incl. per-scraper tests under tests/scrapers/)
docs/superpowers/     Design specs (specs/) + implementation plans (plans/)
scripts/              load-env.js, generate_qr.mjs, reset-project.js
references/           periodic-updates.md (reference docs)
design.md             Full UI/UX design spec
todo.md               Phase-by-phase feature checklist (read for history/context)
theme.config.js       Brand color tokens (sapphire blue + emerald green)
app.config.ts         Expo config (branding, plugins, intent filters)
```

### `_core/` directories — hands off

Anything under `lib/_core/`, `server/_core/`, or `shared/_core/` is framework-level. Do not edit unless explicitly extending infrastructure. The app's own code lives in `lib/`, `app/`, `components/`, `hooks/`.

## Domain Model (lib/types.ts)

- `StockStatus`: `"in_stock" | "back_order" | "out_of_stock" | "unknown"`
- `Product` has many `DistributorListing`s; each listing has a `priceHistory: PricePoint[]`
- `PriceAlert` — target price threshold, deactivates on trigger, stores `triggeredAt`/`triggeredPrice`
- `BackOrderReminder` — reused for both date-based reminders and back-in-stock watches (discriminated by `reminderType`)
- `AppSettings` — theme, displayCurrency (USD/EUR/GBP/MYR/AUD/NZD/CAD/ZAR/THB/SGD/HKD/AED), checkInterval, notification toggles
- `SyncItem` — `{ collection, id, data, updatedAt, deletedAt }`; `Collection` = watchlist | alerts | reminders | settings

## AsyncStorage Keys (lib/storage.ts)

`watchlist_products`, `price_alerts`, `app_settings`, `back_order_reminders`, `back_in_stock_watches`, `price_digest_snapshot`, `sync_meta`, `displayed_notification_event_ids`, `notification_history`, `fx_rates`, `distributor_breaker`. Also legacy keys cleared by `clearAllData`: `recently_viewed`, `distributor_watches`, `triggered_alert_history`, `product_notes`, `has_seen_onboarding`.

## Conventions

- **Path aliases:** `@/*` → repo root, `@shared/*` → `shared/`. Prefer `@/lib/...`, `@/components/...`, `@/hooks/...`.
- **Styling:** Use NativeWind classes (`className="..."`) for layout where possible; inline `style={{}}` for dynamic/theme-driven colors via `useColors()`. Theme color tokens: `primary, background, surface, foreground, muted, border, success, warning, error, card, tint`.
- **Colors:** Never hardcode brand colors in components. Pull from `useColors()` (returns current scheme palette) or `constants/theme.ts`.
- **Icons:** Use `<IconSymbol name="..." />`. iOS uses SF Symbols; Android/web maps to Material names in `components/ui/icon-symbol.tsx`. If you add a new icon name, add the Android/web mapping too.
- **Haptics:** `expo-haptics` is used for tap feedback (`Haptics.impactAsync`) and notifications (`notificationAsync`). Follow existing patterns on tappable elements.
- **Notifications:** All notification scheduling must guard `Platform.OS === "web"` (return early). See `lib/notifications.ts`.
- **Background tasks:** `TaskManager.defineTask` must be called at module-level (global scope), not inside a component — see `lib/background-price-check.ts`.
- **Tags:** Watchlist tags are many-per-product colored labels. Definitions live in
  `AppSettings.tagDefinitions` (synced via the `settings` collection); products carry
  `tags?: string[]` of tag ids (synced via `watchlist`). Palette + helpers in
  `lib/tags.ts`; storage CRUD in `lib/storage.ts`. Rendering/filtering must silently
  ignore orphaned tag ids.
- **Seeding:** CRS804 and CRS326 are auto-seeded into the watchlist on first launch in `app/_layout.tsx`. Keep seed listings in sync with `lib/sample-data.ts` when adding price history.
- **Currency:** Prices are stored in their native currency; convert via `convertPrice(amount, from, to)` using static rates in `lib/currency.ts`. `getBestPrice` returns the cheapest non-out-of-stock listing in a target currency. Live rates come from `lib/fx.ts` (server-backed).
- **Scraping:** New distributors go in `lib/scrapers/` as typed `DistributorParser`s registered in `lib/scrapers/registry.ts`, with a test under `tests/scrapers/`. Blocked detection lives in `resilient.ts` (`classifyFetchStatus`, `BLOCKED_MARKERS`) — do not re-implement marker lists elsewhere. Playwright escalation lives in `lib/scrapers/browser.ts` (node-only); `browser.web.ts` is the web stub with the same export surface so `expo export -p web` stays playwright-free — `tests/scrapers/browser-web.test.ts` guards both surface parity and that only `browser.ts` statically imports playwright.
- **No comments** unless explaining non-obvious logic. Existing code uses `// ─── Section ───` banners in storage/notifications — match that style for section dividers.
- **Commit style:** Checkpoint commits follow `Checkpoint: vX.Y: <features>. TypeScript: 0 errors.` — match this when committing.
- **Tests:** vitest. 80+ test files under `tests/` (plus per-scraper tests in `tests/scrapers/`). DB-backed tests are gated on `RUN_DB_TESTS` + `TEST_DATABASE_URL`. Add new tests mirroring existing `*.test.ts`.

## Brand / Theme (theme.config.js)

- Primary (Sapphire Blue): `#0F52BA` light / `#3B7DD8` dark
- Success (Emerald): `#00C896`
- Warning (Amber): `#F59E0B` / `#FBBF24`
- Error (Red): `#EF4444` / `#F87171`
- Background: `#F8FAFC` light / `#0A0E1A` dark
- Surface: `#FFFFFF` / `#131929`

## Key Flows

1. **Add product:** Search (`app/search.tsx`) → tap result → `addToWatchlist` → back to watchlist. When signed in, the change syncs to the server.
2. **View detail:** Watchlist card → `product/[id]` → distributor rows, best-distributor card, sparklines, set alert, remind me, watch for restock, compare button. Product image + LLM price insight are fetched from the server when available.
3. **Compare:** Product Detail → `compare/[id]` → multi-line SVG chart with 1W/1M/3M/All filters, cheapest-region card, cross-distributor alert CTA.
4. **Alerts:** `(tabs)/alerts.tsx` has two tabs: Alerts (price alerts + price-drop history with re-arm) and Reminders (date reminders + stock watches with reschedule).
5. **Price-drop detection:** Background task (`PRICE_CHECK_TASK`, 15-min min interval) + foreground `checkPriceDropsNow()` on app launch. Compares best in-stock price (converted to alert currency) against target; fires notification and deactivates alert. Uses `resilientFetch` (server-first via `fetchServerPrice`, local scrape fallback).
6. **Sync:** When authenticated, `setupSync` (in `app/_layout.tsx`) pulls server changes since the last `lastSyncedAt`, merges LWW with local items, pushes local changes, and stamps server timestamps. Retries failed syncs on foreground. Settings screen shows sync status.
7. **Notifications:** Alerts/reminders are scheduled locally (`lib/notifications.ts`) and mirrored server-side (`notifications.uploadConfig`); server events are pulled (`syncServerNotifications`) and push events are delivered via Expo push.

## Web Build

- The web export is an SPA: `app.config.ts` sets `web.output: "single"`, so
  `expo export -p web` emits a single `dist/index.html`. Hosts must fall back to
  `index.html` for unknown paths (deep links like `/product/[id]`) and serve
  `dist/sw.js` for web push. There is no per-route server-rendered HTML.
- Do not switch back to `output: "static"`: NativeWind 4's
  `react-native-css-interop` emits different classNames in SSR vs client
  hydration, causing React hydration error #418 on every interop-wrapped route.
- `expo export -p web` requires `--clear` after changing `EXPO_PUBLIC_*` env
  (Metro's transform cache otherwise misses the new value).

## Environment

- No `.env` committed. Backend needs `DATABASE_URL`, `EXPO_PUBLIC_OAUTH_*`, `EXPO_PUBLIC_API_BASE_URL` for full functionality. Web push needs `VAPID_SUBJECT`/`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (server) and `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (client); without them the app runs local-only and web notifications fall back to foreground pull. End-to-end web push can't be verified in headless Chromium (no push service) — use a real browser over HTTPS.
- DB-backed tests use `TEST_DATABASE_URL` + `RUN_DB_TESTS=1` (see `pnpm test`).
- `scripts/load-env.js` loads env with system > `.env` priority.

## Before You Commit

1. `pnpm check` — must pass with 0 TypeScript errors
2. `pnpm lint` — must pass
3. `pnpm test` — run if you touched server/ or shared/
4. Do not commit `.env*`, `node_modules/`, `dist/`, `.expo/`, `ios/`, `android/` (all in `.gitignore`)
5. Match the existing checkpoint commit message style if the user asks for a checkpoint

## Reference Docs

- `design.md` — full UI/UX design spec (screen list, flows, component design, distributor catalog)
- `todo.md` — phase-by-phase feature history (53 phases through v5.1)
- `server/README.md` — backend guide (auth, DB, tRPC, storage, LLM, image gen) — read only if adding backend features
- `docs/superpowers/` — design specs (`specs/`) and implementation plans (`plans/`) for recent phases
- `references/periodic-updates.md` — reference doc on periodic updates
