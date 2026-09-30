# Product Stock Finder — TODO

## Phase 1: Architecture & Design

- [x] Initialize Expo mobile project
- [x] Create design.md with full UI/UX plan
- [x] Generate app logo and icon
- [x] Update app.config.ts with branding

## Phase 2: Core UI & Navigation

- [x] Update theme colors (sapphire blue + emerald green brand)
- [x] Set up 4-tab navigation (Home, Watchlist, Alerts, Settings)
- [x] Add all required icon mappings
- [x] Build Home/Dashboard screen
- [x] Build Settings screen

## Phase 3: Product Tracking & Watchlist

- [x] Create product data models and AsyncStorage service
- [x] Build Watchlist screen with product cards
- [x] Build Search/Add Product screen
- [x] Build Product Detail screen
- [x] Pre-load product catalog (MikroTik + networking equipment)

## Phase 4: Distributor Database & Stock Check

- [x] Create distributor database (25 distributors)
- [x] Build distributor row component
- [x] Implement stock status badges
- [x] Add "Open in Browser" functionality
- [x] Add manual stock check (refresh) functionality

## Phase 5: Price Comparison, Alerts & History

- [x] Build Alerts screen
- [x] Implement price alert creation and management
- [x] Build price history chart (sparkline) — PriceSparkline component (components/price-sparkline.tsx), product detail + compare screens
- [x] Add price comparison table
- [x] Implement local notifications for alerts

## Phase 6: Polish & App Store

- [x] Add pull-to-refresh on all screens
- [x] Add loading states and skeleton screens
- [x] Add empty states for all screens
- [x] Add haptic feedback
- [x] Add share functionality — Share.share in product detail (app/product/[id].tsx)
- [x] Final QA and bug fixes
- [x] Save checkpoint

## Phase 7: New Features (User Requested)

- [x] Pre-load CRS804-4DDQ-HRM with all tracked distributors and live data (9 distributors, verified July 19 2026)
- [x] Fully functional product search screen (search by SKU/name, add to watchlist)
- [x] Push notifications for stock availability and price drop alerts (expo-notifications, local, Android channels, permission request, test button in Settings)
- [x] Auto-add CRS804 to watchlist on first launch
- [x] ZAR currency added to display currency options

## Phase 8: Pre-Publish Polish (User Requested)

- [x] Fix Home/Watchlist In Stock badge — backfill listings at startup, useFocusEffect on Home tab
- [x] Add Last Updated timestamp to distributor cards in Product Detail screen (relative time, e.g. "Just now", "2h ago")
- [x] Add bell.badge.fill icon mapping for Android/web (notification-important)
- [x] Final QA pass — all screens verified: Home (1 In Stock, Recent Activity), Watchlist (In Stock · $935.37 · 9 distributors), Alerts (empty state), Settings (Test Notification, ZAR currency)

## Phase 9: Feature Polish (User Requested)

- [x] Wire live Alerts counter on Home dashboard (active & not triggered)
- [x] Share button on Product Detail screen (native share sheet)
- [x] Back In Stock test notification button on Product Detail screen

## Phase 10: Feature Polish (User Requested)

- [x] Expand product catalog with 5 more networking products and realistic listings with price history
- [x] Price history sparkline on distributor cards using react-native-svg
- [x] Copy Link clipboard fallback on Share handler (expo-clipboard, toast confirmation)

## Phase 11: v2.5 Features (User Requested)

- [x] Reminders tab on Alerts screen — tab switcher (Alerts / Reminders), list active back-order reminders with product name, distributor, date, past-due badge, cancel with confirmation dialog
- [x] BackOrderReminder type in types.ts, getBackOrderReminders / addBackOrderReminder / removeBackOrderReminder / clearAllData helpers in storage.ts
- [x] scheduleBackOrderReminder and cancelNotification helpers in notifications.ts
- [x] Best Distributor highlight card on Product Detail — crown badge "BEST PRICE", cheapest in-stock distributor pinned above full list with Buy Now CTA
- [x] Sort bar on Watchlist with haptic feedback — Recent / Best Price / A–Z chips with light haptic on tap
- [x] calendar and crown.fill icon mappings added to icon-symbol.tsx

## Phase 12: v2.6 Features (User Requested)

- [x] Wire "Remind me" button on back-order distributor cards in Product Detail — amber button opens date-picker modal, saves reminder via addBackOrderReminder, schedules notification via scheduleBackOrderReminder, cancels old notification if rescheduling
- [x] Add "Reschedule" action on Reminders tab — pencil icon opens Reschedule Reminder modal with DateTimePicker, cancels old notification and schedules new one, updates reminder in storage
- [x] Add price-drop ▼ badge to Best Distributor card — compares oldest vs current priceHistory point, shows green ▼ X% (down) or red ▲ X% (up) badge inline with crown header
- [x] pencil icon mapping added to icon-symbol.tsx
- [x] @react-native-community/datetimepicker installed for date selection

## Phase 13: v2.7 Features (User Requested)

- [x] Back In Stock reminder type — "Watch for Restock" button on back-order distributor cards, useFocusEffect polling detects status change to in_stock and fires scheduleStockAlert, watch stored in STOCK_WATCHES AsyncStorage key
- [x] getStockWatches / addStockWatch / removeStockWatch / updateStockWatchStatus helpers in storage.ts
- [x] Alerts tab bar badge — useAlertBadge hook reads active alerts + date reminders + stock watches count, shown as red badge on bell icon in tab bar
- [x] Lowest Price Ever 🎉 label on Best Distributor card — compares current price (USD) against minimum across all priceHistory points, shows green banner when at or below historical minimum

## Phase 14: v2.8 Features (User Requested)

- [x] Stock Watches section in Reminders tab — "Watching for Restock" sub-section above date reminders showing distributor, last known status dot, 👀 Watching badge, and Remove button with confirmation
- [x] Full-screen Price History chart modal — tapping sparkline on any distributor card opens bottom sheet with PriceHistoryChart (SVG polyline, grid lines, Y-axis labels, X-axis date labels, LOW/HIGH annotations), current price summary, and % change vs oldest recorded
- [x] Quick-set price alert on Best Distributor card — "Set Alert at X (−5%)" button pre-filled at 5% below current price, one-tap saves alert and schedules confirmation notification
- [x] PriceHistoryChart component added (SVG-based, full-width, 200px height, min/max/mid grid lines, date labels, LOW/HIGH annotation badges)
- [x] v2.9: Compare Distributors screen with multi-line overlaid SVG price history chart (up to 5 distributors, color-coded, USD Y-axis, current prices table, pre-selects distributors with history)
- [x] v2.9: Compare button on Product Detail secondary action row navigates to /compare/[id]
- [x] v2.9: Background price-drop polling via expo-background-task (PRICE_CHECK_TASK) — checks active alerts against watchlist prices, fires threshold-triggered notification and deactivates alert when price drops below target
- [x] v2.9: Foreground price-drop check (checkPriceDropsNow) runs on app launch via \_layout.tsx
- [x] v2.9: Currency converter widget on Product Info Card — reads displayCurrency from settings, shows best in-stock price converted to preferred currency with swap-horiz icon
- [x] Seed 10-point 90-day price history for all 9 distributors in SAMPLE_LISTINGS
- [x] Add 1W/1M/3M/All time-range filter chips to Compare screen
- [x] Add Cheapest Region summary card to Compare screen
- [x] Extract SAMPLE_LISTINGS to lib/sample-data.ts shared module
- [x] Wire SAMPLE_LISTINGS fallback in Compare screen (no Product Detail visit required)
- [x] Add Price Trend ▲/▼ arrows to distributor selector in Compare screen
- [x] Sort by Trend/Price/A-Z toggle on Compare distributor selector
- [x] Cross-distributor price alert CTA on Compare screen (5% below best)
- [x] Price trend arrows on Watchlist product cards
- [x] MikroTik CRS326-24S+2Q+RM as second test product (8 distributors, seeded at launch)
- [x] CRS326 sample data with 10-point price history in sample-data.ts
- [x] Pull-to-refresh with last-updated timestamp on Watchlist
- [x] Catalog search/filter bar (already existed in Add Product screen)
- [x] Price Drop History section in Alerts tab (with triggeredAt/triggeredPrice fix)
- [x] Savings Calculator total-saved banner in Price Drop History
- [x] Re-arm Alert (Watch Again) button on triggered history items
- [x] Last Checked timestamp on Product Detail distributor cards (already existed)

## Phase 15: Headless Browser Scraping

- [x] Add `useBrowser` and `browserOptions` fields to DistributorParser interface
- [x] Create BrowserPool class and fetchWithBrowser function (lib/scrapers/browser.ts)
- [x] Add browser fingerprinting evasion (user-agent, viewport, webdriver disable)
- [x] Add Cloudflare bypass with cookie persistence and challenge waiting
- [x] Add fetchWithParser utility to reduce code duplication (lib/scrapers/utils.ts)
- [x] Update 15 parsers with `useBrowser: true` flag
- [x] Create Rust BrowserPool for desktop (desktop/src-tauri/src/scrapers/browser.rs)
- [x] Update all desktop scrapers to use browser fetch
- [x] Unit tests for BrowserPool (8 tests passing)
- [x] Integration test for browser parsers
- [x] Live testing: 5/15 sites working (bhphoto, mbsiwav, winncom, pbtech, getic)
- [x] Remaining 10 sites have infrastructure issues (dead/parked, SSL errors, site-side JS problems)

## Phase 16: Distributor Health Dashboard

- [x] Create shared health module (lib/scrapers/health.ts) with classifyResult, createHealthService, testAllDistributors
- [x] Health persistence via StorageAdapter pattern (distributor_health key)
- [x] Mobile health screen (app/health.tsx) with filter chips, Test All button, progress bar
- [x] Desktop health screen (desktop/src/pages/Health.tsx) using Rust check_distributor_health command
- [x] Rust check_distributor_health command running all 25 scrapers
- [x] Extract shared scrape_distributor helper (DRY with check_all_prices)
- [x] Wire health updates into background scrape (batched flush)
- [x] Unit tests for classification + persistence (10 tests)
- [x] Desktop health component tests (4 tests)
- [x] Desktop build regression fixed (Rust command instead of JS playwright module)

## Phase 17: Watchlist Summary Card

- [x] Create shared summary utility (lib/watchlist-summary.ts) with computeWatchlistSummary
- [x] Unit tests for summary computation (5 tests)
- [x] Mobile summary card (app/(tabs)/watchlist.tsx) with total value + stock counts
- [x] Desktop summary card (desktop/src/pages/Watchlist.tsx) with total value + stock counts

## Phase 18: Distributor Region Filter

- [x] Create shared region filter utility (lib/region-filter.ts) with getAllRegions, productHasRegion, filterListingsByRegion
- [x] Unit tests for region filter (6 tests)
- [x] Mobile watchlist region filter chips
- [x] Mobile product detail region filter chips
- [x] Desktop watchlist region filter chips
- [x] Desktop product detail region filter chips
- [x] Best-price card respects region filter (mobile + desktop)
- [x] Region-specific empty states (mobile + desktop)

## Phase 19: Never Miss a Restock

- [x] Create shared restock module (lib/restock.ts) with checkRestocks
- [x] Unit tests for checkRestocks (7 tests)
- [x] Wire restock check into background task + foreground check
- [x] Mobile restock watches screen (app/restock-watches.tsx)
- [x] Mobile navigation entry from Alerts tab
- [x] Desktop restock watches screen (desktop/src/pages/RestockWatches.tsx)
- [x] Desktop navigation link from Alerts page
- [x] Dark-mode styling + StockBadge on desktop screen

## Phase 20: Best Deal Distributor Recommendation

- [x] Add shippingCosts to Distributor type and shippingRegion to AppSettings
- [x] Add shipping costs + native currency to all 25 distributors
- [x] Create shared best deal utility (lib/best-deal.ts) with findBestDeal
- [x] Unit tests for findBestDeal (5 tests)
- [x] Mobile shipping region selector in settings
- [x] Desktop shipping region selector in settings
- [x] Mobile Best Deal card on product detail
- [x] Desktop Best Deal card on product detail
- [x] Best Deal card respects region filter (mobile + desktop)

## Phase 21: Cross-Product Distributor Analysis

- [x] Create shared analysis utility (lib/distributor-analysis.ts) with analyzeDistributors
- [x] Unit tests for analyzeDistributors (5 tests)
- [x] Mobile distributor analysis screen (app/distributor-analysis.tsx)
- [x] Mobile navigation entry from Watchlist
- [x] Desktop distributor analysis screen (desktop/src/pages/DistributorAnalysis.tsx)
- [x] Desktop navigation link from Watchlist
- [x] Deterministic cheapest-in-stock pricing per distributor

## Phase 22: Tax-Inclusive Landed Cost

- [x] Create shared tax module (lib/tax.ts) with country tax rates
- [x] Unit tests for getTaxRate (3 tests)
- [x] Add taxRate to DistributorListing and ScrapeResult
- [x] Set taxRate in all 25 scrapers from country map
- [x] Update findBestDeal to include tax in total (price + tax + shipping)
- [x] Update analyzeDistributors to include tax in totalCost
- [x] Show tax in mobile Best Deal card and listings table
- [x] Show tax in desktop Best Deal card and listings table
- [x] Note tax-inclusive totals on distributor analysis screens

## Phase 23: Stock-Like Price Chart with Tap-to-Inspect

- [x] Create nearest-point utility (lib/price-chart.ts) with findNearestIndex
- [x] Unit tests for findNearestIndex (3 tests)
- [x] Add tap-to-inspect tooltip (crosshair + price/date) to mobile price history chart
- [x] Add Recharts price history chart to desktop Product Detail
- [x] Convert desktop chart to display currency with labeled axis
- [x] Desktop chart component test (tests real MultiLineChart)

## Phase 24: Time-Based Price History Retention

- [x] Create appendPricePoint helper (lib/price-history.ts) with time-based retention (1 point per UTC day, 90-day window)
- [x] Unit tests for appendPricePoint (6 tests)
- [x] Wire appendPricePoint into both mobile scrape paths (background task + foreground check)
- [x] Rename MAX_PRICE_HISTORY to PRICE_HISTORY_DAYS
- [x] Rust append_price_point_with_retention + iso_date_from_secs helpers (desktop)
- [x] Rust retention tests (5 tests)
- [x] Bound desktop history growth in update_listing_price (was unbounded)

## Phase 25: Scheduled Price Digest

- [x] Create shared price digest engine (lib/price-digest.ts) with computeDigest / formatDigestNotification / maybeSendDigest
- [x] Unit tests for digest engine (16 tests)
- [x] Add price_digest_snapshot storage key + get/set helpers
- [x] Add sendPriceDigestNotification + Android digest channel
- [x] Wire digest into mobile background task + foreground check
- [x] Add digestFrequency setting (off/daily/weekly) to mobile + desktop settings
- [x] Wire previously-dead desktop price poller to checkInterval setting
- [x] Add desktop digest listener on prices-checked event

## Phase 26: Backend Sync

- [x] Drizzle schema: 4 normalized sync tables (watchlist_items, price_alerts, back_order_reminders, app_settings) with updatedAtMs/deletedAtMs + migration
- [x] Shared sync types (Collection, SyncItem, SyncMeta) in lib/types.ts
- [x] Server sync DB helpers (listChangedItems, upsertSyncItem, purgeOldTombstones) + protected tRPC sync router (pull/push) with tests
- [x] Storage sync_meta key + get/saveSyncMeta helpers + onChange wiring
- [x] Shared sync engine (lib/sync.ts): single-flight syncNow, 2s debounced setupSync, LWW pull/merge/push with tests (12)
- [x] Mobile: launch sync on start + auth change (app/\_layout.tsx), Account section + sync status in Settings
- [x] Desktop: react-query/tRPC deps, api-base + OAuth portal helpers, localStorage auth hook (use-auth), tRPC client, Tauri start_oauth loopback command (127.0.0.1:3420), App providers + launch sync, Account section + sync status in Settings

## Phase 27: Server-Side Price Scraping

- [x] price_cache Drizzle table + PriceSnapshot shared type
- [x] Server price cache backend (DB table + in-memory fallback)
- [x] Server price service (getPrice, single-flight refresh, background warmer)
- [x] Public prices.get tRPC endpoint
- [x] Mobile fetchServerPrice helper + server-first background/foreground scraping
- [x] Desktop server-first price poller (Rust)

## Phase 28: Server-Side Price History

- [x] price_history Drizzle table + migration
- [x] Server history storage (record/get/merge/purge, memory fallback)
- [x] Record history on scrape; getPrice returns { snapshot, history }
- [x] Public prices.uploadHistory endpoint
- [x] Mobile fetchServerPrice returns { snapshot, history } + uploadServerHistory
- [x] Mobile refreshListing merges server history + piggyback backfill
- [x] Mobile launch backfill (lib/history-sync.ts)
- [x] Desktop history merge + backfill command (Rust)

## Phase 29: Full-Catalog Warming

- [x] price-cache getAllFetchedAt
- [x] Catalog pair builders (buildCatalogPairs, pickPairsToWarm)
- [x] warmCatalogRotation + wiring into the warmer tick

## Phase 30: LLM Price Insights

- [x] price_insights Drizzle table + migration
- [x] Server insight generation + TTL cache (server/price-insights.ts)
- [x] Public insights.get tRPC endpoint
- [x] Mobile fetchPriceInsight helper + product detail card
- [x] Desktop fetch_price_insight command + product detail card

## Phase 31: Product Image Generation

- [x] product_images Drizzle table + migration
- [x] Server image generation + URL cache (server/product-images.ts)
- [x] Public images.get tRPC endpoint
- [x] Background pre-generate in the warmer
- [x] Mobile fetchProductImage helper + watchlist/search/detail display
- [x] Desktop fetch_product_image command + watchlist/search/detail display

## Phase 32: Server-Side Notification Scheduling

- [x] device_notification_configs + notification_events Drizzle tables + migration
- [x] Server notification engine (config upsert, event evaluation, pull) (server/notifications.ts)
- [x] Public notifications.uploadConfig + notifications.pull tRPC endpoints
- [x] Warmer tick evaluates notification configs (runWarmerTick)
- [x] Mobile anonymous device id (lib/device-id.ts)
- [x] Mobile config upload + event pull helpers (lib/server-notifications.ts)
- [x] Launch/foreground sync + local notification display + reconciliation
- [x] Review fixes: reminder re-fire dedup, restock transition detection, sync single-flight, stale price-drop dedup, warmer tick resilience

## Phase 33: Push Notifications

- [x] device_push_tokens Drizzle table + migration
- [x] Server push service (upsert token + Expo push send) (server/push-notifications.ts)
- [x] Push notification events at detection time (warmer evaluation)
- [x] Public notifications.registerPushToken tRPC endpoint (+ stockWatches.lastKnownStatus schema fix)
- [x] Mobile expo push token registration (lib/push-token.ts) + launch wiring
- [x] Desktop syncDesktopNotifications + scheduled polling + native notifications

## Phase 34: Mobile Notification Dedup

- [x] displayed_notification_event_ids storage key (getDisplayedEventIds / recordDisplayedEventId, capped 200)
- [x] setupPushEventTracking (received + response listeners + last-response capture)
- [x] Launch pull sync skips re-render for already-displayed events (still reconciles)
- [x] Launch wiring in app/\_layout.tsx

## Phase 35: Push Token Pruning

- [x] pruneDeviceToken (DB delete + memory removal, best-effort)
- [x] Send-ticket inspection: DeviceNotRegistered prunes the token row
- [x] Tests: dead/ok/other-error tickets, memory path, never-throws

## Phase 36: In-app Notification Center

- [x] Notification history AsyncStorage collection (`notification_history`, capped at 200)
- [x] Record every pulled notification event into history during sync
- [x] Third "Notifications" segment in the Alerts tab with unread pill, mark-all-read, and tap-to-product

## Phase 37: Sync Hardening

- [x] notifications.uploadConfig / pull deviceId length guard (.max(128))
- [x] Router-boundary regression test for stock watch lastKnownStatus passthrough
- [x] Sync-engine tests: pull failure, resurrection, LWW tie, status writes on all paths
- [x] Persisted sync status (SyncMeta.lastSyncError / lastSyncOkAt) written by doSync
- [x] formatSyncStatus helper + unit tests
- [x] Settings sync-status error tone + "Sync now" button

## Phase 38: Live FX Rates

- [x] Server TTL-cached FX service (server/fx.ts) + public fx.get endpoint (1h TTL, single-flight, stale-while-revalidate)
- [x] FX provider URL configurable via FX_API_URL (default open.er-api.com/v6/latest/USD, no key)
- [x] Dynamic rates in lib/currency.ts (setExchangeRates overlay; fallback to static)
- [x] Mobile fx helper: fetch/load/refresh + maybeRefresh (lib/fx.ts), persisted to fx_rates AsyncStorage
- [x] Launch + Settings refresh wiring; every existing conversion uses live rates
- [x] Tests: fx service (6), currency live-rates (3), storage round-trip (4), fx client (7)

## Phase 39: FX + Sync Hardening

- [x] getFxRates rate-value validation (finite numbers only; null when empty)
- [x] Mobile single-flight refresh (refreshFxRates dedupes concurrent calls)
- [x] Sync error label dedup (drop redundant "Sync failed —" prefix)
- [x] registerSyncSetup teardown (cleanup nulls ref; \_layout effect unregisters)
- [x] Settings "Sync now" loading state (disabled + spinner) + success tone
- [x] Symmetric oversized-deviceId pull test (notifications.pull)

## Phase 40: User-Scoped Notifications

- [x] Device↔user binding on authenticated uploadConfig / registerPushToken (persists across logout/login)
- [x] notificationEventDeliveries junction for per-device delivery tracking
- [x] Per-user event evaluation (aggregate + dedup configs across bound devices)
- [x] Cross-device delivery + catch-up pull for devices that bind later
- [x] Hybrid auth: anonymous devices keep device-scoped flow
- [x] sendPushForUser (push to every bound device)

## Phase 41: Device Management

- [x] Server device management module (server/devices.ts): listDevicesForUser, getDeviceBinding, unbindDevice (memory/DB parallel)
- [x] devices router: list (protected), current (public), unbind (protected)
- [x] Client helper (lib/devices.ts): fetchDevices, fetchCurrentDeviceBinding, unbindDevice, bindCurrentDevice
- [x] Settings "Device Management" section: current-device status, bind action, bound-devices list, unbind with destructive confirm

## Phase 42: Device Labels & Remote Sign-Out

- [x] Server device labels (server/devices.ts): renameDevice, label on DeviceInfo/listDevicesForUser (memory/DB parallel)
- [x] device_labels + revoked_devices tables (drizzle/schema.ts)
- [x] Remote sign-out (unbind + revocation marker) via signOutDevice — replaces devices.unbind (removed)
- [x] 30-day idle cleanup (client-triggered): cleanupStaleDevices (STALE_DEVICE_MS)
- [x] x-device-id header + createContext revocation check (throws DEVICE_REVOKED_ERR_MSG)
- [x] lib/device-revoked.ts: revokedDeviceLink detects the error and clears the local session
- [x] Settings Rename modal + Sign out action (app/(tabs)/settings.tsx)

## Phase 43: Device Session Hardening & Un-Revoke

- [x] Shared OAuth state helpers (shared/oauth-state.ts): encodeOAuthState/decodeOAuthState (deviceId in state, legacy base64 tolerated)
- [x] Device-bound sessions: deviceId claim in session JWTs (server/\_core/sdk.ts); authenticateRequest exposes sessionDeviceId
- [x] createContext revocation check prefers the token claim over the x-device-id header
- [x] Login is the un-revoke: /api/oauth/callback + /api/oauth/mobile call unrevokeDevice(deviceId) and bind deviceId into the issued token
- [x] unrevokeDevice (server/devices.ts) clears the revoked_devices marker (memory/DB parallel)
- [x] cleanupStaleDevices excludes the caller's deviceId (router passes ctx.deviceId)

## Phase 44: User-Scoped Device Revocation

- [x] revoked_devices gains userId (surrogate id PK + unique index on (userId, deviceId)); legacy rows keep NULL = global legacy block
- [x] isDeviceRevoked(userId, deviceId) matches userId OR NULL; unrevokeDevice(userId, deviceId) clears the caller's row and any global legacy block
- [x] signOutDevice stores the revoking userId; memory backend uses composite keys (${userId}:${deviceId} plus *:${deviceId})
- [x] createContext revocation check passes user.id (claim-authoritative check stays scoped to the user)
- [x] OAuth login un-revokes the synced user's device (skips with a warning when no numeric id resolves)
- [x] Cross-user isolation tests: A's sign-out never blocks B; B's login never clears A's revocation

## Phase 45 — End-to-End Live Mode (v4.5)

- [x] Connection status hook (`/api/health` probe + auth) with three states
- [x] Home header connection badge + Settings Connection card
- [x] React Query live price layer (`useLiveProduct` / `useLiveWatchlist`) with AsyncStorage seed + persistence
- [x] Product detail + compare render live prices with server refresh
- [x] Watchlist renders live prices with Refresh all + pull-to-refresh

## Phase 46: Sync Hardening (v4.6)

- [x] Server-authoritative timestamps: server stamps pushed items (upsertSyncItem returns { accepted, updatedAt }); push returns { accepted, stamped }
- [x] Client stamped-meta + server cursor: sync cursor = pulled.lastSyncedAt; push payload carries per-item corrected edit time
- [x] Clock-skew robustness: serverNow() offset correction (lastSyncedAt - lastSyncOkAt) for offline edits
- [x] Capped price-history sync: push capped at 30 days (PRICE_HISTORY_SYNC_DAYS); merge preserves 90-day local history (PRICE_HISTORY_DAYS in shared/const.ts)
- [x] Offline retry/backoff: exponential backoff (30s -> 5min cap) driven by lastSyncError; foreground retry on app active/focus
- [x] Server DB integration tests (tests/sync-db.test.ts, 7 tests, TEST_DATABASE_URL-gated, idempotent createUser)
- [x] End-to-end sync test (tests/sync-e2e.test.ts): real syncNow + appRouter + MySQL, two-device round-trip, tombstones, cross-user isolation
- [x] Test DB bootstrap script (scripts/setup-test-db.sh, idempotent); vitest fileParallelism gated on RUN_DB_TESTS

## Phase 47: Resilient Parser Fetch (v4.7)

- [x] Shared resilience module (lib/scrapers/resilient.ts): FetchStatus/FetchOutcome/BreakerEntry/BreakerStateStore types, classifyFetchStatus (403/429 + Cloudflare markers), createMemoryBreakerStore (server), createStorageBreakerStore (client, key distributor_breaker)
- [x] resilientFetch core: breaker check (skipped in cooldown, no network), plain→browser escalation on blocked, browser→plain fallback when unavailable, retry/backoff (2 retries, 1s/2s), blocked cooldown 30min×1.5^(failures-1) capped 2h, transient cooldown after 3 failures, reset on success
- [x] Server integration: server/prices.ts refreshPrice routes through resilientFetch with in-memory breaker store; stale cache preserved on non-ok outcomes (warmer inherits resilience)
- [x] Client integration: lib/background-price-check.ts local fallback routes through resilientFetch with storage-backed breaker store; outcome→health mapping (ok→working, blocked→blocked, skipped→blocked/in cooldown, error→error)
- [x] Tests: 19 resilient-fetch unit tests, blocked/skipped health-mapping tests in server-first-scrape, prices/warmer updated to resilient mocks (639 total with DB, 630/9 without)

## Phase 48: Fast-Fail Browser-Unavailable (v4.7.1)

- [x] BrowserUnavailableError + module-scope browserUnavailableReason cache in lib/scrapers/resilient.ts: fetchBrowser throws on deterministic playwright import failure and skips the import on subsequent calls
- [x] attemptMethod breaks the retry loop on BrowserUnavailableError — removes ~3s client retry penalty for useBrowser parsers; transient browser call errors on the server still retried
- [x] Tests: fast-fail regression test (browser called once, plain fallback); transient-error retry path coverage preserved (633 total with DB, 633/9 without)

## Phase 49: Centralize Blocked Detection (v4.7.2)

- [x] classifyResult in lib/scrapers/health.ts delegates blocked detection to classifyFetchStatus (lib/scrapers/resilient.ts) — single source of truth for the 4 Cloudflare markers, no more duplicated list
- [x] BLOCKED_MARKERS exported from resilient.ts; regression test iterates it so future marker additions are auto-detected by classifyResult
- [x] Behavior unchanged: existing 7 classifyResult tests untouched; 634 total with DB, 634/9 without

## Phase 50: Cleanup (v4.8)

- [x] Auth/OAuth logging gated behind __DEV__ via debugLog helper; user objects, token prefixes, and URLs no longer logged (hooks/use-auth.ts, app/oauth/callback.tsx); console.error kept for real errors
- [x] Version consolidated to 4.7.2 in package.json + app.config.ts; settings screen reads Constants.expoConfig?.version with "dev" fallback (app.config.ts is single source of truth)
- [x] Dead code removed: hello-wave, parallax-scroll-view, external-link, collapsible, constants/const.ts, desktop/src/lib/notifications.ts duplicate, app/dev/theme-lab.tsx, getDistributorsByRegion, extractCurrency, extractExpectedDate, storageGet/storageGetSignedUrl
- [x] Unused deps removed: expo-audio, expo-video, expo-image, expo-keep-awake, expo-system-ui (+ their app.config.ts plugins); lockfile pruned
- [x] Docs fixed: design.md/todo.md/AGENTS.md app name + distributor counts (25); server/README.md rewritten from template boilerplate to accurate backend guide
- [x] Price-check logic deduped: runPriceCheckCore extracted in lib/background-price-check.ts; PRICE_CHECK_TASK and checkPriceDropsNow are thin wrappers (net -87 lines, behavior unchanged)

## Phase 51: Web Notifications (v4.9)

- [x] Web notification permission + display via Web Notification API (lib/web-notifications.ts)
- [x] 60s pull polling of server events while the web tab is open (setupWebNotifications + focus listener)
- [x] scheduleServerEventNotification delegates to displayWebNotification on web (dynamic import, non-fatal)
- [x] Settings gets a web-only "Web Notifications" toggle with permission-denied hint
- [x] webNotificationsEnabled AppSettings field (default off), syncs via existing settings sync

## Phase 52: Web Push Background Delivery (v5.0)

- [x] Server sends web pushes via web-push (VAPID) with 404/410 token pruning (server/web-push.ts)
- [x] device_push_tokens stores web PushSubscription JSON (token column → text; platform "web")
- [x] sendPushForDevice routes platform "web" to sendWebPush; Expo path unchanged
- [x] public/sw.js service worker shows notifications when no tab is focused; notificationclick focuses/opens
- [x] lib/web-push.ts: SW registration, PushManager subscribe/unsubscribe, base64url helper
- [x] Web Notifications toggle subscribes/unsubscribes; SW-shown event ids dedup the foreground pull
- [x] scripts/generate-vapid-keys.js + VAPID env docs

## Phase 53: Web Build Fixes (v5.1)

- [x] Web export fixed: playwright excluded from the web bundle via lib/scrapers/browser.web.ts stub (resilient.ts dynamic import was pulling playwright-core into Metro's web build)
- [x] React hydration error #418 eliminated: NativeWind 4's react-native-css-interop emits different classNames in SSR vs client hydration; switched web.output from "static" to "single" (SPA) in app.config.ts — no per-route server-rendered HTML, hosts must SPA-fallback to index.html
- [x] CORS_ALLOWED_ORIGINS documented in server/README.md (required for cross-origin web dev)

## Phase 54: Watchlist Tags (v5.2)

- [x] Colored tags (10-color palette) assignable per product via a tag picker sheet on each watchlist card
- [x] Tag definitions stored in AppSettings.tagDefinitions; product tags on Product.tags — both sync via existing watchlist/settings collections (no backend changes)
- [x] Tag filter chip row on the watchlist screen with OR semantics, combined with the region filter
- [x] Sheet-based tag management: rename, recolor, delete (strips id from products)
- [x] lib/tags.ts helpers + storage CRUD with unit tests

## Phase 55: Watchlist Organization (v5.3)

- [x] lib/watchlist-org.ts: productStatus/productRegion/priceDropPercent, filterWatchlist (region+tag+status+query AND), sortWatchlist (6 modes), groupWatchlist (off/tag/status/region with untagged + multi-tag duplication)
- [x] Tappable summary counts filter by stock status; search bar matches name+model; Sort dropdown + group chips
- [x] Grouped section headers (tag color dot, status, region) above the list
- [x] Long-press bulk selection: delete (confirm) + add-tags via BulkTagSheet (addTagsToProducts storage helper)
- [x] watchlistSort/watchlistGroup persisted in AppSettings and synced via settings collection
- [x] Tests: watchlist-org unit tests + addTagsToProducts storage test

## Phase 56: Multi-Tag Filtering (v5.4)

- [x] matchesTagFilterMode: OR/AND semantics for tag filters (lib/tags.ts)
- [x] tagMatchMode in WatchlistFilters; filterWatchlist supports any/all
- [x] countTagMatches: dynamic per-tag counts respecting region/status/query
- [x] Shared TagFilterRow component (chips + counts + inline Any/All toggle + Clear)
- [x] Watchlist uses TagFilterRow; counts update with active filters
- [x] Add Product screen: tag filter row over the catalog + tag assignment (row icon + post-add sheet)
- [x] Tests: tags OR/AND + watchlist-org tag modes + countTagMatches

## Phase 57: Distributor Health History & Trends (v5.5)

- [x] Rolling capped health history per distributor (30 days / 90 samples, local AsyncStorage)
- [x] Passive capture: background price-check collector + manual Test All record history samples
- [x] computeHealthStats: uptime %, trend (up/down/flat), status sparkline (working/blocked/error)
- [x] Health dashboard rows show uptime %, trend glyph, and SVG sparkline
- [x] Tests: health history storage, pruning, computeHealthStats, capture integration

## Phase 58: Scheduled Health Probes (v5.6)

- [x] HEALTH_PROBE_TASK background task probes all 25 distributors on the checkInterval schedule
- [x] testAllDistributors upgraded to resilientFetch with shared circuit-breaker store
- [x] classifyProbeOutcome maps fetch outcomes (ok/blocked/skipped/error) to health status
- [x] registerHealthProbeTask mirrors registerPriceCheckTask (manual unregisters, web no-op)
- [x] Tests: outcome mapping, task registration, history recording

## Phase 59: Health Drill-Down View (v5.7)

- [x] computeHealthSummary: count, first/last probe, avg response time
- [x] Health drill-down route (app/health/[id].tsx): summary card + full sample list
- [x] Dashboard rows tappable → drill-down navigation
- [x] Empty state and unknown-id handling
- [x] Tests: computeHealthSummary

## Phase 60: Health Drill-Down Polish (v5.8)

- [x] timelineSegments: time-proportional status strip weights
- [x] groupSamplesByDay: local-day grouping, newest first
- [x] Timeline strip in drill-down summary card
- [x] Day-grouped sample list with per-day working %
- [x] Tests: timelineSegments, groupSamplesByDay

## Phase 61: Settings-Driven Background Task Cadence (v5.9)

- [x] syncBackgroundTasks: re-registers price-check + health-probe tasks
- [x] Settings hook: re-register on checkInterval change (manual/hourly/daily)
- [x] Tests: syncBackgroundTasks (hourly, daily, manual)

## Phase 62: Full 30-Day Health History Window (v5.10)

- [x] HISTORY_MAX_SAMPLES raised from 90 to 720 (30 days at hourly cadence)
- [x] Updated pruneHealthHistory cap test

## Phase 63: Health Alerts (v5.11)

- [x] detectHealthAlert: fires on 3 consecutive blocked/error after working
- [x] scheduleHealthAlert notification (web-guarded, immediate)
- [x] checkHealthAlerts wired into probe task + collector flush
- [x] healthAlerts settings toggle (default on)
- [x] Tests: detectHealthAlert, checkHealthAlerts

## Phase 64: Health Alert Recovery Notifications (v5.12)

- [x] detectHealthRecovery: fires when last working follows 3+ non-working
- [x] scheduleHealthRecovery notification (web-guarded, immediate)
- [x] checkHealthAlerts fires recovery + outage alerts (shared healthAlerts toggle)
- [x] Tests: detectHealthRecovery, checkHealthAlerts recovery

## Phase 65: Health Alerts in Notification Center (v5.13)

- [x] NotificationHistoryEntry gains health type + healthStatus + optional productId
- [x] scheduleHealthAlert/scheduleHealthRecovery record history entries
- [x] Notification center renders health entries (status icon/color) + navigates to /health/[id]
- [x] Tests: health-notifications, notification-center-helpers

## Phase 66: Web Push for Health Alerts (v5.14)

- [x] scheduleHealthAlert/scheduleHealthRecovery display web notifications
- [x] Health history entries recorded on web too
- [x] Tests: web display + recording in health-notifications

## Phase 67: Server-Side Health Alert Mirroring (v5.15)

- [x] Server-side healthEvents processing in processEventBatch
- [x] sendPushForUser with excludeDeviceId param
- [x] tRPC uploadConfig schema with healthEvents array
- [x] Client PENDING_HEALTH_EVENTS storage CRUD
- [x] syncServerNotifications includes pending health events
- [x] checkHealthAlerts mirrors events to server buffer
- [x] Stable event id pattern + displayedEventId recording
- [x] Tests: health events processing, tRPC schema, storage CRUD, sync, health notifications

## Phase 68: Product Detail Screen Refactor (v5.16)

- [x] Extract openListingUrl to lib/listing-utils.ts
- [x] Extract shared StockBadge component
- [x] Extract BestDistributorCard to components/
- [x] Extract PriceHistoryChart to components/
- [x] Deduplicate StockBadge across tabs
- [x] Extract screen sub-components to _components.tsx
- [x] Refactor main component to composition root
- [x] StockBadge tests + verification

## Phase 69: Settings Screen Refactor (v5.17)

- [x] Extract SettingRow + SectionHeader to components/settings/
- [x] Extract PillPicker + RadioPicker (generic pickers)
- [x] Extract ConnectionSection, AccountSection, DeviceManagementSection
- [x] Extract NotificationsSection, ScraperStatusSection, AboutSection
- [x] Refactor main component to composition root
- [x] Picker tests + verification

## Phase 70: Watchlist Screen Refactor (v5.18)

- [x] Extract ProductCard to components/watchlist/
- [x] Extract SummaryCard, SearchBar, ProgressBar
- [x] Extract WatchlistHeader
- [x] Extract SortGroupBar, RegionFilterRow, EmptyState
- [x] Refactor main component to composition root

## Phase 71: Alerts Screen Refactor (v5.19)

- [x] Extract TabSwitcher to components/alerts/
- [x] Extract AlertCard to components/alerts/
- [x] Extract TriggeredAlertCard to components/alerts/
- [x] Extract StockWatchCard to components/alerts/
- [x] Extract ReminderCard to components/alerts/
- [x] Extract RescheduleModal to components/alerts/
- [x] Extract useAlertsData hook to hooks/
- [x] Refactor main component to composition root

## Phase 72: Compare Screen Refactor (v5.20)

- [x] Extract compare-utils.ts
- [x] Extract MultiLineChart to components/compare/
- [x] Extract CheapestRegionCard to components/compare/
- [x] Extract CompareHeader to components/compare/
- [x] Extract ChartCard to components/compare/
- [x] Extract CrossAlertCTA to components/compare/
- [x] Extract CurrentPricesTable to components/compare/
- [x] Extract DistributorSelector to components/compare/
- [x] Refactor main component to composition root

## Phase 73: Search Screen Refactor (v5.21)

- [x] Extract ProductImage to components/search/
- [x] Extract CatalogSearchBar to components/search/
- [x] Extract SearchEmptyState to components/search/
- [x] Extract CatalogProductCard to components/search/
- [x] Extract useSearchData hook to hooks/
- [x] Refactor main component to composition root

## Phase 74: Product Detail Sub-Components Refactor (v5.22)

- [x] Extract ProductInfoCard to components/product/
- [x] Extract ActionButtons to components/product/
- [x] Extract DistributorListingCard to components/product/
- [x] Extract DistributorListingSection to components/product/
- [x] Extract PriceAlertModal to components/product/
- [x] Extract ReminderDatePickerModal to components/product/
- [x] Extract PriceChartModal to components/product/
- [x] Clean up barrel re-exports

## Phase 75: Storage Refactor (v5.23)

- [x] Scaffold lib/storage/ directory (adapter, context)
- [x] Extract watchlist storage
- [x] Extract alerts storage
- [x] Extract settings + tags storage
- [x] Extract reminders + stock watches storage
- [x] Extract digest snapshot + fx rates storage
- [x] Extract sync meta storage
- [x] Extract notifications storage (displayed ids, history, health events)
- [x] Public API unchanged (54 methods, named exports preserved)

## Phase 76: Server Notifications Refactor (v5.24)

- [x] Scaffold server/notifications/ directory (types, memory-store, mappers)
- [x] Extract build-events module (event drafting + dedup keys)
- [x] Extract evaluate module (memory/db evaluation paths)
- [x] Finalize index (upsert, health mirroring, pull)
- [x] Public API unchanged (5 functions + 2 types)

## Phase 77: Device Management Refactor (v5.25)

- [x] Extract platformLabel/formatLastSeen to device-utils.ts with unit tests
- [x] Extract useDeviceManagement hook (state, callbacks, effects)
- [x] Extract CurrentDeviceRow to components/settings/device-management/
- [x] Extract DeviceRow to components/settings/device-management/
- [x] Extract RenameDeviceModal to components/settings/device-management/
- [x] Refactor main section to composition root

## Phase 78: Background Tasks Refactor (v5.26)

- [x] Scaffold lib/background-tasks/ (shared singletons, health alerts)
- [x] Extract health collector
- [x] Extract listing refresh
- [x] Extract price check core (+ foreground entry)
- [x] Extract task definitions + registration, convert original to barrel
- [x] Public API unchanged (9 exports)

## Phase 79: Watchlist Statistics (v5.27)

- [x] Add pure stats module (movers, basket value, stock health, freshness)
- [x] Unit-test stats computations incl. edge cases
- [x] Build Movers/Basket/StockHealth/Freshness cards
- [x] Add Statistics screen (app/stats.tsx) with empty state
- [x] Wire "View statistics" entry from Watchlist summary card

## Phase 80: Data Export/Import (v5.28)

- [x] Add pure backup module (build/parse/apply, merge-by-id) with unit tests
- [x] Add platform file transport (share sheet, web download, document picker/upload)
- [x] Add Data section to Settings with Export/Import rows
- [x] Stamp sync-meta on import so signed-in imports win LWW

## Phase 81: Bulk Watchlist Import (v5.29)

- [x] Add pure parse/match module (separators, quotes, dedupe, exact matching)
- [x] Unit-test parsing and catalog matching edge cases
- [x] Build paste-sheet modal with live matched/not-found preview
- [x] Wire "Import list" button into Search screen header

## Phase 82: Rich Text Price Share (v5.30)

- [x] Add pure share-text builder (top-5 in-stock prices, FX conversion, OOS fallback)
- [x] Unit-test formatting edge cases
- [x] Wire product detail Share button to the new comparison text

## Phase 83: Alert Price Suggestions (v5.31)

- [x] Add pure suggestion module (near-low, below-avg, under-current)
- [x] Unit-test strategy math, dedupe, FX guards
- [x] Render suggestion chips in Set Price Alert modal
- [x] Wire suggestions into product detail screen

## Phase 84: Watchlist Share (v5.32)

- [x] Add pure watchlist share-text builder (basket, top drops, stock health)
- [x] Unit-test formatting incl. section omission and window labels
- [x] Add share button to Statistics screen header

## Phase 85: Manual Add with LLM-Assisted Cleanup (v5.33)

- [x] Add server-side product text parsing via LLM (products.parse endpoint)
- [x] Add listing discovery across all distributors (fetchServerPrice reuse)
- [x] Add custom product slug + tRPC parse wrapper with timeout
- [x] Build two-step ManualAddSheet (paste → AI cleanup → review → add + discover)
- [x] Wire manual-add button into Search screen header

## Phase 86: Distributor-Scoped Alerts (v5.34)

- [x] Add listingsForAlert helper with tests
- [x] Fix client alert evaluation to honor distributor scoping
- [x] Add distributor picker chips to Set Price Alert modal
- [x] Fix per-distributor "best alert" button to actually scope its alert
- [x] Show distributor badge on scoped alerts in the alerts list

## Phase 87: Swipe-to-Delete + Undo (v5.35)

- [x] Add SwipeableCard wrapper (gesture-handler Swipeable, red Remove action)
- [x] Wire swipe-delete into watchlist cards (no confirm on swipe path)
- [x] Add 5-second undo snackbar restoring the full product

## Phase 88: Chart Scrubbing (v5.36)

- [x] Add indexForLocationX + nearestByX helpers with tests
- [x] Drag scrubbing on product detail price history chart
- [x] Crosshair + multi-distributor tooltip on compare chart

## Phase 89: Recent Searches (v5.37)

- [x] Add recent-searches module with injectable storage + tests
- [x] Add recent chips row under the search bar
- [x] Record queries on submit; tap chip to re-run; clear-all action

## Phase 90: Product Notes (v5.38)

- [x] Add product-notes module with injectable storage + tests
- [x] Add editable Notes card on product detail

## Phase 91: Price-Increase Alerts (v5.39)

- [x] Add direction field to PriceAlert (backward-compatible)
- [x] Branch client + server evaluation and notification copy per direction
- [x] Handle price_rise events in client reconciliation
- [x] Add Drops/Rises segmented control to alert modal
- [x] Show direction arrows on alert cards

## Phase 92: Image Share Cards (v5.40)

- [x] Extract shared buildShareRows data layer
- [x] Add view-shot capture transport with web download + native share sheet
- [x] Add branded product + watchlist share cards
- [x] Add Image/Text choice sheet with automatic text fallback

## Phase 93: Distributor Target Table (v5.41)

- [x] Add scopedAlertFor/productWideAlert helpers with tests
- [x] Add target comparison table card on product detail
- [x] Quick-set buttons open pre-scoped alert modal

## Phase 94: Enhanced Weekly Digest (v5.42)

- [x] Extend digest computation (value delta, new/removed products, mover sorting)
- [x] Smarter push notification (value delta lead, ~9 lines)
- [x] Add full in-app digest card on Stats screen

## Phase 95: Product Insights (v5.43)

- [x] Add pure insights module (all-time lows, drop streaks, volatility)
- [x] Unit-test metrics incl. FX skips and edge cases
- [x] Add Product Insights card to Stats screen

## Phase 96: Price vs Average (v5.44)

- [x] Add pure price-vs-average computation with tests
- [x] Add verdict indicator card on product detail

## Phase 97: Drop Calendar (v5.45)

- [x] Add pure drop-calendar computation with tests
- [x] Add heatmap grid card with tap-for-details on Stats screen

## Phase 98: Watchlist Insight Chips (v5.46)

- [x] Surface all-time-low / dropping chips on watchlist cards

## Phase 99: Snooze Alerts (v5.47)

- [x] Add snoozedUntil field + snoozeAlert storage method
- [x] Skip snoozed alerts in client + server evaluation
- [x] Fix direction passthrough in notification config upload
- [x] Add snooze button, choice sheet, and snoozed badge on alert cards

## Phase 100: Notification Deep Links (v6.0)

- [x] Carry productId in all product notification payloads
- [x] Route notification taps to product/stats/health screens
- [x] Server-pulled events preserve productId through local re-scheduling

## Phase 101: Alert Editing (v6.1)

- [x] Add updateAlert storage method (patch semantics, auto re-arm)
- [x] Edit-mode copy in PriceAlertModal
- [x] Pencil entry on alert cards opens prefilled modal on alerts tab

## Phase 102: Product Editing (v6.2)

- [x] Add updateProductDetails storage method
- [x] Add editable product details sheet
- [x] Pencil entry on ProductInfoCard

## Phase 103: Onboarding (v6.3)

- [x] Add onboarding flag module with injectable storage + tests
- [x] Add 3-slide intro pager (Welcome / Add Anything / Alerts)
- [x] Gate first launch in root layout

## Phase 104: Basket Alert (v6.4)

- [x] Add basketAlertThreshold setting (synced)
- [x] Evaluate in background price check; fires once then auto-disables
- [x] Bell + threshold sheet on Stats basket card

## Phase 105: Digest Schedule Settings (v6.5)

- [x] Add digestDayOfWeek setting
- [x] Weekly digests fire on the chosen weekday
- [x] Add Price Digest frequency + day pickers to Settings (fixes missing enable UI)

## Phase 106: Audit Hardening (v6.6)

- [x] Sync LWW clientUpdatedAtMs columns (migration 0014)
- [x] Notification event dedup indexes + orphan cleanup (migration 0015)
- [x] OAuth callback single-use code replay guard
- [x] Scraper/browser resilience fixes

## Phase 107: Auth-Gated Notification Endpoints (v6.7)

- [x] uploadConfig / pull / registerPushToken require sign-in (protectedProcedure)
- [x] Server derives deviceId from context (session claim → x-device-id header)
- [x] assertDeviceAccess ownership guard (unbound adopts, foreign rejects)
- [x] Web notification poll gates on auth state; desktop sends x-device-id header

## Phase 108: Parser Model Verification (v6.8)

- [x] matchesModel boundary-aware matcher + productRowContext/modelMismatch helpers
- [x] parsePrice(html, model?) contract; all 25 parsers verify priced row vs requested model
- [x] Mismatch = miss: no cache/history write, existing health error path
- [x] Cross-parser guard tests over full registry

## Phase 109: Audit 5 - v5.2

- [x] BestDistributorCard parity (bestPrice→formatPrice, converter fix) + a11y
- [x] ReminderSection: permission gate + reminderType + null shipping
- [x] Desktop SearchModal (399→365): history dedupe/getItemLayout/Fuse per-call/removeClippedSubviews/android
- [x] Mikrotikstore parser live-site fix: two-hop search, .price-tag, German format
- [x] FX history sparse write guard + jitter ±5m
- [x] 5 regression suites (currency, trending tRPC, price stability, GB→GBP, watchlist sort)

## Phase 110: v5.2.1 — E2E + audit 5 remainder

- [x] FX history: gap vs flat, duplicate ts dedup, jitter ±5m (8217171)
- [x] Sync/server: COALESCE legacy IS NULL accept, accepted via ROW_COUNT, pool string form, watchlist union, PRICE_TTL guard, decimal(12,4)
- [x] Scrapers: resilient skipped→promise share, browser pool mutex outside launch, mikrotikstore URL thread + German format
- [x] Tauri: parse_query_params whitespace split + 120s timeout, storage split-brain filing, price-drop snooze + blocked
- [x] E2E: endpoint drift (fetchTrending/discoverProduct → tRPC superjson), desktop build aliases + RN/expo/playwright stubs (cargo check + expo export)
- [x] Version sync: 5.2.1 → package/app.config/desktop/Cargo/tauri.conf

## Phase 111: v5.3 — Desktop parity shared package

- [x] `shared/src/` — 6 pure modules: catalog, distributors, currency, fx, trending, compare-utils (bf1379b)
- [x] `lib/` shims: `export * from "@shared/*"` + storage side-effect wrappers (currency liveRates, fx AsyncStorage) (9be9161)
- [x] `desktop/vite.config.ts`: 4 regex aliases → `@shared → ../shared/src` + `@ → ..` + RN/expo/playwright stubs retained (9be9161)
- [x] `desktop/src/pages/Rates.tsx` + `/rates` route + `FxRateGrid` (sparkline, change %, refreshFxRates with storage param) (a07a041)
- [x] `desktop/src/components/SearchModal.tsx` + `desktop/src/pages/Search.tsx`: Fuse 0.4 + discovered 50 + Bulk/Manual sheets + Recent + tag pre-assign (a07a041)
- [x] `desktop/src/pages/Watchlist.tsx`: selectedIds + selectionMode + checkbox + undoProduct 5s (a07a041)
- [x] `vitest.config.ts`: `@shared → shared/src` so lib shims resolve in tests (5a87dfc)
- [x] Version sync: 5.3.0 → package/app.config/desktop/Cargo/tauri.conf

## Phase 112: P1 Auth + Sync Docs Sync (v5.4 docs)

- [x] GAP-01 — design.md: 5-tab nav verified + Rates (`app/(tabs)/rates.tsx` `FxRateGrid` + `FxSparklineCard`, pull-to-refresh `refreshFxRates`, `formatLastRefreshed`), Stats (`app/stats.tsx` 7 cards: Movers/Basket/StockHealth/Freshness/Digest/Insights/DropCalendar), Health (`app/health.tsx` + `app/health/[id].tsx`, `HEALTH_PROBE_TASK` scheduling on `checkInterval`, `resilientFetch` circuit breaker + `classifyFetchStatus`/`BLOCKED_MARKERS`)
- [x] GAP-02 — AGENTS.md: Directory Layout lists 5 tabs (index/home, watchlist, alerts, rates, settings); Server section documents device binding (session JWT `deviceId` claim → `x-device-id` header, `assertDeviceAccess` per-user ownership, unrevoke on login, 30-day idle `cleanupStaleDevices`, `revokedDevices` user-scoped composite keys)
- [x] GAP-03 — todo.md: gaps marked addressed via this Phase 112 follow-up
- [x] GAP-04/P1 — `components/settings/account-section.tsx`: `emailVerified:false` shows "Verify your email — check your inbox" banner with Resend CTA (`POST /api/auth/resend-verification`, `hooks/use-auth.ts:resendVerification`)

## Phase 113: v5.4 — Tauri E2E + P1 Polish

- [x] `cargo check` (Tauri) + `expo export` (web) + `pnpm check` (root `tsc 0` + desktop vite 4.2s + `145 passed` + `36 tests`) all green at `33a0256`
- [x] Desktop bulk/tag/alert parity, tag collapse, thumbnail herds, drift, contrast, health `blocked` parity
- [x] Version sync: 5.4.0 → package/app.config/desktop/Cargo/tauri.conf

## Phase 114: v5.4.1 — Currency migration, Rates live-FX, Expo config fix

- [x] Currency migration: 26 pure-only files → `@shared/currency`, 10 mixed files split (live `convertPrice`/`getBestPrice` stay on `@/lib/currency`); `FX_TTL_MS` single-sourced in `shared/src/fx.ts` (`96123cd`); guard test asserts live-vs-pure contract (`tests/shared-desktop-criticals.test.ts`)
- [x] Dead-code cleanup: removed `watchlistToSummaryCsv`, `getEventLabel`, `formatQuietHoursLabel`; un-exported `parseQuietTime`, `COUNTRY_TAX_RATES`; strengthened 2000-char truncation test (`857c039`)
- [x] Rates live-FX parity: spec (`docs/superpowers/specs/2026-09-06-rates-live-fx-parity-design.md`) + plan (`docs/superpowers/plans/2026-09-06-rates-live-fx-parity.md`); mobile mount `maybeRefreshFxRates` (`4ddf7cd`); reload history after refresh settles, mobile + desktop (`8f6d5cc`)
- [x] Expo config fix: `app.config.ts` extensionless `./scripts/app-links` import broke every Expo command since `23634f2`; helpers inlined, `scripts/app-links.ts` removed, test repointed (`6ea0955`); `expo export -p web` green
- [x] E2E: `cargo check` + desktop vite 3.05s + `pnpm check` (`tsc 0`) + lint (0 errors) + `166 passed` files / `1362 passed` tests all green
- [x] Version sync: 5.4.1 → package/app.config (drift fixed: was 5.3.0)/desktop/Cargo/tauri.conf; tag `v5.4.1` (`803ab71`)

## Phase 115: Desktop web-preview refresh fix

- [x] Problem: outside Tauri, Watchlist Refresh only bumped `lastRefreshed` via `refreshWatchlistPrices()` — prices never fetched, toast still claimed success
- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-refresh-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-refresh.md`): per-listing tRPC `prices.get`, concurrency 3, `composeLiveListings` merge, `updateProductListings` persist, no server changes
- [x] Guard test (`tests/desktop-watchlist-refresh.test.ts`) + implementation (`5aff904`, `b617b0a`): Tauri path first, else server fetch with `Refreshed X of Y` / `Couldn't refresh prices` / `Live prices need a server connection or the Tauri app` toasts; bare timestamp bump removed
- [x] Hardening (`bce77dc`): helper throw still reloads UI + error toast instead of silent spinner stop
- [x] E2E: `tsc 0`, lint 0 errors, `167 passed` files / `1363 passed` tests, desktop vite build green

## Phase 116: Silent failures + auth log leak

- [x] Spec (`docs/superpowers/specs/2026-09-06-silent-failures-design.md`) + plan (`docs/superpowers/plans/2026-09-06-silent-failures.md`): 3 tiers, zero user-facing behavior change
- [x] Tier 1 (`478e8b9`): `lib/_core/auth.ts` logging gated behind `__DEV__` (api.ts pattern); token prefix → `present`/`missing`, full user object → `user.id`
- [x] Tier 2 (`680bbf2`): `scheduleHealthAlert` settings-read failure logs in dev, alert still sends (explicit fail-open)
- [x] Tier 3 (`a81ef7a`, `6c01081`): dev-only logs for watchlist badge/persist/share + compare/product image→text fallback; dismissal catches intentionally left silent
- [x] Guards (`tests/silent-failures.test.ts`, `ba6fd97`); E2E: `tsc 0`, lint 0 errors, `168 passed` files / `1367 passed` tests

## Phase 117: Security-critical module tests + Infinity fix

- [x] 52 new tests via 4 parallel agents (`946212f`): rate-limit (9), quiet-hours (7), price-events (24), price-freshness (12)
- [x] Fixed: `Infinity` prices passed the positivity guard → spurious rise/drop events; now require `Number.isFinite` (`6ead6d1`); restock-precedence + sorted-index semantics kept (both chart callers pre-sort)
- [x] E2E: `tsc 0`, lint clean, `172 passed` files / `1419 passed` tests

## Phase 118: Deprecated lib shim removal

- [x] Spec (`docs/superpowers/specs/2026-09-06-shim-removal-design.md`) + plan (`docs/superpowers/plans/2026-09-06-shim-removal.md`)
- [x] Deleted 4 pure shims (`lib/distributors/catalog/trending/compare-utils.ts`); ~60 importers repointed per-location (`@shared/*`, `../shared/src/*.js`, `./`→`@shared/`), incl. depth variants + hooks/ caught by sweep/tsc
- [x] `lib/currency.ts` → live-rate layer, `lib/fx.ts` → persistence layer (headers rewritten, pure re-exports dropped); 16 straggler files split pure→shared; obsolete wrapper assertion removed from `tests/shared-boundary.test.ts`
- [x] Guards (`tests/no-lib-shims.test.ts`, `66a248e`); commits `88cd8d0`/`c29d9dd`/`df41be0`
- [x] E2E: `tsc 0`, lint 0 errors, `173 passed` files / `1421 passed` tests, desktop build + web export green

## Phase 119: Desktop P1 parity (shared links + alerts retry)

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-p1-parity-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-p1-parity.md`)
- [x] Shared links open on desktop: `/w/:token` route + `SharedWatchlist` page (public `sharedWatchlists.get`, rows, bulk add with toasts, loading/not-found states); polished to `useQuery` hook + best-price rows (`2ecab36`, `e4e89ab`, `30095ec`)
- [x] Alerts reminders can't spin forever: `loadReminders` with error banner + Retry (`a4b0806`)
- [x] E2E: `tsc 0`, lint 0 errors, `174 passed` files / `1424 passed` tests, desktop build green

## Phase 120: Desktop P2 watchlist (share, check-now, filters, CTA)

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-p2-watchlist-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-p2-watchlist.md`)
- [x] Share-to-clipboard with fallback + toasts; empty-state CTA → `/search` via new optional `EmptyState` action prop (`a1eb8d1`)
- [x] In-stock toggle + Min/Max range in single-pass memo, persisted to mobile's settings keys with sentinel-aware load; review-caught `displayCurrency` dep fix (`6955e55`, `eda3fa4`)
- [x] Check-Now: full pipeline via dynamic import (bundle-safe, no fallback needed), progress + re-entrancy guard (`83e8bb5`)
- [x] Guards (`tests/desktop-p2-watchlist.test.ts`); E2E: `tsc 0`, lint 0 errors, `175 passed` files / `1428 passed` tests, desktop build green

## Phase 121: Desktop P3a (compare CTA + browser insight)

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-p3a-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-p3a.md`)
- [x] Compare cross-distributor alert CTA: sentinel `cross-` alerts via `addAlert`, hidden when no actionable target (`fbf46ab`)
- [x] ProductDetail AI insight outside Tauri via vanilla `insights.get` (4s race); Tauri path intact, no expo-chain import (`bbfad8b`)
- [x] Guards (`tests/desktop-p3a.test.ts`); E2E: `tsc 0`, lint 0 errors, `176 passed` files / `1430 passed` tests, desktop build green

## Phase 122: Desktop P3b-1 (connection, sync-now, test notification)

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-p3b1-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-p3b1.md`)
- [x] Connection section with manual check (`2e959d4`); Sync-Now via shared engine in signed-in branch (`df5e419`); web test-notification with unsupported/denied paths (`797fc3e`)
- [x] Guards (`tests/desktop-p3b1-settings.test.ts`); E2E: `tsc 0`, lint 0 errors, `177 passed` files / `1433 passed` tests, desktop build green

## Phase 123: Desktop P3b-2 (LLM, scraper, about settings)

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-p3b2-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-p3b2.md`)
- [x] LLM provider section: 4 providers, debounced drafts + blur-save to syncing keys (`f1a574a`)
- [x] Scraper-status section: verbatim thresholds + working Re-enable; registry import proven bundle-safe (`b084092`)
- [x] About section: version from `package.json`, PWA install, rate/support/privacy; no account deletion (`f82a82b`)
- [x] Guards (`tests/desktop-p3b2-settings.test.ts`); E2E: `tsc 0`, lint 0 errors, `178 passed` files / `1436 passed` tests, desktop build green

## Phase 124: Desktop P3c (not-found retry + stats export)

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-p3c-design.md`, option 2: PNG export) + plan (`docs/superpowers/plans/2026-09-06-desktop-p3c.md`)
- [x] ProductDetail not-found Try Again via extracted `loadProduct` (dead cancel flag noted as optional cleanup) (`1c7724e`)
- [x] Stats PNG export (`html-to-image@1.11.13`) with text fallback; header Share button (`538314a`)
- [x] Guards (`tests/desktop-p3c.test.ts`); E2E: `tsc 0`, lint 0 errors, `179 passed` files / `1438 passed` tests, desktop build green

## Phase 138: A11y + copy bundle

- [x] ResetPassword: real form, single submit path, autocomplete, `aria-invalid`/`describedby`
- [x] Price range: `aria-invalid` + `role="alert"`; onboarding dots arrow-key nav (aria-current was already correct)
- [x] Removed dead selection vars; search placeholder advertises brand/category
- [x] E2E: `tsc 0`, lint exit 0 (`08e740e`)

## Phase 125: Lint + catch hygiene sweep

- [x] Lint 11 → 0 warnings via 3 parallel agents: duplicate imports, unused vars, `Array<T>` casts, 5 `exhaustive-deps` (3 safe fixes, 1 intentional-disable, 1 unused-dep removal)
- [x] Triaged ~18 bare catches: benign best-effort stays silent; dev-logging added for price-chart export, About logout-during-delete, 2 notification quiet-hours paths
- [x] E2E: `tsc 0`, lint exit 0, `179 passed` files / `1438 passed` tests (`6723039`)

## Phase 126: Review-note fixes + shared useToast

- [x] `loadProduct` dead cancel flag → request-id guard on all await points (`65aea3f`)
- [x] Scraper "Never checked" flash → loading state (`65aea3f`)
- [x] New `desktop/src/hooks/use-toast.ts` (timer cleared on re-show + unmount); migrated all 10 toast sites (`65aea3f`, `49a7318`)
- [x] E2E: `tsc 0`, lint exit 0, desktop build green

## Phase 164: Desktop notification history + badges

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-notif-history-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-notif-history.md`)
- [x] Rust `price-drops-triggered` event with tested payload; return/notify/deactivate untouched (`9a188e6`)
- [x] TS recording with per-event isolation + sidebar unread bubble (`4dd43ac`); Cargo.lock version sync (`6e82f7b`)
- [x] Guards (`tests/desktop-notif-history.test.ts`); E2E: `tsc 0`, lint 0 errors, tests green, `cargo check` + `cargo test` green, desktop build green

## Phase 165: Desktop search + polish bundle

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-search-polish-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-search-polish.md`)
- [x] CSV export, navigate-after-add, query prefill (`1377fdb`); rate row removed, health errors, restock copy (`3325258`)
- [x] Guards (`tests/desktop-search-polish.test.ts`); E2E: `tsc 0`, lint 0 errors, `209 passed` files / `1537 passed` tests, desktop build green

## Phase 161: Deal-score follow-ups (dedup, labels, guard)

- [x] Conversion/streak deduped into `product-insights` exports; shared `dealBandLabel` everywhere (mapping test pinned)
- [x] Wait-filter inside `rankDeals`; email empty-guard (`c91806a`, `13f2fb2`)

## Phase 162: Desktop product notes + edit sheet

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-notes-edit-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-notes-edit.md`)
- [x] Notes card (store-backed, empty deletes) + edit sheet (dirty-gated, reload + toast) (`f95f08d`); unused-import build fix (`d32d74d`)
- [x] Guards (`tests/desktop-notes-edit.test.ts`); E2E: `tsc 0`, lint 0 errors, `206 passed` files / `1523 passed` tests, desktop build green

## Phase 163: Desktop targets + per-row reminders

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-targets-reminders-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-targets-reminders.md`)
- [x] Distributor Targets table (scoped + wide fallback, modal CTA) (`b70e34c`); per-row Remind reusing global modal (`c7170f7`)
- [x] Guards (`tests/desktop-targets-reminders.test.ts`); E2E: `tsc 0`, lint 0 errors, `207 passed` files / `1525 passed` tests, desktop build green

## Phase 158: Deal score engine + surfaces

- [x] Spec (`docs/superpowers/specs/2026-09-06-deal-score-design.md`) + plan (`docs/superpowers/plans/2026-09-06-deal-score.md`)
- [x] Deterministic 50/30/10/−10 engine, hot ≥ 75, nulls on thin data, 9 unit tests (`82b499c`)
- [x] Mobile Best-deals sort + card + chip (`a923845`); desktop score column + card + chip, session-only sort (`56d38d0`, `7650e2b`)
- [x] Guards + surfaces tests; E2E: `tsc 0`, lint 0 errors, `204 passed` files / `1513 passed` tests, desktop build green

## Phase 159: Smart digest best-time-to-buy

- [x] Spec (`docs/superpowers/specs/2026-09-06-smart-digest-design.md`) + plan (`docs/superpowers/plans/2026-09-06-smart-digest.md`)
- [x] `rankDeals` helper + unit tests; both digest cards with navigation, wait-band filtered (`5780c1a`, `b84543a`, `bbe21f2`)
- [x] Guards; E2E: `tsc 0`, lint 0 errors, `205 passed` files / `1517 passed` tests, desktop build green

## Phase 160: Grounded LLM insights

- [x] Spec (`docs/superpowers/specs/2026-09-06-grounded-insights-design.md`) + plan (`docs/superpowers/plans/2026-09-06-grounded-insights.md`)
- [x] `dealScore` in LLM context + consistency sentence; cache/UI untouched (`1ec311d`)
- [x] Mocked-LLM tests; E2E: `tsc 0`, lint 0 errors, `205 passed` files / `1520 passed` tests

## Phase 157: Desktop compare + shared upgrades 2

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-compare-shared2-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-compare-shared2.md`)
- [x] Compare Back/Refresh header + not-found CTA (`153d956`); chart PNG export + biggest-drop-first trend sort, default unchanged (`5092885`)
- [x] Shared 5-listing rows + overflow, per-product history CSV, full meta line (`7f6cf94`)
- [x] Guards (`tests/desktop-compare-shared2.test.ts`); E2E: `tsc 0`, lint 0 errors, `202 passed` files / `1498 passed` tests, desktop build green

## Phase 155: Desktop auth hardening follow-ups

- [x] Shared `authedFetch` (base guard); `resetPassword`/`deleteAccount`/`resendVerification` wrappers; aligned `mapUser`
- [x] OAuth gate on change-password; centralized validation, red errors, success toasts
- [x] Behavioral tests (`desktop/tests/auth-functions.test.ts`, 8 tests); E2E: root + desktop `tsc 0`, root suite green

## Phase 156: Desktop list awareness

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-list-awareness-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-list-awareness.md`)
- [x] Offline queued-edits banner in both empty and main paths; insight badges in name cells; tab counts matching contents (`17c1abd`, `7603358`, `6254eff`)
- [x] Guards (`tests/desktop-list-awareness.test.ts`); E2E: `tsc 0`, lint 0 errors, `201 passed` files / `1495 passed` tests, desktop build green

## Phase 154: Desktop email/password auth

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-email-auth-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-email-auth.md`)
- [x] REST functions with session store + notify (`6892d3c`); sign-in/sign-up UI (`486d976`); change-password UI (`015e786`)
- [x] Guards (`tests/desktop-email-auth.test.ts`); E2E: `tsc 0`, lint 0 errors, `200 passed` files / `1493 passed` tests, desktop build green

## Phase 153: Desktop notification settings parity

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-notif-settings-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-notif-settings.md`)
- [x] Health Alerts toggle (master-gated); digest-day segmented (weekly only); quiet hours with helper (`3aa5d68`)
- [x] Guards (`tests/desktop-notif-settings.test.ts`); E2E: `tsc 0`, lint 0 errors, `199 passed` files / `1491 passed` tests, desktop build green

## Phase 150: Correctness follow-ups 4

- [x] Shared `fetchListingsWithTimeout` (`desktop/src/lib/server-prices.ts`); real behavioral tests (order, isolation, timeout, empty)
- [x] Compare param scoped per-product, stamp-on-match; single-source retry; toast `role="status"` everywhere
- [x] Pushed as `44bbee6`

## Phase 151: Desktop full backup

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-backup-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-backup.md`)
- [x] Export all collections; import with preview confirm, sync-meta stamping, reload; zero Rust changes (`e8cdc1a`, `7b5f97a`)
- [x] Guards + round-trip (`tests/desktop-backup.test.ts`); E2E: `tsc 0`, lint 0 errors, `197 passed` files / `1486 passed` tests, desktop build green

## Phase 152: Desktop share + notifications + search tags

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-share-notify-search-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-share-notify-search.md`)
- [x] Compare text share; product PNG export; notification open + single-read; search tag matches + counts (`17bf086`, `bb2bd28`, `a464d92`, `1879c4c`)
- [x] Guards (`tests/desktop-share-notify-search.test.ts`); E2E: `tsc 0`, lint 0 errors, `198 passed` files / `1489 passed` tests, desktop build green

## Phase 148: Correctness follow-ups 3

- [x] Shared `fetchListingsWithTimeout` helper (`desktop/src/lib/server-prices.ts`); both call sites rewritten identically
- [x] Compare `?distributor=` re-nav without remount; retry masking fixed; toast `role="status"` on all sites
- [x] Pushed as `847875b`

## Phase 149: Mobile parity (compare param + digest helper)

- [x] Mobile compare honors `?distributor=` (init + re-apply, validation, no reseed; stamp-on-match fix) (`2399eec`, `e44e998`)
- [x] `maybeSendDigest` adopts shared `buildDigestSnapshot` (additive `now` param, field-for-field)
- [x] E2E: `tsc 0`, `195 passed` files / `1480 passed` tests

## Phase 147: Desktop correctness follow-ups 2

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-correctness2-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-correctness2.md`)
- [x] Per-row compare focus via distributor param + named labels (`c2d71c0`)
- [x] Honest live-price refresh (fetch-merge-persist, stamp on fresh, dead state removed) (`9a8db54`)
- [x] First-load probe failures surface banner; shared `buildDigestSnapshot` with dev-logged saves (`585e2e4`, `cade125`, `a1840d0`)
- [x] Guards (`tests/desktop-correctness2.test.ts`); E2E: `tsc 0`, lint 0 errors, `195 passed` files, desktop build green

## Phase 144: Correctness follow-ups (retry, digest, visibility, FX)

- [x] Retry handlers capture storage errors explicitly (hooks rethrow via try/finally)
- [x] Digest off-branch saves fresh baseline; non-empty error banner; `hasLoadedOnce` probe gate; FX labels match card precision
- [x] Pushed as `b5a4dd9`

## Phase 145: Desktop navigation + dead-ends

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-navigation-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-navigation.md`)
- [x] Actionable restock rows (product links, error handling, CTA) + sidebar entries (`80689aa`)
- [x] Rates copy fix; out-of-stock best-price links out, loading spinner preserved (`ac026ca`)
- [x] Guards (`tests/desktop-navigation.test.ts`); E2E: `tsc 0`, lint 0 errors, `193 passed` files / `1474 passed` tests, desktop build green

## Phase 146: Desktop product intelligence

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-product-intel-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-product-intel.md`)
- [x] Vs-average card with exact mobile copy (`f758fdc`); per-row history links + refresh with recency (`1b7f3a5`)
- [x] Guards (`tests/desktop-product-intel.test.ts`); E2E: `tsc 0`, lint 0 errors, `194 passed` files / `1476 passed` tests, desktop build green

## Phase 142: Correctness bundle (digest gate, error states, labels)

- [x] Digest respects frequency (off → placeholder, no self-erase)
- [x] Home/Watchlist list-load error banners + Retry with explicit storage probes (hooks never reject) (`d016ae5`, `cb1c141`)
- [x] HealthDetail ineffective aria-labels removed (strip summary kept)

## Phase 143: Desktop stats parity 2

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-stats-parity2-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-stats-parity2.md`)
- [x] Basket threshold sheet + banner (`<=` aligned) (`dde317b`, `c1d4617`); keyboard calendar (`81d7642`); formatted sparklines + share chooser (`e29053f`)
- [x] Guards (`tests/desktop-stats-parity2.test.ts`); E2E: `tsc 0`, lint 0 errors, `192 passed` files / `1471 passed` tests, desktop build green

## Phase 139: Desktop error-path hardening

- [x] Loaders extracted with error cards + Retry: Stats, Compare, ProductDetail (reuses not-found block), HealthDetail (+ labeled timeline), DistributorAnalysis; Search tracked-ids stays best-effort (`d250f13`)
- [x] E2E: `tsc 0`, lint exit 0

## Phase 140: Desktop stats parity

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-stats-parity-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-stats-parity.md`)
- [x] Digest card with snapshot flow, insights card, drop-calendar grid, 7/30/All movers switcher, slice caption; latent null-cutoff fix (`a13a6d5`, `e722c04`, `b2d68cf`)
- [x] Guards (`tests/desktop-stats-parity.test.ts`); E2E: `tsc 0`, lint 0 errors, `190 passed` files / `1465 passed` tests, desktop build green

## Phase 141: Desktop safety + charts a11y

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-safety-charts-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-safety-charts.md`)
- [x] Typed delete confirmation (email or DELETE fallback) (`6f860a2`); dialog-wide tour keys (`cde45fc`); truthful chart labels (`d8b57a2`)
- [x] Guards (`tests/desktop-safety-charts.test.ts`); E2E: `tsc 0`, lint 0 errors, `191 passed` files / `1468 passed` tests, desktop build green

## Phase 135: Quick-wins bundle 2 (empty chrome, price hint, faceted counts)

- [x] Empty/loading states render message only (dead Select/Cancel removed) (`6555784`)
- [x] Invalid price-range hint (empty inputs stay silent, invalid never persists) (`6555784`)
- [x] Faceted tag counts in a single shared pass (`6b49d87`)

## Phase 136: Desktop refresh hardening

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-refresh-hardening-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-refresh-hardening.md`)
- [x] 20s per-query timeout into the miss path; `Refreshing x/y` progress, cleared in `finally` (`a17f253`)
- [x] Guards (`tests/desktop-refresh-hardening.test.ts`); E2E: `tsc 0`, lint 0 errors, `188 passed` files / `1461 passed` tests, desktop build green

## Phase 137: Desktop table accessibility

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-table-a11y-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-table-a11y.md`)
- [x] `aria-rowcount`/`rowindex`, `aria-sort` on 4 headers, labeled trend images, `aria-pressed` on toggle buttons; invalid label attribute caught + removed (`05fc115`, `15a30a1`)
- [x] Guards (`tests/desktop-table-a11y.test.ts`); E2E: `tsc 0`, lint 0 errors, `189 passed` files / `1463 passed` tests, desktop build green

## Phase 134: Desktop watchlist virtualization

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-virtualization-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-virtualization.md`)
- [x] Windowed table via `@tanstack/react-virtual@3.14.11` (76px estimate, overscan 8, dynamic measurement, spacer rows); verbatim row/header markup (`8ef9b18`)
- [x] Follow-up: flattening extracted to tested `desktop/src/lib/watchlist-rows.ts` (5 unit tests) + guard retarget (`4f32966`)
- [x] Guards (`tests/desktop-virtualization.test.ts`); E2E: `tsc 0`, lint 0 errors, `187 passed` files / `1459 passed` tests, desktop build green

## Phase 132: Desktop shared filter unification

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-shared-filter-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-shared-filter.md`)
- [x] `filtered` memo + tag-counts pre-filter delegate to shared `filterWatchlist` (query gains brand/category, null-safe status); sort model untouched (`bea6d3d`)
- [x] Lint follow-up: `showToast` deps (`97692a7`)
- [x] Guards (`tests/desktop-shared-filter.test.ts`); E2E: `tsc 0`, lint 0 warnings, `184 passed` files / `1449 passed` tests, desktop build green

## Phase 133: Desktop shared page upgrades

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-shared-upgrades-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-shared-upgrades.md`)
- [x] Retry via `refetch`, display-currency best prices, per-item Add with Added-state, CSV export (`a7161fc`)
- [x] Lint follow-up: `showToast` dep + `Array<T>` (`0910375`)
- [x] Guards (`tests/desktop-shared-upgrades.test.ts`); E2E: `tsc 0`, lint exit 0, `185 passed` files / `1452 passed` tests, desktop build green

## Phase 128: Desktop account deletion

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-account-deletion-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-account-deletion.md`)
- [x] Danger Zone "Delete account & data": Bearer + `{confirm:"DELETE"}` → abort-before-wipe → logout → clear + reload; signed-in only, both actions locked (`24d63af`, `1357866`)
- [x] Superseded P3b-2 no-delete assertion removed (ordering covered by new guards) (`a1c540c`)
- [x] Guards (`tests/desktop-account-deletion.test.ts`); E2E: `tsc 0`, lint 0 errors, `181 passed` files / `1442 passed` tests, desktop build green

## Phase 129: Desktop onboarding tour

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-onboarding-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-onboarding.md`)
- [x] 3-slide welcome modal (exact mobile copy) on shared Modal chrome; visibility hook with localStorage-backed shared helpers; dismiss persists (`1722c0e`)
- [x] Private-mode follow-up: broken storage treated as seen, never nags (`a875520`)

## Phase 131: Quick-wins bundle (sort persist, ARIA, parity)

- [x] Desktop sort persists in new `watchlistSortKey`/`watchlistSortAsc` keys (mobile enum untouched — no lossy mapping)
- [x] Summary uses full watchlist; tag counts honor price/in-stock filters
- [x] Group headers `<th scope="rowgroup">`; modal `aria-current`/`aria-live`/index-reset
- [x] `hasSeenOnboarding` catch → `true` on all platforms (+ test update)
- [x] E2E: `tsc 0`, `183 passed` files / `1446 passed` tests (`3204c07`)
- [x] Guards (`tests/desktop-onboarding.test.ts`); E2E: `tsc 0`, lint 0 errors, `182 passed` files / `1444 passed` tests, desktop build green

## Phase 130: Desktop watchlist group-by

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-group-by-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-group-by.md`)
- [x] Group picker (Off/Tag/Status/Region) via shared `groupWatchlist`, persisted to `watchlistGroup`; header rows with verified colSpan; off-mode identical (`7f0783e`)
- [x] Guards (`tests/desktop-group-by.test.ts`); E2E: `tsc 0`, lint 0 errors, `183 passed` files / `1446 passed` tests, desktop build green

## Phase 127: Desktop password reset

- [x] Spec (`docs/superpowers/specs/2026-09-06-desktop-password-reset-design.md`) + plan (`docs/superpowers/plans/2026-09-06-desktop-password-reset.md`)
- [x] Forgot-password form inline in signed-out Settings (same endpoint/copy as mobile) (`4daccd1`)
- [x] Public `/reset-password` route + page (identical validation, no auto-sign-in) (`1694c61`)
- [x] Guards (`tests/desktop-password-reset.test.ts`); E2E: `tsc 0`, lint 0 errors + 0 warnings, `180 passed` files / `1440 passed` tests, desktop build green

## Phase 166: Error paths + safety bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-error-paths-safety-design.md`) + plan (`docs/superpowers/plans/2026-09-10-error-paths-safety.md`)
- [x] Alerts notification failures → toast + Retry (`e5fd1b0`); bulk-tag load + Cmd+E export guard (`a0b7c3f`); deleteUserById cleanup logging (`5c55fb1`); delete confirms (`17ea6ac`); discovery errors + shared mapping (`e9f9ac6`, `0a8294c`); email verification badge/resend + Rules-of-Hooks fix (`4063a87`); test providers + nits (`4e94ca3`)
- [x] Guards (`desktop/tests/error-paths-safety.test.tsx`, `tests/delete-user-cleanup.test.ts`, `tests/desktop-shortcut-guard.test.ts`, `tests/llm-discovery.test.ts` extended); E2E: `tsc 0`, lint 0 errors, `215 passed` files / `1556 passed` tests, desktop build green

## Phase 167: Dedup bundle + logger layering

- [x] Spec (`docs/superpowers/specs/2026-09-10-dedup-bundle-design.md`) + plan (`docs/superpowers/plans/2026-09-10-dedup-bundle.md`)
- [x] `lib/log.ts` shared logger across 8 sites (`8e742b7`); desktop Stats (`e5bc817`); recent-searches core (`15dc305`); share.ts helpers (`3a42f86`); guard updates (`d1dfc51`, `9a007de`); moved to `shared/src/log.ts` (`fe90552`)
- [x] Guards (`tests/log.test.ts`, `tests/desktop-log-guard.test.ts`, `tests/desktop-recents-guard.test.ts`, `desktop/tests/share.test.tsx`); E2E: `tsc 0`, lint 0 errors, `215 passed` files / `1556 passed` tests, desktop build green

## Phase 168: Small UX alignment

- [x] Spec (`docs/superpowers/specs/2026-09-10-small-ux-alignment-design.md`) + plan (`docs/superpowers/plans/2026-09-10-small-ux-alignment.md`)
- [x] Active-only tab count (`cdb3b35`); persist deal sort + watchlistSortKey widening (`04269f1`); tags pointer → Watchlist (`8d0bba3`); notifications refresh (`28af7b5`)
- [x] Guards (`desktop/tests/ux-alignment.test.tsx`, `tests/desktop-tags-pointer-guard.test.ts`); E2E: `tsc 0`, lint 0 errors, `215 passed` files / `1556 passed` tests, desktop build green

## Phase 169: Hygiene bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-hygiene-bundle-design.md`) + plan (`docs/superpowers/plans/2026-09-10-hygiene-bundle.md`)
- [x] Shared SEARCH_OPTIONS, deferred index, price sorter, pendingTags, dead exports (`b7a362b`); idb warn+rethrow, poller rethrow + revert-to-manual (`cdc0e38`); dead wrapper + mark* removal, mocks to consume* (`b435e1a`)
- [x] Guards (`tests/catalog-search-guard.test.ts`, `tests/idb-adapter.test.ts`); E2E: `tsc 0`, lint 0 errors, root `219 passed` files / `1568 passed` tests, desktop `19 passed` files / `83 passed` tests

## Phase 170: Server-side health checks

- [x] Spec (`docs/superpowers/specs/2026-09-10-server-health-checks-design.md`) + plan (`docs/superpowers/plans/2026-09-10-server-health-checks.md`)
- [x] health.check endpoint + memory adapter (`7762a56`); desktop web fallback, Tauri-first (`fc43909`)
- [x] Guards (`tests/health-router.test.ts`, `tests/server-health.test.ts`, `desktop/tests/health-fallback.test.tsx`); E2E: `tsc 0`, lint 0 errors, root `219 passed` files / `1568 passed` tests, desktop `19 passed` files / `83 passed` tests

## Phase 171: OAuth web path

- [x] Spec (`docs/superpowers/specs/2026-09-10-oauth-web-path-design.md`) + plan (`docs/superpowers/plans/2026-09-10-oauth-web-path.md`)
- [x] Ticket redirect to web URLs (`7bb56a4`); callback route + web login (`ee931fb`); invalid-user rejection test (`16d1c82`)
- [x] Guards (`tests/oauth-handlers.test.ts` extended, `desktop/tests/oauth-callback.test.tsx`); security review: open-redirect analysis clean (ticket-only, no raw tokens from URL); E2E: `tsc 0`, lint 0 errors, root `219 passed` files / `1568 passed` tests, desktop `19 passed` files / `83 passed` tests

## Phase 172: Desktop polish bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-desktop-polish-design.md`) + plan (`docs/superpowers/plans/2026-09-10-desktop-polish.md`)
- [x] History modal + CSV (`67f0de8`); notif icons + relative time (`13bb9b4`); Home refresh (`f158ee7`); insight skeleton + stuck-state/dark-shade fix (`e74c1b3`, `7582f60`)
- [x] Guards (`desktop/tests/distributor-history-modal.test.tsx`, `desktop/tests/relative-time.test.ts`, `desktop/tests/notifications-polish.test.tsx`, `desktop/tests/home-refresh.test.tsx`, `desktop/tests/insight-skeleton.test.tsx`); E2E: `tsc 0`, lint 0 errors, root `219 passed` files / `1568 passed` tests, desktop `19 passed` files / `83 passed` tests

## Phase 173: Polish follow-ups

- [x] Spec (`docs/superpowers/specs/2026-09-10-polish-followups-design.md`) + plan (`docs/superpowers/plans/2026-09-10-polish-followups.md`)
- [x] Shared PriceHistoryChart (`9103369`); shared relative-time + edge guards (`8640e11`); Tauri insight timeout + audible catches (`7d331bc`); converted row prices, null-safe (`14df2c5`)
- [x] Guards (`desktop/tests/price-history-chart.test.tsx`, `tests/desktop-chart-guard.test.ts`, `tests/relative-time.test.ts`, `desktop/tests/converted-row-prices.test.tsx`, `desktop/tests/insight-skeleton.test.tsx` extended); E2E: `tsc 0`, root `221 passed` files / `1571 passed` tests, desktop `21 passed` files / `88 passed` tests

## Phase 174: Small leftovers

- [x] Spec (`docs/superpowers/specs/2026-09-10-small-leftovers-design.md`) + plan (`docs/superpowers/plans/2026-09-10-small-leftovers.md`)
- [x] Behavioral modal-wiring coverage (`83372ba`); Home connection badge (`906ac94`); responsive compare chart (`7fee7e6`); pages.test provider fix for the badge regression — caught by the suite (`93714fe`)
- [x] Guard (`desktop/tests/compare-chart-width.test.tsx` + extended home-refresh + distributor-history-modal suites); E2E: `tsc 0`, root `221 passed` files / `1571 passed` tests, desktop `22 passed` files / `93 passed` tests

## Phase 175: Correctness bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-correctness-bundle-design.md`) + plan (`docs/superpowers/plans/2026-09-10-correctness-bundle.md`)
- [x] History chart drops unconvertible points (`3f1a8ab`); direct storage calls in Alerts loader (`1153ae8`); shared `withTimeout` for insight fetch (`c0a3dd3`); stateless server health contract pin (`5a34a45`); connection status explanation in Settings (`467f6c3`)
- [x] Guards (`desktop/tests/price-history-chart.test.tsx` extended, `tests/with-timeout.test.ts`, `desktop/tests/settings-connection.test.tsx`); E2E: `tsc 0`, root `224 passed` files / `1576 passed` tests, desktop `27 passed` files / `128 passed` tests

## Phase 176: Desktop web push

- [x] Spec (`docs/superpowers/specs/2026-09-10-desktop-web-push-design.md`) + plan (`docs/superpowers/plans/2026-09-10-desktop-web-push.md`)
- [x] Push service worker (`7cf1d2f`); desktop push subscription module (`c55374b`); push notification opt-in on desktop Settings (`40e753e`)
- [x] Guards (`tests/desktop-sw-guard.test.ts`, `desktop/tests/web-push.test.ts`, `desktop/tests/settings-push.test.tsx`); signed-in only; headless E2E not possible (no push service) — real-browser HTTPS QA needed with VITE_VAPID_PUBLIC_KEY; E2E: `tsc 0`, root `224 passed` files / `1576 passed` tests, desktop `27 passed` files / `128 passed` tests

## Phase 177: Desktop health probing

- [x] Spec (`docs/superpowers/specs/2026-09-10-desktop-health-probing-design.md`) + plan (`docs/superpowers/plans/2026-09-10-desktop-health-probing.md`)
- [x] Scheduled desktop health probing (`c73081e`); pending health event upload (`b767057`) + retain queue on upload timeout (`6b5554e`); id-cast type error fix in health upload (`a135eeb`); probe scheduling (`762dca9`) + signed-out gating fix (`1a73eae`)
- [x] Guards (`desktop/tests/health-probe.test.tsx`, `desktop/tests/health-probe-upload.test.tsx`, `tests/desktop-health-probe-guard.test.ts`); two review-caught bugs (timeout-clear data loss, dead signed-out hoist); E2E: `tsc 0`, root `224 passed` files / `1576 passed` tests, desktop `27 passed` files / `128 passed` tests

## Phase 178: Sync correctness

- [x] Spec (`docs/superpowers/specs/2026-09-10-sync-correctness-design.md`) + plan (`docs/superpowers/plans/2026-09-10-sync-correctness.md`)
- [x] Hygienic shared withTimeout + adoption + rename (`a6d9c2e`); batched health emission (`8967750`); sync guard + master-switch retract (`8b42be8`)
- [x] Guards (`tests/with-timeout.test.ts` extended, `desktop/tests/health-probe-upload.test.tsx` extended); E2E: `tsc 0`, root `226 passed` files / `1586 passed` tests, desktop `30 passed` files / `152 passed` tests

## Phase 179: First-launch bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-first-launch-design.md`) + plan (`docs/superpowers/plans/2026-09-10-first-launch.md`)
- [x] Seeding/poller/FX via launch.ts (`2058fbc`); shared preview ordering (`686bd2d`); activity dedup + CTA + exclusion pin (`94bf978`, `51d8d90`)
- [x] Guards (`desktop/tests/app-launch.test.ts`, `tests/search-preview.test.ts`, `desktop/tests/home-activity.test.tsx`); E2E: `tsc 0`, root `226 passed` files / `1586 passed` tests, desktop `30 passed` files / `152 passed` tests

## Phase 180: Tray click deep-links

- [x] Spec (`docs/superpowers/specs/2026-09-10-tray-clicks-design.md`) + plan (`docs/superpowers/plans/2026-09-10-tray-clicks.md`)
- [x] Rust route + Linux activation (`79817c3`); listener + table (`76ecef1`); call-site routes (`b0aedf7`)
- [x] Guards (`desktop/tests/notification-routing.test.tsx` + cargo tests); Linux full deep-link, macOS/Windows focus fallback; OS-click needs real-session QA; E2E: `tsc 0`, root `226 passed` files / `1586 passed` tests, desktop `30 passed` files / `152 passed` tests

## Phase 181: Token unregister

- [x] Spec (`docs/superpowers/specs/2026-09-10-token-unregister-design.md`) + plan (`docs/superpowers/plans/2026-09-10-token-unregister.md`)
- [x] Endpoint + cross-user rejection test (`2050ce4`, `0a5b1c8`); disable + logout calls (`b7825c4`)
- [x] Guards (`tests/push-unregister.test.ts`); E2E: `tsc 0`, root `226 passed` files / `1586 passed` tests, desktop `30 passed` files / `152 passed` tests

## Phase 182: Consistency bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-consistency-design.md`) + plan (`docs/superpowers/plans/2026-09-10-consistency.md`)
- [x] Movers lists + stats refresh (`14afb5e`); flagged names + 3M default (`c9e4cb5`); stat links + null-safe activity (`c63a3be`)
- [x] Guards (`desktop/tests/stats-polish.test.tsx`, `desktop/tests/home-activity.test.tsx` extended); test-stock button dropped after verification that `<ActionButtons` is never rendered (dead-code mirror avoided); Compare default needed lowercase `3m` chip key (plan snippet would have broken highlighting); E2E: `tsc 0`, root `227 passed` files / `1589 passed` tests, desktop `32 passed` files / `168 passed` tests

## Phase 183: Correctness leftovers

- [x] Spec (`docs/superpowers/specs/2026-09-10-correctness-leftovers-design.md`) + plan (`docs/superpowers/plans/2026-09-10-correctness-leftovers.md`)
- [x] Shared seeding (`4d09926`); preview tail contract pin (`6fc2e09`); unregister retry + cycle-break fix (`f496739`, `e7b0ab3`); platform-limit comments (`968d780`); Cargo.lock sync (`ca247e0`)
- [x] Guards (`tests/launch-seed.test.ts`); preview sorter needed no code change (stable sort verified); macOS/Windows tray clicks + thread rationale documented as analyzed-and-deferred; E2E: `tsc 0`, root `227 passed` files / `1589 passed` tests, desktop `32 passed` files / `168 passed` tests

## Phase 184: Correctness bundle 2

- [x] Spec (`docs/superpowers/specs/2026-09-10-correctness-2-design.md`) + plan (`docs/superpowers/plans/2026-09-10-correctness-2.md`)
- [x] Authenticated logout unregister (`9e6c4e1`); unregister logging (`ccbea5d`); shared routing + typable return fix (`e8333f1`, `ff8aeda`); reject-timer hygiene (`53a8d64`)
- [x] Guards (`desktop/tests/use-auth.test.tsx` extended, `tests/notification-routing.test.ts`, `tests/manual-add-timeout-guard.test.ts`); E2E: `tsc 0`, root `229 passed` files / `1591 passed` tests, desktop `37 passed` files / `187 passed` tests

## Phase 185: Product polish bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-product-polish-design.md`) + plan (`docs/superpowers/plans/2026-09-10-product-polish.md`)
- [x] Best-price signals (`ec94ea4`); AI manual-add (`fd80125`); web toggle + single-writer fix + optimistic-sync fix (`1d9835b`, `33413ba`, `708a709`); tab sync, stats CTA, converter (`5155b8e`)
- [x] Guards (`desktop/tests/best-price-signals.test.tsx`, `desktop/tests/manual-add-ai.test.tsx`, `desktop/tests/settings-webtoggle.test.tsx`, `desktop/tests/nav-header.test.tsx`, `desktop/tests/use-settings-update.test.tsx`); review-caught double-write + async regression fixed; −5% label/behavior self-consistent (mobile mismatch flagged separately); web fallback route-less by design; E2E: `tsc 0`, root `229 passed` files / `1591 passed` tests, desktop `37 passed` files / `187 passed` tests

## Phase 186: Correctness bundle 3

- [x] Spec (`docs/superpowers/specs/2026-09-10-correctness-3-design.md`) + plan (`docs/superpowers/plans/2026-09-10-correctness-3.md`)
- [x] UI-first logout (`22c8c18`); audible failures (`85b28ab`); alert helper + ids (`a9c1a2e`); memoized derivations (`05b0e18`); error boundary (`e5bde9e`)
- [x] Guards (`desktop/tests/error-boundary.test.tsx`, `desktop/tests/send-notification.test.tsx`, `desktop/tests/use-auth.test.tsx` + `desktop/tests/manual-add-ai.test.tsx` extended suites); E2E: `tsc 0`, root `229 passed` files / `1591 passed` tests, desktop `40 passed` files / `204 passed` tests

## Phase 187: Discovery + compare

- [x] Spec (`docs/superpowers/specs/2026-09-10-discovery-compare-design.md`) + plan (`docs/superpowers/plans/2026-09-10-discovery-compare.md`)
- [x] URL/description/dup-guard (`547c999`); slug ids both surfaces (`22c590f`, `d80747b`); region card (`1d80357`); modal discovery parity (`be37c9a`)
- [x] Guards (`desktop/tests/manual-add-ai.test.tsx` extended, `desktop/tests/compare-region.test.tsx`); E2E: `tsc 0`, root `229 passed` files / `1591 passed` tests, desktop `40 passed` files / `204 passed` tests

## Phase 188: Discovery hardening

- [x] Spec (`docs/superpowers/specs/2026-09-10-discovery-hardening-design.md`) + plan (`docs/superpowers/plans/2026-09-10-discovery-hardening.md`)
- [x] Shared reject-timeout + guard retarget (`bb0b0ed`); manualAddProduct + rediscoverProduct (`fa0aab4`); 3-flow adoption + desktop retry boxes (`cb90917`)
- [x] Guards (`tests/manual-add.test.ts`, `desktop/tests/manual-add-ai.test.tsx` extended); E2E: `tsc 0`, root `231 passed` files / `1604 passed` tests, desktop `42 passed` files / `217 passed` tests

## Phase 189: Small correctness leftovers

- [x] Spec (`docs/superpowers/specs/2026-09-10-small-correctness-design.md`) + plan (`docs/superpowers/plans/2026-09-10-small-correctness.md`)
- [x] Shared search chrome (`a63f0ba`); ids + currency-correct trend (`3388d02`); native region prices (`1907dc8`); guard retarget fix (`211a49f`)
- [x] Guards (`tests/desktop-search-chrome-guard.test.ts`, `tests/desktop-recents-guard.test.ts` retargeted, `desktop/tests/creation-ids.test.tsx`, `desktop/tests/compare-region.test.tsx` extended); E2E: `tsc 0`, root `231 passed` files / `1604 passed` tests, desktop `42 passed` files / `217 passed` tests

## Phase 190: Product gaps bundle

- [x] Spec (`docs/superpowers/specs/2026-09-10-product-gaps-design.md`) + plan (`docs/superpowers/plans/2026-09-10-product-gaps.md`)
- [x] Past-due + calendar (`8bf8625`); summary + sparklines (`ce237af`); markup + assertion nits (`877341a`)
- [x] Guards (`desktop/tests/reminders-calendar.test.tsx`); E2E: `tsc 0`, root `231 passed` files / `1604 passed` tests, desktop `42 passed` files / `217 passed` tests

## Phase 191: Bulk CSV import + watchlist sparklines

- [x] Bulk import `model,targetPrice,currency,tags` (500-row cap, BOM/quoted handling, chunked 50) — `lib/csv.ts:parseBulkImportCsv`, mobile import button (`components/watchlist/watchlist-header.tsx`, `app/(tabs)/watchlist.tsx`), desktop parity (`desktop/src/pages/Watchlist.tsx`) (`4564e20`, `ae93efa`)
- [x] Inline `PriceSparkline` (64x24, last 10 points) on watchlist cards + desktop SVG parity in price cell (`cf742a0`, `eb3bca1`); package bumped to 5.15.0 (`9762dc7`)
- [x] Guards (`tests/bulk-csv.test.ts`); E2E: `tsc 0` (`pnpm check`, `pnpm lint`)

## Phase 192: Distributor export + digest quiet-hours

- [x] Distributor analysis Export CSV (detailed) via Share (`app/distributor-analysis.tsx`) (`66c469a`); E2E: `tsc 0`, `1654 passed` tests
- [x] Price digest respects quiet hours — `maybeSendDigest` defers via `isInQuietHours`, groups with next price-check tick (`lib/price-digest.ts`) (`281c150`); E2E: `tsc 0`, `1656 passed` tests
- [x] Guards (`tests/digest-quiet-hours.test.ts`)

## Phase 193: Watchlist share link

- [x] Watchlist header Share prefers server `/w/` link when signed in (`sharedWatchlists.create`), falls back to local text summary when signed out/offline — mobile (`app/(tabs)/watchlist.tsx`) + desktop (`desktop/src/pages/Watchlist.tsx`) parity (`1053a95`)
- [x] `buildWatchlistShareMessage` helper (`lib/watchlist-share.ts`); detailed CSV carries `# Share: <url>` provenance header, parser round-trips it (`lib/csv.ts`, viewer exports on both surfaces)
- [x] Guards (`tests/watchlist-share-message.test.ts`, `tests/csv-share-header.test.ts`); E2E: `tsc 0`, lint clean, `1661 passed` tests

## Phase 194: Rates window toggle

- [x] 1W/1M/All toggle on Rates (compare-chart pill idiom) — windowed sparkline history + first-to-last windowed % change (`eed2a44`)
- [x] `sliceFxHistoryByRange` + `getFxWindowChange` (`lib/fx-history.ts`); existing `getFxChange` untouched; mobile (`app/(tabs)/rates.tsx`) + desktop (`desktop/src/pages/Rates.tsx`) parity, defaults to All (prior behavior)
- [x] Guards (`tests/fx-window.test.ts` — RED watched failing first); E2E: `tsc 0`, lint clean, `1666 passed` tests

## Phase 195: Share-link expiry management

- [x] `sharedWatchlists.list` (owner's links, newest-first, with `shareUrl`) + `sharedWatchlists.extend` (owner-only, +30d, `NOT_FOUND` otherwise) (`server/routers.ts`) (`a494438`)
- [x] Owner link list with Copy / Extend 30d / Revoke in Settings — mobile (`app/(tabs)/settings.tsx`) + desktop (`desktop/src/pages/Settings.tsx`) parity
- [x] Guards (`tests/shared-watchlist-expiry.test.ts` — RED watched failing first); E2E: `tsc 0`, lint clean, `1671 passed` tests

## Phase 196: Server quiet-hours digest batching

- [x] `quietHours` prefs plumbing: `NotificationConfig` + `uploadConfig` schema + `device_notification_configs.quietHours` JSON column (migration `0023_quiet_hours`) + client upload from settings (`lib/server-notifications.ts`)
- [x] Warmer hold-and-flush (`server/notifications/digest.ts`, all 4 evaluate paths): holds drafts in quiet window (all bound configs must opt in), flushes one day-scoped `digest` event at window end, then resumes individual delivery
- [x] Client renders `digest` history entries (`lib/types.ts`, `TYPE_ICONS` + `chart.bar.fill`)
- [x] Guards (`tests/server-digest.test.ts` — RED watched failing first); E2E: `tsc 0`, lint clean, `1682 passed` tests

## Phase 197: v5.16 hygiene — version lockstep + AGENTS fixes

- [x] Version lockstep `5.16.0`: root `package.json` renamed `app-template` → `product-stock-finder` + bumped, `app.config.ts` + `desktop/package.json` aligned (`5.12.0` → `5.16.0`) (`cd9fedb`)
- [x] `AGENTS.md` drift fixes: `lib/storage/` dir layout, `desktop/` + `server/notifications/` + `server/routers/` sections, drizzle 15 → 20 tables, tests 80+ → ~255 files / ~1682 tests, `product/[id].tsx` ~410 lines, 25 registered parsers, todo ref 196 phases
- [x] `0023_quiet_hours` wiring verified (SQL + journal + `drizzle/schema.ts` + client upload + digest hold-and-flush); full 0000→0023 chain applied cleanly on scratch MySQL 8.0 (`quietHours` JSON NULL present, 20 tables) — container torn down; prod `pnpm db:push` still needs prod `DATABASE_URL` (local `.env` points at localhost, no server running)
- [x] CI note: main runs fail at job start with 0 steps — account billing/spending-limit failure (annotation on run `34754705704`), not code; local E2E: `tsc 0`, lint clean, `1682 passed` tests

## Phase 198: Desktop check green

- [x] `server/sync-db.ts`: dropped unused `TRPCError` import (TS6133 under desktop tsconfig which covers `../server`)
- [x] `desktop/src/pages/Alerts.tsx`: added missing `digest: BarChart3` to `TYPE_ICONS` (parity with mobile `chart.bar.fill` from Phase 196; lucide 0.400.0 has no `ChartColumn`)
- [x] E2E: root `tsc 0`, desktop `tsc 0`, lint clean, root `1682 passed` tests
- [x] Desktop red was pre-existing: `desktop/tests/settings-webtoggle.test.tsx` flagged as known failure but was 10 failures across 3 files (`settings-webtoggle`, `settings-push`, `error-paths-safety`); `pnpm check:desktop` had not been run in CI locally

## Phase 199: Desktop Settings trpc harness

- [x] Root cause `a494438` added `SharedLinksList` (`trpc.sharedWatchlists.list.useQuery`) to `desktop/src/pages/Settings.tsx` without a test-provider mock — every desktop test that renders `Settings` throws `Unable to find tRPC Context` and renders empty `<div/>`, so `findByRole("checkbox", "Enable web notifications")` times out; local `pnpm test` showed 10 failures across `settings-webtoggle` (2), `settings-push` (7), `error-paths-safety` discovery+Settings (2) — the initial 2 were not isolated
- [x] Fix: stub `../src/lib/trpc` (`trpc.sharedWatchlists.list/extend/revoke` + `createTRPCClient`) in all 3 `desktop/tests/*.test.tsx` that render `Settings` (same shape as the `sharedWatchlists` client mocks in `src/pages/Settings.tsx:61-63,602-633`); no `Settings.tsx` change needed — `trpc` must be mocked when `SharedLinksList` is mounted without a provider
- [x] E2E: root `tsc 0`, desktop `tsc 0`, lint clean, root `257 passed | 1 skipped` files / `1682 passed` tests, desktop `42 passed` files / `217 passed` tests

## Phase 200: Railway MySQL provision + 0023 migrate

- [x] New Railway project `product-stock-finder` + MySQL-NtCC + app provisioned; `railway init` + `railway add --database mysql` + `railway add --service app`; linked `DATABASE_URL=${{MySQL-NtCC.MYSQL_URL}}` on app
- [x] `0023_quiet_hours` applied via `railway ssh --service app` (internal `mysql-ntcc.railway.internal:3306`); verified `SHOW TABLES` 21, `__drizzle_migrations` id 23 hash `3ec4ce26...`, `SHOW COLUMNS device_notification_configs LIKE "quietHours"` JSON NULL; re-run `npx drizzle-kit migrate` exits 0
- [x] Scratch local MySQL 8.0 also verified 0000→0023 clean; Railway internal host not reachable locally — requires TCP proxy (Networking → Public Networking) for local `DATABASE_URL` pushes; app `JWT_SECRET` set dummy on Railway, needs real secret before prod

## Phase 201: Railway prod env + TCP proxy + drizzle snapshot repair

- [x] Prod env on `app`: rotated `JWT_SECRET` (32-byte hex), `VAPID_SUBJECT`/`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` + `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_URL` (the Railway app URL); redeployed; `GET /api/health` 200 `{ok:true}`
- [x] MySQL TCP proxy created via GraphQL (`tcpProxyCreate`, app port 3306); stray HTTP domain deleted; local `.env` `DATABASE_URL` now points at the proxy
- [x] Root cause: `0023_quiet_hours` was hand-written in `b09ae3e` without committing `drizzle/meta/0023_snapshot.json`, so `drizzle-kit generate` diffed from `0022` and emitted a duplicate `0024_swift_kate_bishop.sql` (`ADD quietHours` → `ER_DUP_FIELDNAME` on `pnpm db:push`)
- [x] Fix: promoted generated snapshot to `drizzle/meta/0023_snapshot.json` (verified its only diff from `0022` is the `quietHours` json column and `prevId` chains to `0022`), removed `0024` SQL + journal entry; `drizzle-kit generate` now reports "No schema changes"; `pnpm db:push` → "No schema changes, nothing to migrate" + migrations applied
- [x] E2E: root `tsc 0`, desktop `tsc 0`, lint clean, `257 passed | 1 skipped` files / `1682 passed` tests

## Phase 202: Device-QA prep fixes (Tauri version lockstep + SW precache)

- [x] Static review of tray/deep-link + web-push seams (recorded in `docs/HANDOVER.md` §8): tray left-click restore, Linux-only notification deep-link by design, web-push click lands on `/`, SW focused-client skip + dedup coherent; only OS/browser integration points left for device QA
- [x] Tauri version drift: `desktop/src-tauri/tauri.conf.json` + `Cargo.toml` + `Cargo.lock` were stuck at `5.12.0` while root + `desktop/package.json` are `5.16.0`; bumped all three to `5.16.0`, validated with `cargo metadata --offline`
- [x] Stale SW precache: `public/sw.js` listed dead hashed `/_expo/static/*` bundles + missing `/icon.png`, so `cache.addAll` always rejected and offline cold start never precached; precache now stable URLs only (`/index.html`, `/manifest.json`, `/favicon.ico`, hashed bundles stay on the runtime cache-first handler), cache bumped to `precache-v3`
- [x] Regression tests: `tests/tauri-version-lockstep.test.ts` (root/desktop/tauri.conf/Cargo.toml version parity), `tests/sw-precache.test.ts` (no `_expo`/hash entries, every URL resolves to a real file)
- [x] E2E: root `tsc 0`, lint clean, `259 passed | 1 skipped` files / `1685 passed` tests

## Phase 203: Stabilize desktop __DEV__ flake (release prep)

- [x] Symptom: desktop suite failed ~1/8 runs with `Failed Suites 4-5, Tests 0-1 failed` — suite-level collection errors, never assertion failures
- [x] Root cause: `ReferenceError: __DEV__ is not defined` at `lib/_core/auth.ts:6` (via `lib/device-revoked.ts`). Root vitest defines `__DEV__` in `tests/setup.ts`, but `desktop/tests/setup.ts` never did; desktop relied on vite `define: { __DEV__: "import.meta.env.DEV" }`, which does not reliably reach `../lib/*` modules under vitest (worker-dependent transform path)
- [x] Fix: `(globalThis).__DEV__ = true` in `desktop/tests/setup.ts` (mirrors root) + `desktop/tests/setup-globals.test.ts` live guard; verified 10/10 green runs (43 files / 218 tests)
- [x] E2E: desktop `tsc 0`, lint clean

## Phase 204: EAS scaffolding + web-via-Express (release prep)

- [x] EAS: added `eas.json` (dev/preview/production profiles, appVersionSource remote) — `EXPO_PUBLIC_EXPO_PROJECT_ID` already wired via `app.config.ts:extra`; `npx eas project:init` still manual (needs linked Expo account + credentials), so no projectId committed; mobile builds remain `npx eas build --platform android|ios` after linking
- [x] Web via Express: `server/spa.ts` (`resolveWebDist`, `hasWebDist`, `cacheControlFor`, `registerSpa`) mounts same-origin SPA after `/api/*` (static + GET fallback to `index.html`), `no-store` for shell/SW, immutable for hashed `/_expo/static/*`; `pnpm build` now chains `esbuild → dist/` + `expo export → dist-web/`, `dist-web/` git-ignored
- [x] Docs: `AGENTS.md` Web Build + `server/README.md` updated; `.gitignore` adds `dist-web/`
- [x] Regression tests: `tests/spa.test.ts` (cache headers, WEB_DIST default, API-only fallback, live HTTP: shell at `/` + deep links, SW/bundle cache headers, API + non-GET passthrough)
- [x] E2E: `tsc 0`, `check:desktop 0`, lint clean, `desktop build` (`1.6MB chunk` OK), `4 + 14` new focused tests; full suite to run before checkpoint commit

## Phase 205: Desktop identifier alignment + release smoke

- [x] Desktop `identifier` drift: `tauri.conf.json` was `com.app.stockfinder`, app bundle is `com.app.stock_tracker_pro` (`app.config.ts` / `AGENTS.md`). Aligned to `com.app.stock_tracker_pro` pre-first-release (no shipped installs to migrate); `cargo check` green
- [x] Desktop smoke: `pnpm --dir desktop build` green (`454k gzip`), `cargo check` green, `tsc` 0; Tauri bundle (`pnpm tauri build`) still manual — needs system webkit + signing, run on release machine

## Phase 206: Production audit fixes (security + ops)

- [x] IP spoofing: `server/rate-limit.ts` + `server/_core/oauth.ts` keyed on the spoofable leftmost `X-Forwarded-For` entry; now use Express-resolved `req.ip` (trusted-hop only). Tests updated (`rate-limit.test.ts` spoof case)
- [x] Paid-endpoint spend guard: `server/spend-budget.ts` caps per-process hourly LLM/image calls (`products.parse` 300, `insights.get` 300, `images.get` 200; `SPEND_BUDGET_*` overrides); wired into `product-parse.ts`, `price-insights.ts`, `product-images.ts` on the billable path only (cache hits/single-flight unaffected); degrades to null/stale, never errors
- [x] Email delivery: `server/email.ts` (Resend HTTP, no new dep) + `RESEND_API_KEY`/`EMAIL_FROM`; password-reset and resend-verification now send real links (`EXPO_PUBLIC_WEB_URL`); new `app/verify-email.tsx` landing route; unconfigured → skip + log
- [x] SPA fallback: unmatched `/api/*` and `/storage/*` GETs now 404 JSON instead of returning the HTML shell with 200 (`server/spa.ts`)
- [x] Notification retention: `purgeOldNotificationEvents` (30d, batched, deliveries cascade) called from the warmer tick
- [x] Session: `verifySession` no longer rejects an empty `name` (null-name OAuth accounts were locked out permanently)
- [x] Prod startup: `server/_core/index.ts` binds `PORT` directly in production (no port scan) + `server.on("error")` exits 1
- [x] Tests: `spend-budget.test.ts`, `email.test.ts`, `spa.test.ts` (+404 case), `rate-limit.test.ts`, `session-binding.test.ts`; E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `262 passed | 1 skipped` / `1702 passed`, desktop `43 passed` / `218 passed`

## Phase 207: Fix clean-install web export (Railway build blocker)

- [x] Prod outage: setting env vars triggered a redeploy; the `app` service source was a bare `node:20-alpine` image (`repo: null`), so deploys skipped the build (0 build logs, `duration: 0`) and crashed → 502. Rolled back to the last good image (prod restored), then reconnected the service to `pnoch/product-stock-finder@main` via `serviceConnect`
- [x] Reconnected build then failed at `expo export`: `Failed to get the SHA-1 for .../react-native-css-interop/.cache/web.css`. Root cause: NativeWind `forceWriteFileSystem` writes `web.css` during transform, but Metro only hashes files from its initial crawl; on a clean install (no stale cache) the file is unknown → web export fails. Only surfaced now because Phase 204 added `expo export` to the Railway build
- [x] Fix: `metro.config.js` pre-creates `.cache/web.css` (mirrors the interop package's native stubs) and adds the cache dir to `watchFolders`; verified `rm -rf .cache dist-web && pnpm build:web` succeeds from clean
- [x] E2E: `tsc 0`, lint clean

## Phase 208: Remaining audit fixes (dedup grace, error leakage, warmer cost)

- [x] Dedup blocked forever: user events stayed blocked until every bound device pulled; an abandoned device binding suppressed the condition permanently. Added `isEventBlocking` with a 7-day `DELIVERY_GRACE_MS` (cooldown still 24h) in `server/notifications/evaluate.ts` (all 4 evaluators)
- [x] Error leakage: register/login/oauth-consume/forgot/reset/verify/delete-account returned raw `error.message`/`String(e)` (DB driver errors, stack text). Added `safeAuthErrorMessage` — only deliberate `HttpError` messages pass, everything else is logged and replaced with a generic message
- [x] Warmer cost: `buildEvents` read the same (distributor, model) row once per device per tick. Added `createPriceLookup()` memoization (one per tick, misses cached too) threaded through all evaluators
- [x] Tests: `notification-dedup-grace.test.ts`, `auth-error-leak.test.ts`, `price-lookup.test.ts`, updated `oauth-handlers.test.ts` to the real `HttpError` contract; E2E root `tsc 0`, desktop `tsc 0`, lint clean, `265 passed | 1 skipped` / `1713 passed`

## Phase 209: Same-class bug sweep (tRPC leak, token growth, scrape fan-out)

- [x] tRPC error leakage (same class as Phase 208's HTTP routes): tRPC's default error shape forwards the thrown message verbatim and the UI renders `error.message`, so an unexpected DB/driver error reached users. Added `redactErrorShape` via `errorFormatter` in `server/_core/trpc.ts` — deliberate `TRPCError`s (no `cause`) pass through (incl. the client-matched `10001/10002/10003` codes), anything with a `cause` becomes a generic message
- [x] Unbounded token tables: `password_reset_tokens` + `email_verification_tokens` were never purged. Added `purgeExpiredAuthTokens` (expired-or-used, batched, memory fallback too) called from the warmer tick
- [x] Scrape fan-out: public `prices.get` triggers a real outbound scrape on a cache miss; rotating IPs could fan out unbounded. Added a global `MAX_CONCURRENT_SCRAPES = 6` semaphore around `refreshSingleFlight` (queues, doesn't drop; single-flight dedup preserved)
- [x] Tests: `trpc-error-redaction.test.ts`, `auth-token-purge.test.ts`, `scrape-concurrency.test.ts` (verified the concurrency test fails at cap=100 → not vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint clean, `268 passed | 1 skipped` / `1719 passed`

## Phase 210: Share-link rate limit + orphan-row purge

- [x] `sharedWatchlists.get` is public (share-link design) but had no rate limit; a leaked token could be scraped at unbounded rate from rotating IPs. Added per-IP (`60/min`) + new `checkRateLimitByKey` per-token (`120/min`) budgets in `server/rate-limit.ts`
- [x] `price_insights` / `product_images` rows are keyed by productId and bounded by the catalog, but a product removed from the catalog left its row forever. Added `purgeOrphanedInsights` / `purgeOrphanedImages` (delete rows outside the catalog; no-op on empty catalog; memory fallback too) called from the warmer tick
- [x] Tests: `rate-limit-by-key.test.ts`, `orphan-purge.test.ts`; E2E root `tsc 0`, desktop `tsc 0`, lint clean, `270 passed | 1 skipped` / `1723 passed`

## Phase 211: Second same-class sweep (unbudgeted LLMs, missing limits, unbounded arrays)

- [x] Unbudgeted paid LLM calls (same class as Phase 206): `discovery.discover` (`invokeLLM`) and `trending.refresh` (raw OpenAI fetch) had no process-wide spend cap. Added `discovery.discover` (200/h) + `trending.refresh` (20/h) budgets in `server/spend-budget.ts`; discovery throws TOO_MANY_REQUESTS, trending returns `{count:0}`
- [x] Missing rate limits: `auth.deleteAccount`, `prices.uploadHistory`, `sharedWatchlists.members`, `sharedWatchlists.leave` had none
- [x] Missing fetch timeouts: `trending` RSS feeds + OpenAI call + `getTrending` self-fetch could hang a request forever; added `fetchWithTimeout` (8s) + 20s LLM abort
- [x] Unbounded JSON-column writes: `notifications.uploadConfig` accepted unbounded `alerts`/`stockWatches`/`dateReminders`/`healthEvents` arrays persisted verbatim (and iterated by the warmer every tick); capped at 200/200/200/100 with per-field length bounds
- [x] Tests: `discovery-spend-budget.test.ts`, `trending-spend-budget.test.ts`, `upload-config-bounds.test.ts`; E2E root `tsc 0`, desktop `tsc 0`, lint clean, `273 passed | 1 skipped` / `1728 passed`

## Phase 212: Cap public shared-watchlist payload

- [x] `sharedWatchlists.get` (public) read the owner's entire watchlist with no limit. Capped at `SHARED_WATCHLIST_MAX_ITEMS = 500` and added a `truncated` flag to the response; clients ignore the extra field (backward compatible)
- [x] Test: `shared-watchlists.test.ts` cap + truncation case; E2E root `tsc 0`, desktop `tsc 0`, lint clean, `273 passed | 1 skipped` / `1729 passed`

## Phase 213: Client/server cap drift (uploadConfig + sync.push)

- [x] Regression from Phase 211: the server caps `notifications.uploadConfig` arrays (200/200/200/100) but the client sent every active alert/watch/reminder and every buffered health event, so any user over a cap had their whole config rejected (silently disabling server-side notifications). Caps moved to `shared/const.ts` (`MAX_UPLOAD_*`) and the client now trims to them before upload
- [x] Same class: `sync.push` caps at 200 items server-side, but `syncNow` pushed the entire dirty set in one call — a user with >200 dirty items could never sync. `syncNow` now batches to `SYNC_PUSH_MAX_ITEMS` and merges verdicts (a failed batch aborts the rest, local changes stay dirty)
- [x] Client pending-health-event buffer was unbounded and persisted to AsyncStorage; capped at `MAX_UPLOAD_HEALTH_EVENTS` (keeps newest) so it can't grow forever and then fail to upload
- [x] Tests: `pending-health-buffer.test.ts`, `upload-config-client-trim.test.ts`, `sync-push-batching.test.ts` (both trim + batching verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint clean, `276 passed | 1 skipped` / `1734 passed`

## Phase 214: Document client/server payload-cap convention

- [x] Added an AGENTS.md convention: any server-side `.max()`/limit on a client-sent payload must live in `shared/const.ts` and the client must trim/batch to it (the Phase 211/213 failure mode); refreshed the test-count references (~277 files / ~1734 tests)

## Phase 215: Whole-app bug + edge-case review (4 parallel audits)

**Storage / web adapter**
- [x] Web data loss on upgrade: the IndexedDB adapter returned `null` on an IDB *miss* without consulting localStorage, so every pre-IDB web user lost watchlist/alerts/settings on first launch after the switch (and could push the empty state to the server). `getItem` now adopts a legacy localStorage value on an IDB miss and migrates it into IDB
- [x] Split-brain store: `setItem` fell back to localStorage on any IDB error, but reads only checked IDB on a miss → writes became invisible. Writes now keep the two stores consistent and reads fall back on error
- [x] Tag definitions never marked settings dirty, so create/rename/recolor/delete never synced (products referenced orphaned tag ids elsewhere). `updateTagDefinitions` now notifies the settings collection
- [x] `clearAllData` omitted `distributor_health` / `distributor_health_history`
- [x] Discovery arrays were unbounded; capped at 200 (newest kept)

**Sync engine**
- [x] Full resync after >30d offline deleted untouched *live* items: the server returned an incremental pull (omitting unchanged rows) while the client dropped anything absent. Server now returns the complete state (`since = null`) when the cursor predates the tombstone window
- [x] Rejected push items were never retried: the cursor advanced past their stamp, so `entry.updatedAt > oldCursor` never re-collected them. Added `SyncMeta.retryKeys`, re-collected on the next sync and deferred within the same pass
- [x] A future-dated stamp wedged sync permanently (server rejected the whole batch, client re-sent the same stamp). Server now clamps to `now` instead of rejecting

**Scrapers / pricing**
- [x] Winncom parsed the model number as the price (`804` for `CRS804-4DDQ-hRM`): the selector included `.product-link` and the bare `.nobr` class (which on Winncom is the model-code cell). Now uses price-only selectors
- [x] `parsePriceFromText` read dot-thousands as decimals (`1.299` → `1.299`, not `1299`) — wrong for European EUR distributors. Dot-only groups of three are now thousands; also rejects non-finite digit runs
- [x] `inferStockStatus` classified "not in stock" as `in_stock` (substring of "in stock")
- [x] `getBestPrice` diverged between `lib/currency.ts` (orderable only) and `shared/src/currency.ts` (included `unknown`), so desktop could surface unknown-availability listings; shared now matches lib
- [x] `modelMismatch` walked up into page-level containers, so a search-results header naming the model validated any price on the page; the walk now stops at `body`/`html` and prefers the product card

**UI**
- [x] "Set Alert at X (−5%)" created the alert at the *current* price (handler ignored the suggested target); the target now flows through to `schedulePriceAlert`/`addPriceAlert`
- [x] Sort dropdown was rendered outside its own full-screen `Modal`, so on web (portaled above it) and native the options were unreachable; options moved inside the Modal
- [x] CSV import used the deprecated `expo-file-system` root API (throws at runtime) → `/legacy`
- [x] Notification center routed digest/product-less events to `/product/undefined`; now uses `notificationRouteFor`
- [x] 8 icons were unmapped on Android/web (rendered "?"); the `as IconMapping` cast hid them from `tsc`. Removed the cast so unmapped names fail typecheck, added the missing mappings
- [x] Product detail / live-prices hooks hung on the loading skeleton forever if a storage read rejected; reads now degrade
- [x] "Delete My Data" reported success even when the server delete failed; now distinguishes local-only deletion

**Payload caps**
- [x] `prices.uploadHistory` (200-point server cap) was sent the full 500-point local history by both backfill and the background refresh; trimmed to `MAX_UPLOAD_HISTORY_POINTS`; `uploadServerHistory` returns success so the backfill counts real uploads
- [x] Desktop pending-health buffer was unbounded (mobile was capped); capped at `MAX_UPLOAD_HEALTH_EVENTS`

- [x] Tests: `sync-retry-rejected`, `sync-future-stamp`, `history-sync-cap`, `discovery-buffer-caps`, updated `idb-adapter`/`storage`/`sync-router`/`winncom`/`utils`/`scraping-integration`/`history-sync`/`server-prices`/`sync-push-limits`; E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `280 passed | 1 skipped` / `1753 passed`, desktop `43 passed` / `218 passed`

## Phase 216: Follow-up fixes for the flagged lower-risk items

- [x] Settings whole-row LWW: two devices editing different fields while apart lost one edit. Added a last-synced `settingsSnapshot` to `SyncMeta` and a 3-way per-field merge on pull (keep local value where the local device changed a field since the snapshot, take remote otherwise). No snapshot (first sync after upgrade) falls back to whole-row LWW
- [x] `appendPricePoint` did not sort, so an out-of-order point made the 500-point cap drop arbitrary positional entries instead of the oldest. Now sorts chronologically before capping
- [x] Breaker store serialization was per-instance while all instances write the same `distributor_breaker` key, so concurrent health-probe/background writes could clobber each other. Queue is now module-level keyed by storage key
- [x] `convertPrice` left unrounded floats in best-price comparisons; added `roundMoney` applied at the `getBestPrice` boundary (not inside `convertPrice`, which feeds arithmetic chains)
- [x] Tests: `price-history-order`, `settings-field-merge`, `breaker-cross-instance` (all verified non-vacuous by reverting); E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `283 passed | 1 skipped` / `1759 passed`, desktop `43 passed` / `218 passed`

## Phase 217: Whole-app review round 2 (desktop, notifications, server data, UI)

**Desktop (Tauri)**
- [x] `withGlobalTauri` was unset, so every `window.__TAURI__` feature probe returned false: the Rust JSON files were never written (Rust price/alert/tray pipeline was a no-op) and OAuth took the web branch. Enabled it
- [x] Tray had no fixed id (`TrayIconBuilder` default is unique per process) while `update_tray_badge` looks up `"main"` → badge/tooltip never updated. Added `.with_id("main")`
- [x] `fs:default` does not grant `write_file`, so every file export/backup was ACL-denied. Added `fs:allow-write-file`
- [x] Only `watchlist_products` was mirrored to the Rust files; alerts/reminders/settings were localStorage-only while Rust read the files (alerts never fired, tray count always 0, export produced nulls). Now mirrors all four keys via `set_value_for_key`
- [x] Watchlist "Refresh" called `check_all_prices` (scrapes but never persists) and reported success; now calls `run_full_price_check` (registered as a command)
- [x] `server-notifications` uploaded untrimmed arrays and omitted `direction`/`snoozedUntil`/`quietHours` + the alert toggles; now matches mobile (caps + fields + gating)
- [x] "Sync now" was a silent no-op (`registerSyncSetup` never called); now registered/unregistered in App
- [x] `Compare`'s `SeriesChart` returned before `useState`/`useMemo` → "more hooks than previous render" crash on empty→non-empty; hooks now run unconditionally
- [x] Device Management called `.query()` on the React hook proxy (always truthy, no `.query`) → always errored; now uses the imperative client and the real `DeviceInfo` shape

**Notifications**
- [x] Enabling a restock watch called `scheduleStockAlert` (the real "Back In Stock!" alert) → immediate false notification; added `scheduleStockWatchConfirmation`
- [x] Mobile sign-out never unregistered the push token, so the server kept pushing the account's alerts to a signed-out device; `logout` now unregisters
- [x] Push payloads carried only `eventId`, so tapping a background push always opened Home; Expo + web push now include `type`/`productId`/`distributorId` and the SW deep-links
- [x] Server quiet hours were evaluated in the server process timezone; the client now sends `utcOffsetMinutes` and `isInQuietHours` honors it
- [x] Basket alert cleared the threshold even when permission was denied or scheduling threw (silent loss); now clears only after a successful send

**Server data layer**
- [x] Tombstone purge was scoped to the triggering user while gated globally → every other account's tombstones accumulated forever; now purges all users
- [x] `upsertUser` with a new openId + existing email matched the email index and left the old openId, permanently locking out OAuth sign-in for email-registered accounts; OAuth now links the openId by email first
- [x] `prices.uploadHistory` accepted non-ISO and future-dated points (a year-3000 point wins every LWW merge forever); now requires strict ISO-8601 UTC and rejects >1 day future
- [x] `device_labels` were not deleted on unbind, so a re-bound deviceId inherited the previous owner's label; `unbindDevice` now deletes them
- [x] Added indexes: `revoked_devices.deviceId` (auth hot path), `device_notification_configs.userId`, `device_push_tokens.userId` (migration `0024`)

**UI / libs**
- [x] Drop calendar built its grid with fixed 24h steps → a day vanished across DST; now uses calendar-date arithmetic
- [x] Watchlist filter/search crashed on products with undefined brand/model/category (CSV import produces them); now null-safe
- [x] Watchlist sparkline flattened all listings' histories without conversion, mixing USD/MYR; now converts to the display currency
- [x] CSV export allowed formula injection (`=`, `+`, `-`, `@`); now prefixed with a single quote
- [x] `computeHealthSummary` threw on an unparseable sample date (blanked the Health detail screen); now ignores invalid dates

- [x] Tests: `quiet-hours-offset`, `csv-injection`, `watchlist-filter-missing-metadata`, `drop-calendar-dst`, `health-summary-invalid-date`, `tombstone-purge-scope` (all verified non-vacuous); updated `devices`/`oauth-handlers`/`sync-db`/desktop `health-probe-upload`; E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `289 passed | 1 skipped` / `1770 passed`, desktop `43 passed` / `218 passed`

## Phase 218: Rust/Tauri fixes (scraper gating, poller, OAuth, IO)

- [x] Local Rust scrapers did not model-gate: each selected the first `.price` on the *search-results* page, so an unrelated product's price could be recorded. Added `parse_price_page` + `price_element_matches_model` in `scrapers/mod.rs` (card-boundary walk, mirrors the mobile `modelMismatch` guard) and rewrote all 25 parsers to use it; added Rust tests incl. a decoy-first-result case
- [x] Shared HTTP client had no timeout, so one unresponsive host could hang the 25-distributor sequential health check forever. Added 15s request / 10s connect timeouts
- [x] `stop_price_poller` only cleared a flag while the loop could be parked in `interval.tick()` for the full interval; a stop+start left two pollers running. Added a `POLLER_GENERATION` token the loop checks each wake-up; also guards `interval_minutes == 0` (would panic `tokio::time::interval`)
- [x] Desktop OAuth accepted a raw `sessionToken` from the callback URL (login CSRF / session fixation) and ignored `state`. Now accepts only the single-use server ticket, redeems it via `redeemOAuthTicket`, and `buildLoginUrl` sends a `deviceId` so the server issues a device-bound ticket
- [x] `write_json_file` used truncate-then-write, so a crash mid-write left an unparseable file that aborted the poller/alert/tray paths. Now writes to a temp file and renames
- [x] Blocking FS/JSON commands (`read_watchlist`, `write_watchlist`, `set_value_for_key`, `export_watchlist`, `import_watchlist`, `update_tray_badge`) ran on the main thread (UI jank, up to 10MB JSON parse). Made async
- [x] `upload_server_history` POSTed to a `protectedProcedure` with no `Authorization` header, so backfill always failed. Now requires a session token (skips honestly without one); the renderer's TS path remains the real backfill
- [x] Tray "Check Now" passed an empty API base, forcing local scrapers. The last base passed by the renderer is now stored and reused
- [x] Snooze comparison was lexicographic while JS writes millis and Rust omits them, so an alert could fire slightly early. Added `parse_iso_to_epoch_ms` (civil-date conversion) and compare instants
- [x] Tests: 14 Rust tests (`cargo test`) incl. model-gating decoy, ISO parse parity, snooze ordering; E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `289 passed | 1 skipped` / `1770 passed`, desktop `43 passed` / `218 passed`

## Phase 219: Notification channels, restock retention, digest delivery, retention purges

- [x] Android notification channels were created but never referenced: every `scheduleNotificationAsync` omitted `channelId`, so all alerts landed on the default channel and the configured HIGH importance/sound/vibration were ignored. Added `channelIdFor()` and applied it to all 11 call sites (stock/price/digest)
- [x] A failed restock notification still deleted the watch, so the user never learned the item was back and the watch was gone. `runCheckRestocks` now keeps the watch when `scheduleStockAlert` returns null
- [x] The digest snapshot advanced even when nothing was delivered (permission denied / web / quiet hours), delaying the next digest a full interval. `sendPriceDigestNotification` now returns whether it scheduled, `DigestSender` returns boolean, and `maybeSendDigest` returns null on non-delivery
- [x] `price_cache` had no delete path and `listNearExpiry`/`getAllFetchedAt` sorted an unindexed `fetchedAt` (full scan + filesort every warmer tick). Added `purgeStalePriceCache` (30d, batched) + `idx_price_cache_fetched`
- [x] `revoked_devices` rows were only removed on unrevoke/user-deletion, feeding the per-request `isDeviceRevoked` scan. Added `purgeOldRevokedDevices` (90d)
- [x] Background tasks re-registered on every launch, resetting the OS scheduling window (iOS) and potentially deferring them indefinitely. Added a persisted interval marker so registration only happens when missing or changed
- [x] Tests: `retention-purges`, restock retention case in `restock.test.ts`, digest non-delivery in `price-digest.test.ts`, task-interval cases in `price-check.test.ts` (restock case verified non-vacuous); migration `0025`; E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `290 passed | 1 skipped` / `1776 passed`, desktop `43 passed` / `218 passed`

## Phase 220: DST digest, sync paging, transactional writes, CSV round-trip

- [x] Weekly digest used elapsed-24h day math, so across a DST transition a Sunday-to-Sunday week (167h) computed 6 days and skipped a week. Now compares calendar days with `Math.round`
- [x] `sync.pull` had no result cap (a full resync returned every live row + tombstone). Added `SYNC_PULL_MAX_ITEMS` (500) with `hasMore`, a `cursor` continuation param, inclusive re-inclusion at the boundary (client dedupes by key), and a client paging loop (bounded at 50 pages)
- [x] Registration wrote the user row and password hash as two un-transacted writes; a crash between them left an account with `passwordHash = NULL` that could never log in and could not re-register. Added `createUserWithPassword` (single transaction)
- [x] Password reset consumed the one-time token, then updated the hash separately; a failure after consumption burned the token. Added `resetPasswordWithToken` (consume + apply in one transaction)
- [x] CSV parser split on newlines before quote-aware parsing, so an exported value containing a newline could not be re-imported. Replaced with an RFC4180-correct tokenizer (quoted commas/newlines, CRLF, escaped quotes)
- [x] Tests: `csv-quoted-newline`, `sync-pull-paging`, DST weekly case in `price-digest.test.ts` (all verified non-vacuous); updated `password-reset`/`sync-router` mocks; E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `292 passed | 1 skipped` / `1782 passed`, desktop `43 passed` / `218 passed`

## Phase 221: Web share fallback, backup defaults, value labels, basket alignment

- [x] Share buttons were silent no-ops on web (react-native-web's `Share.share` rejects without the Web Share API, which desktop Chrome/Firefox lack). Added `lib/share-text.ts` (Web Share → clipboard → failed) and wired it into stats, watchlist, product, compare, settings, and distributor-analysis with user feedback on copy/failure
- [x] Backup import clobbered local settings fields missing from `SETTING_DEFAULTS` (`shippingRegion`, `watchlistSort`, `watchlistGroup`, `webNotificationsEnabled`) with the exporter's default. Completed the defaults map to match `DEFAULT_SETTINGS`
- [x] Watchlist summary "Total Value" summed every listing (25 distributors × a product), reading as a basket total. Renamed to "All Listings Value" and documented the distinction from `computeBasketValue`
- [x] `computeBasketValue` counted only `in_stock` while `getBestPrice` also counts `back_order`, so the basket total disagreed with per-product "Best Price". Aligned to the orderable set (in_stock + back_order)
- [x] Tests: `share-text` (4 cases), backup default-preservation cases, basket back-order/unknown cases (all verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint clean, root `293 passed | 1 skipped` / `1790 passed`, desktop `43 passed` / `218 passed`

## Phase 222: Whole-app review round 3 (security, retention, build, UI)

**Security**
- [x] `auth.me` returned the raw user row (passwordHash, openId, role). Now returns the same safe shape as REST `/api/auth/me`
- [x] SSRF: `isPrivateHostname` string-matched IPv4 only, so `[::ffff:127.0.0.1]`, `[::ffff:169.254.169.254]` (cloud metadata), `[fd00::1]`, `[fe80::1]` bypassed it. Added a real IPv6 parser (incl. IPv4-mapped/compatible, ULA, link-local, multicast)
- [x] Open redirect: `/\evil.com` passed the `/`-prefix check and browsers resolve it to `https://evil.com`. Now rejected
- [x] Apple OAuth was broken: `response_mode=form_post` POSTs the callback but only `app.get` was registered. Both methods now share one handler
- [x] Account pre-hijack: OAuth auto-linked to an existing email account without checking the provider's `email_verified`, letting an attacker pre-register a victim's email. Now links only when verified, else refuses
- [x] Cookie domain guessed a parent domain, which is a public suffix on hosts like `myapp.vercel.app`/`user.github.io` (browser drops the cookie → login never persists). Now host-only unless `COOKIE_DOMAIN` is set

**Data / retention**
- [x] `affectedRows` was read off the drizzle result, but mysql2 resolves deletes to `[ResultSetHeader, fields]` → always `undefined` → **every batched purge stopped after one batch** (5 call sites). Added `affectedRowsOf` and fixed all sites; tests now use the real driver shape
- [x] Health alerts were delivered twice: the local event id and the server-minted id never matched (different `Date.now()`, case). `scheduleHealthAlert`/`Recovery` now return the event id and the upload reuses it
- [x] `rowToConfig` dropped `utcOffsetMinutes`, so DB-backed quiet hours ran in the server timezone. Preserved
- [x] `atAllTimeLow` compared the current best (min) against the all-listing average; now compares best-vs-best (`bestPricePoints`)
- [x] Drop calendar kept only the first intraday drop per product/distributor, under-reporting `biggestPct`/`totalDrops`. Now keeps the largest
- [x] Web restock watches were consumed with no notification; now shows a web notification (or keeps the watch if alerts are off)
- [x] Movers were dropped when an edge point had an unrated currency; now uses the oldest/newest convertible points
- [x] `computeDigest` could emit `Infinity%` (0 baseline) and crashed on a product without `listings`; both guarded

**Build / CI**
- [x] Metro resolver only redirected `./browser` from `utils.ts`, so `resilient.ts`'s dynamic import bundled Playwright into native builds. Now redirects from any `lib/scrapers/` module
- [x] CI never ran `check:desktop`, desktop tests, or a build; `pnpm lint` only covered `app/`+`components/`. Widened lint to `app components lib hooks server shared scripts` (0 errors) and added desktop check/test + `pnpm build` to CI
- [x] SPA fallback served `index.html` via `res.sendFile`, bypassing the `no-store` header (stale shell across deploys). Header now set explicitly

**UI**
- [x] "Best Price" card hardcoded "In Stock" even for back-order/unknown listings; now derives the label/colour from `stockStatus`
- [x] Web date pickers were no-ops (`@react-native-community/datetimepicker` has no web impl); added `CrossPlatformDatePicker` (native input on web) used by reminder + reschedule modals
- [x] `ReminderSection` used `requestNotificationPermissions` (always false on web) instead of `ensureNotificationPermission`
- [x] Android silently dropped snooze options beyond 3 buttons; `showAlert` now chains a "More…" chooser
- [x] Device rename/sign-out ignored the boolean result (silent failure); now surfaces an error
- [x] Unhandled rejections in trending add / alert toggle+delete / web-notification toggle; guarded
- [x] Duplicate price alerts on double-tap; added an in-flight guard
- [x] Manual-add "Cancel" was disabled while adding (locked until timeout); now aborts
- [x] iOS "Rate the App" used the bundle id as an App Store id; now uses `EXPO_PUBLIC_IOS_APP_ID` or a store search

- [x] Tests: `affected-rows`, `insights-drop-calendar`, `quiet-hours-mapper`, SSRF cases, metro-resolver dynamic import, SPA fallback cache header (all verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `296 passed | 1 skipped` / `1800 passed`, desktop `43 passed` / `218 passed`, `pnpm build` green

## Phase 223: Whole-app review round 4 (blank web app, sync paging, desktop)

**Critical (shipping blockers)**
- [x] **The exported web app was a blank page.** `constants/oauth.ts` + `shared/src/trending.ts` used `import.meta`, which Babel leaves in the bundle; `index.html` loads it as a classic script, so every load threw `Cannot use 'import.meta' outside a module`. Verified with a headless-Chromium smoke test (body length 0). Replaced with static `process.env.EXPO_PUBLIC_*` access (which Expo inlines)
- [x] **Native (iOS/Android) bundling was broken.** `import.meta` is unsupported by Hermes; after fixing that, `cheerio` pulled `node:stream` into the native bundle. Added a native alias to cheerio's dependency-free browser build. Both `expo export -p ios` and `-p android` now succeed
- [x] Added `scripts/smoke-web.mjs` + `pnpm smoke:web` (headless render check) and `tests/web-export-invariants.test.ts`; wired into CI after `pnpm build`. Verified the smoke test fails on the injected regression

**Sync**
- [x] Pull paging was unsound: `listChangedItems` had no `ORDER BY`, so a `LIMIT` returned an arbitrary subset and the client's max-stamp cursor could skip rows (silent data loss on large accounts, and a full resync could delete live rows on other devices). Now orders by `(effectiveStamp, id)` and pages with a composite `(stamp, collection, id)` cursor
- [x] `retryKeys` included `stale_write` live items, so a losing edit was re-pushed with a bumped stamp and reverted the newer remote value. Now only validation/transient rejections retry
- [x] Settings merge base went stale after a failed push, making merged fields look locally-edited forever. The push-failure path now refreshes `settingsSnapshot`

**Desktop**
- [x] "Check Now" called the mobile `checkPriceDropsNow`, which reads the module-level IndexedDB store (empty in a Tauri webview) → no-op. Now uses the Rust `run_full_price_check`
- [x] Rust alert evaluation ignored `direction`, `distributorId`, notification settings, and quiet hours, and used the wrong stock filter. Aligned with mobile (rise/drop, per-distributor scope, settings+quiet-hours gate, in-stock only) and added `is_in_quiet_hours`
- [x] Rust alert deactivation was invisible to the desktop store (one-way mirroring) → the UI/server kept the alert active and could re-fire it. The `price-drops-triggered` event now carries `alertId` and the client calls `deactivateAlert`
- [x] Settings theme buttons didn't apply the theme: `saveSettings` wrote localStorage without dispatching the `app_settings:changed` event the theme hook listens for. Now dispatched
- [x] Rust `parse_price_from_text`/`infer_stock_status` diverged from mobile (EU separators, "not in stock"); aligned + Rust tests

**Server / data**
- [x] `deleteUserById` left `device_labels` orphaned (no FK) → a later account binding the same device id inherited the deleted user's label. Now deletes labels for the user's device ids
- [x] Health event `id` zod cap (191) exceeded `notification_events.id varchar(128)` → 500 on upload. Capped at 128
- [x] `x-device-id` header was unbounded vs `deviceId varchar(128)`; now bounded
- [x] Added indexes for the hot purge scans: `price_history.date`, `revoked_devices.revokedAt`, `password_reset_tokens.expiresAt`, `email_verification_tokens.expiresAt` (migration `0026`)

**Shared / config**
- [x] `hasExchangeRate`/`getExchangeRate` accepted prototype keys (`"toString"`) via `in`; now own-property checks
- [x] `cheapestByRegion` included `unknown`-availability listings; now matches `getBestPrice` (in_stock/back_order)
- [x] `@shared/const` alias was broken under vitest and Vite (points at `shared/src`, but the file is `shared/const.ts`); added a specific alias
- [x] `decodeOAuthState` threw on malformed base64; now returns empty state
- [x] Android `showAlert` could still pass 4 buttons (cancel + 3) and could recurse forever on an empty remainder; fixed
- [x] Web restock watches were consumed even when `displayWebNotification` no-oped; it now returns whether it displayed
- [x] `bestPricePoints` filtered by the listing's *current* status instead of each point's status, inflating the historical best and firing false "all-time low"

- [x] Tests: `web-export-invariants`, updated `sync-pull-paging`/`sync-router`/`delete-user-cleanup`/`desktop-web-globals`, Rust parser tests; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `297 passed | 1 skipped` / `1805 passed`, desktop `43 passed` / `218 passed`, `cargo test` 16 passed, `pnpm build` + `pnpm smoke:web` green

## Phase 224: Whole-app review round 5 (scrapers, alerts, auth, stats)

**Scrapers (many were silently dead)**
- [x] 5 parsers pointed at dead/parked domains: `rocnoc.com` (NXDOMAIN → `roc-noc.com`), `linktechs.com` (parked → `shop.linktechs.net`), `networkdevices.com` (parked → `networkdevicesinc.com`), `100mega.cz` (403 → `b2b.100mega.com`), `getic.gr` (403 → `getic.com`), plus `multilink.us` → `shop.multilink.us`
- [x] 8 parsers used a search URL the site ignores or 404s: linitx (`search.php?keywords`), flytec (`search.php?search_query`), server2u (`?search`), miro (`?s`), duxtel (OpenCart route), winncom (`/en/search`), wisp (iqitsearch), aerial (osCommerce `advanced_search_result.php`)
- [x] `mikrotikstore` two-hop flow lived only in an unused helper; added `resolveProductUrl` to the parser interface + a shared `fetchAndParse` used by all four call sites
- [x] Browser escalation hardcoded US locale/timezone/geolocation for every distributor; now derives them from the distributor's region
- [x] Browser path retried once (vs plain's maxRetries) and skipped the plain fallback on a browser block; both fixed
- [x] Health classified a circuit-breaker cooldown as `error` (false uptime loss); now `blocked`
- [x] Added `tests/parser-host-parity.test.ts` asserting every parser's base host matches its distributor website (verified non-vacuous)

**Alerts / reminders**
- [x] Server re-pushed persisting events every 5 min once the dedup cooldown released (overdue reminder/restock spam). Push now only fires for newly-inserted events
- [x] Web price/basket alerts called `requestNotificationPermissions` (always false on web) and never displayed anything; now `ensureNotificationPermission` + `displayWebNotification`
- [x] Server events were marked "displayed" even when nothing was shown, dropping them forever; `scheduleServerEventNotification` now reports delivery
- [x] Date reminders accumulated duplicates (dedup by id only); now dedup by product+distributor
- [x] Reschedule cancelled the old notification before scheduling the new one, losing the reminder on failure; order reversed
- [x] A stale server event could re-deactivate a freshly re-armed alert; `deactivateAlert` takes the event time and `rearmAlert` re-stamps `createdAt`
- [x] Badge counted snoozed alerts (disagreed with the in-screen count); now excludes them
- [x] "Price Drop History" header mislabeled rise alerts; renamed to "Alert History"
- [x] Server `buildEvents` only knew the static catalog, so custom products never notified server-side; the client now uploads `modelNumber`

**Auth**
- [x] Login/register/account mutations omitted `x-device-id`, so a revoked device could sign back in and mutate the account; all now send it, and `assertDeviceAllowed` prefers the session claim
- [x] `useAuth` had no shared state: signing in from Settings never started sync, and signing out left the layout "signed in". Added a module-level shared store
- [x] Logout left the previous account's data + sync cursor on disk (cross-account leak); now clears local data
- [x] Web OAuth redirect pointed at a non-existent `/api/auth/callback` and sent `deviceId` (forcing the native ticket branch); now uses the SPA route and omits deviceId on web
- [x] Web push was never unsubscribed on sign-out (server kept pushing); now unsubscribes + prunes
- [x] `getDeviceId` could reject and break every tRPC request; now degrades

**Stats / data**
- [x] `deleteUserById` orphaned `device_labels` (cross-account label leak)
- [x] Health event id cap (191) exceeded `notification_events.id varchar(128)`; capped
- [x] `x-device-id` header unbounded vs `deviceId varchar(128)`; bounded
- [x] Added indexes for hot purge scans: `price_history.date`, `revoked_devices.revokedAt`, `password_reset_tokens.expiresAt`, `email_verification_tokens.expiresAt` (migration `0026`)
- [x] `hasExchangeRate`/`getExchangeRate` accepted prototype keys; own-property checks
- [x] `cheapestByRegion` included `unknown`-availability listings; matches `getBestPrice`
- [x] `@shared/const` alias was broken under vitest/Vite; added a specific alias
- [x] `decodeOAuthState` threw on malformed base64; returns empty state
- [x] Android `showAlert` could pass 4 buttons and recurse forever; fixed
- [x] `clearAllData` omitted the background-task interval marker

**Desktop**
- [x] "Check Now" used the mobile IndexedDB store (empty in Tauri) → no-op; now uses the Rust pipeline
- [x] Rust alerts ignored direction/distributor/settings/quiet-hours and used the wrong stock filter; aligned with mobile
- [x] Rust alert deactivation was invisible to the desktop store; the event now carries `alertId` and the client deactivates
- [x] Settings theme buttons didn't apply the theme (no `app_settings:changed` dispatch); fixed
- [x] Rust price/stock parsing diverged from mobile (EU separators, "not in stock"); aligned + tests
- [x] Fixed a pre-existing flaky desktop test (modal focus race) so the new CI desktop step is reliable

- [x] Tests: `parser-host-parity`, `reminder-dedup`, updated ~25 test files for the intentional behavior changes; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `299 passed | 1 skipped` / `1810 passed`, desktop `43 passed` / `218 passed`, `cargo test` 16 passed

## Phase 225: Review round 5 follow-ups (retention, sharing, notifications)

- [x] `purgeOldRevokedDevices` deleted only one 1000-row batch per tick (no drain loop), so a backlog never caught up; now batches like the other retention jobs
- [x] `getDeviceBinding` returned the first config row even when its `userId` was NULL, masking a user-bound push token → any authenticated user could claim that device. Now prefers a user-bound row across configs and tokens
- [x] `sharedWatchlists.get` counted tombstones toward the 500-item cap, truncating live products for owners with many deletions; tombstones are now filtered in SQL
- [x] Expired shares were still joinable/listed (`join`, `members` never checked `expiresAt`); both now reject expired tokens
- [x] `evaluateUserDb` loaded every retained event + delivery for a user each tick; bounded to the delivery-grace window
- [x] Digest day bucket used UTC while quiet hours use the user's offset; the digest now buckets by the user's local day
- [x] Locally-fired price/restock notifications were never recorded in the in-app Notification Center (only server events were), so the history and unread badge diverged from what the OS showed; both now record
- [x] Tests: `revoked-purge-batching`, `device-binding-precedence` (both verified non-vacuous), updated `shared-watchlists` fake DB for the SQL tombstone filter; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `301 passed | 1 skipped` / `1816 passed`, desktop `43 passed` / `218 passed`

## Phase 226: Whole-app review round 6 (screens, tests, a11y, regressions)

**Regressions from Phases 224-225 (fixed)**
- [x] Web OAuth was still broken: the `deviceId` query param was omitted on web but `X-Device-Id` was still sent, and the server falls back to the header → still took the native ticket branch. Header now suppressed on web too
- [x] Digest `utcOffsetMinutes` was dropped by `aggregateConfigs`, so the Phase 225 timezone fix was a no-op for signed-in users (the main path). Quiet hours now carried through aggregation
- [x] `fetchAndParse` passed the resolver's raw (relative) href to `fetch`/Playwright, which reject relative URLs → the new MikroTik-Store two-hop never worked. Now resolved against the search URL
- [x] `regionSignalsFor` didn't normalize `www.`, so `www.aerial.net` fell back to North America (the exact bug the region change fixed). Normalized
- [x] `getDeviceBinding` memory path still had the anonymous-config-masks-token bug (only the DB branch was fixed). Fixed
- [x] Reschedule kept the old notification scheduled but cleared its stored id when the new schedule failed → an uncancellable stale notification. Now keeps the old id
- [x] `updateAlert` re-armed without re-stamping `createdAt`, so the stale-event guard didn't cover the edit path. Now re-stamps

**Screens**
- [x] Product detail hung on the skeleton forever if the settings read failed (or `id` was missing); now an explicit `settingsLoaded` flag
- [x] Notification center hung on the skeleton forever on a storage failure; `load` now has try/finally
- [x] Watchlist `loadData` could reject unhandled and left the settings gate closed (price filter/prefs silently dead); now caught
- [x] Watchlist delete/swipe-delete/undo failures were silent unhandled rejections; now surfaced
- [x] Alerts edit-save, compare cross-alert creation, health "Test All", and settings load failures were unhandled; now surfaced
- [x] Settings `updateSetting` did an unserialized read-modify-write, so two quick changes clobbered each other; added `updateSettings` (serialized)
- [x] Sign-out silently deleted all local data with no confirmation (the only destructive action without one); now confirms
- [x] Sign-out also wiped onboarding/theme/currency via `clearAllData`; added `clearAccountData` that preserves device-local preferences

**UX / a11y**
- [x] Web `showAlert` collapsed >2 buttons to a single confirm, making "Share as Text" unreachable; now a numbered chooser
- [x] Settings "Re-enable" distributor only refreshed `lastChecked` and never cleared the circuit breaker, so the UI showed OK while the distributor stayed in cooldown; now clears the breaker
- [x] Product-detail sticky share had no accessibility label/role; product card announced only the name (no price/status); LLM settings inputs/buttons had no labels; restock empty state rendered a literal `it&apos;s`

**Test quality**
- [x] `distribute-pricing-regression` referenced a nonexistent function and asserted test-local math; rewritten to exercise the real pricing surfaces
- [x] `scraping-integration` had a local-array "append" test and a network-failure test that never called the scraper; both now exercise real code
- [x] `adversarial` parser test returned early for any parser that couldn't parse (24/25 parse it, but the assertion was weak); now asserts the exact target price + a non-vacuity guard
- [x] `orphan-purge` asserted only call counts; now checks the SQL predicate is a scoped `NOT IN`
- [x] `launch-seed` asserted only call counts; now asserts the seeded payload (verified non-vacuous)
- [x] `notifications` "stores a config" asserted the ambient empty state; now drives evaluation
- [x] `web-export-invariants` had an `expect(true).toBe(true)`; now logs when the build artifact is absent

- [x] E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `301 passed | 1 skipped` / `1817 passed`, desktop `43 passed` / `218 passed`

## Phase 227: Review round 6 follow-ups (navigation, error states, a11y)

- [x] Notification tap on cold start could throw ("navigate before Root Layout mounted") or be silently dropped; the route is now buffered until the Stack mounts
- [x] `notificationRouteFor` threw on a notification without a `data` payload; now tolerates undefined/null
- [x] `alerts` `editDistributors` crashed on a product without `listings` (legacy/synced rows); now `?? []`
- [x] `/w/[token]` with a missing token rendered an empty "0 products" page (query disabled → not loading, not error); now shows "Invalid link"
- [x] `/w/[token]` hardcoded USD for best price, ignoring the user's display currency; now loads it
- [x] `/compare/[id]` with a missing id rendered a blank screen; now an empty state
- [x] Unhandled rejections in focus/sync-meta reads, basket-alert save, live-prices refresh, reschedule scheduling, restock remove, and tag-sheet loads; all guarded (tag sheets no longer show a misleading "No tags yet" on a load failure)
- [x] Compact watchlist header used the same `arrow.clockwise` glyph for "Check Now" and "Refresh all"; Check Now now uses `bolt.fill` (mapping added)
- [x] Added `hitSlop` to the 26px target "+" button, 24px tag colour swatches, and drop-calendar cells
- [x] Removed the unused `getAuthSnapshot` export (dead code from the shared-state refactor)
- [x] Tests: `notification-routing-null`, `clear-account-data` (verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `303 passed | 1 skipped` / `1823 passed`, desktop `43 passed` / `218 passed`

## Phase 228: Run the DB-gated sync tests + wire them into CI

- [x] The sync/data-loss tests (`sync-e2e`, `sync-db`) are gated on `RUN_DB_TESTS` + `TEST_DATABASE_URL`, which CI never set — so the only end-to-end coverage of sync (cross-device round-trip, tombstones, cross-user isolation, LWW) never ran. Verified they pass against a real MySQL (17 tests)
- [x] Added DB-level coverage for the Phase 223 paging fix: `listChangedItems` must return rows in ascending effective-stamp order (written with descending server stamps so an unordered LIMIT is detectable) — verified non-vacuous (fails without the ORDER BY)
- [x] Added DB-level tests for full-resync completeness (a stale cursor returns untouched live rows, not just tombstones) and tombstone propagation without resurrection
- [x] CI: added a MySQL 8.4 service, `pnpm db:push` against it, and a `pnpm test:db` step with `RUN_DB_TESTS=1`; verified the full clean-DB flow (migrate → 17 tests pass) locally
- [x] E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `303 passed | 1 skipped` / `1823 passed`, desktop `43 passed` / `218 passed`

## Phase 229: Whole-app review round 7 (native build, SSRF, data loss)

**Native build was broken (highest impact)**
- [x] **iOS could not build at all**: `bundleId = "com.app.stock_tracker_pro"` fails Expo's iOS bundle-id validation (no underscores) — `expo prebuild --platform ios` threw `ERR_ASSERTION`. Renamed to `com.app.stocktrackerpro` across `app.config.ts`, the store links, `tauri.conf.json`, and AGENTS.md; iOS prebuild now succeeds
- [x] **Native module major-version drift**: `expo-background-task`/`expo-task-manager` were pinned at SDK 57 versions (`^57.0.5`) on an SDK 54 project, `@react-native-community/datetimepicker` at 9.x (expected 8.4.4), plus ~10 patch drifts. Aligned all via `expo install --check` (now "Dependencies are up to date"); removed the unused `expo-clipboard`
- [x] **iOS background tasks could never run**: the `expo-background-task` config plugin was not applied, so `UIBackgroundModes: ["processing"]` and `BGTaskSchedulerPermittedIdentifiers` were absent and `registerTaskAsync` silently no-ops on release builds. Added the plugin; verified both keys now appear in the prebuilt Info.plist

**Security**
- [x] **SSRF via web-push endpoint**: any signed-in user could register a subscription whose `endpoint` pointed at an internal host/metadata service; `web-push` then issued an outbound request carrying a VAPID JWT. Added `isAllowedPushEndpoint` (real push services only, https) enforced at registration AND send time

**Data loss**
- [x] Background price check replaced the whole `listings` array with only the processed subset when the time budget tripped mid-loop (or before the first listing), deleting listings and their price history. Extracted `refreshListingsWithinBudget` which carries unprocessed listings through unchanged and never writes an empty array over a non-empty one (verified non-vacuous)
- [x] Web basket-alert failure did `return` from `runPriceCheckCore`, skipping all price-alert evaluation for that run; now throws into the local catch so the run continues
- [x] Replacing a date reminder discarded the old `notificationId` without cancelling it, so the old reminder still fired and could not be cancelled; `addBackOrderReminder` now returns the replaced id and callers cancel it

**Settings races**
- [x] `saveSettings({...settings, ...})` read-modify-writes in the background task, web-notifications, and stats could clobber a concurrent `updateSettings`; all now use the serialized `updateSettings` patch

**Test infrastructure**
- [x] Replaced `ReturnType<typeof createHealthService>` / `createHealthCollector` in exported signatures with explicit `HealthService` / `HealthCollector` types — the `typeof` form made the module unparseable by Rollup under vitest
- [x] Tests: `push-endpoint-allowlist`, `price-check-budget-preserve` (verified non-vacuous); updated `web-notifications`/`notifications-router`/`web-push-server` mocks; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `305 passed | 1 skipped` / `1829 passed`, desktop `43 passed` / `218 passed`, `pnpm build` + `pnpm smoke:web` green

## Phase 230: Review round 7 follow-ups (desktop parity, limits, CI)

**Desktop/mobile scraper parity (desktop was silently broken for ~18 distributors)**
- [x] 24 Rust parsers used a generic `${base}/search?q=` URL while mobile uses site-specific paths/hosts (server2u `?search`, aerial osCommerce, duxtel OpenCart, flytec `search_query`, getic `.com`, linetx `search.php?keywords`, linktechs `shop.`, mbsiwav `.com`, mega `b2b.`, miro `?s`, multilink `shop.`, rocnoc `roc-noc.com`, winncom `/en/search`, wisp iqitsearch, interprojekt catalogsearch). Synced all from the mobile source
- [x] Rust parsers all used the same generic price selector; synced each to its mobile counterpart (getic's `[data-testid='price']` etc.)
- [x] Added `tests/desktop-scraper-parity.test.ts` asserting every Rust parser's search URL + price selector match mobile (verified non-vacuous)

**Desktop correctness**
- [x] `update_tray_badge` was `async` but called fire-and-forget, so the future was dropped and the badge/tooltip never updated. Made it synchronous; also counts back-in-stock watches (mobile counts them) and excludes them from the reminder count
- [x] Shared modules read `process.env.EXPO_PUBLIC_*` but the desktop Vite build only inlines `VITE_*`, so AI discovery / listing discovery / trending silently saw an empty API base. Added a `define` bridge mapping the EXPO names to the VITE values (verified inlined in the bundle)
- [x] The AsyncStorage stub was a module-level `Map`, making `defaultStorage` a throwaway: shared modules (llm-discovery) wrote discovered products there while the UI read the desktop store. Now backed by localStorage so both share one store
- [x] Desktop server-pulled events were shown as OS toasts but never recorded in the Notification Center (Alerts tab stayed empty); now records history like mobile
- [x] `VITE_VAPID_PUBLIC_KEY` was the only accepted name while the repo documents `EXPO_PUBLIC_VAPID_PUBLIC_KEY`; now accepts both
- [x] `use-theme` wrote `app_settings` directly to localStorage, skipping the Rust mirror + sync-dirty stamp; now goes through `storage.updateSettings`
- [x] Settings interval change fired `stopPricePoller()` without awaiting then started, so the start could no-op and the stop land after — leaving no poller. Now sequenced with await
- [x] OAuth loopback accepted the first connection on any path, so a stray local request aborted login; now loops until `GET /callback` with a ticket

**Server**
- [x] `notifications.uploadConfig` `snoozedUntil` was an unbounded string persisted to a JSON column; now max 64 + ISO-validated
- [x] `healthEvents[].createdAt` accepted far-future values (un-purgeable); now bounded to now+60s
- [x] `prices.uploadHistory` accepted any distributor/model (orphaned rows, cross-user history poisoning) and unbounded prices; now requires a registered parser id + catalog model, price ≤ 99,999,999
- [x] `health.check` had no single-flight, so concurrent cold calls each ran a full 25-distributor scan; added in-flight dedup
- [x] `notifications.pull` returned an unbounded event list; now ordered + capped at 200
- [x] `trending.get` read every non-expired row and sliced in memory; now `ORDER BY fetchedAt DESC LIMIT 10` in SQL
- [x] Removed the `openId === "admin"` privilege backdoor in `upsertUser`

**CI**
- [x] `pnpm smoke:web` would fail on a clean runner: `playwright` has no postinstall, so its browsers were never installed. Added `npx playwright install --with-deps chromium`

- [x] Tests: `desktop-scraper-parity` (verified non-vacuous), updated `prices-router`/`notifications` fakes; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `306 passed | 1 skipped` / `1831 passed`, desktop `43 passed` / `218 passed`, `cargo test` 16 passed, `pnpm build` + `pnpm smoke:web` green

## Phase 231: Whole-app review round 8 (CSRF, SSRF, sync paging, dedup keys)

**Security**
- [x] **CSRF**: the session cookie was `SameSite=None` on HTTPS with no CSRF token, so a cross-site form post could drive cookie-authenticated mutations (e.g. `POST /api/auth/delete-account`). The SPA is same-origin, so `SameSite=Lax` is correct and closes it
- [x] **SSRF (DNS rebinding)**: `isBlockedUrl` only checked literal IPs, so `127.0.0.1.nip.io` / `localtest.me` passed and resolved to loopback/metadata. Added DNS resolution rejecting any private resolved address
- [x] **Unbounded body read**: `tryParseUrl` cleared its abort timer once headers arrived, so a server that stalls the body hung the request; the timer now covers the body read
- [x] **Global 50mb body limit** applied before auth (unauthenticated memory DoS); now 256kb globally with a 10mb limit only on `/api/trpc/sync.push`
- [x] **`startServer().catch(console.error)` exited 0** on startup failure; now logs and `exit(1)`

**Sync (my own Phase 223 regression)**
- [x] **Paging order mismatch**: `afterCursor` compared collection names lexicographically while the router sorted by `["watchlist","alerts","reminders","settings"]`. The two orders disagree, so a page boundary could skip rows in a collection that sorts earlier lexicographically but later canonically. Both now share `SYNC_COLLECTION_ORDER` (verified non-vacuous)

**Notifications**
- [x] **Over-long dedup key wedged the warmer**: `restock:${productId}:${distributorId}` can exceed `dedupKey varchar(255)`, and "Data too long" is not a duplicate-key error, so it escaped per-device evaluation and aborted the whole tick (including purges) every run. Keys are now clamped with a stable hash suffix
- [x] **Health dedup keyed on the client timestamp** (bounded only to now+60s), letting a signed-in user mint unlimited distinct events/pushes. Now bucketed by server time (one per distributor+status per hour)
- [x] `reconcileEvent` ran for already-displayed events, so a replay could delete a stock watch the user re-created (ids are deterministic); now skipped for displayed events
- [x] **LLM 4xx was retried**: the deliberate throw for a non-429 4xx was caught by the network-error branch and retried up to 5×; now returns the response

**Client**
- [x] **Manual-add sheet permanently broke after Cancel**: `activeRef` was only set true by the mount effect, so after one Cancel every later add silently discarded its result and the Add button stayed in a permanent spinner. Re-armed on each open
- [x] **Root navigation flag set before the Stack mounted** during onboarding, so a cold-start notification tap could navigate with no navigator; now gated on `onboardingState === "app"`
- [x] **Health-event upload race**: parallel uploads all read the same buffer and each wrote only its own event (dropping the rest); now serialized
- [x] `sortWatchlist` produced NaN comparators (`az` on a missing name, `recent` on an invalid date, `price_drop` with two nulls); all NaN-safe now
- [x] Digest could render "target hit at $0.00" (a server-detected trigger stores `triggeredPrice: 0`, which `??` doesn't fall back from)
- [x] `useProductDetail` hung on the skeleton forever on a storage read failure; `useAlertBadge` had an unhandled rejection that stopped badge updates
- [x] Launch effect had no `.catch`, so a storage failure skipped task registration, the launch price check, push registration, and the server-notification pull
- [x] Unhandled rejections in restock/health load, watchlist "Check Now", backup import, and the alert snooze/cancel/remove/re-arm handlers; all now surface errors

- [x] Tests: `dedup-key-bounds`, `sync-collection-order` (verified non-vacuous), updated `auth.logout`/`sync-router`/`sync-server-notifications`; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `308 passed | 1 skipped` / `1839 passed`, desktop `43 passed` / `218 passed`, DB tests 17 passed, `pnpm build` + `pnpm smoke:web` green

## Phase 232: Whole-app review round 9 (desktop security + parity)

**Desktop security**
- [x] **Arbitrary-path file write**: `set_value_for_key` joined the caller-supplied `key` onto `data_dir` with no validation, so an absolute key (`/home/user/.bashrc`) discarded the dir and `../` escaped it — any webview script could write attacker-controlled `.json` files anywhere writable. Added an allowlist of the five mirrored keys (also applied to the new `read_value_for_key`)
- [x] **OAuth callback read had no timeout**: a stray local process that connected and sent nothing wedged the login loop forever (the accept deadline is only checked at the loop top). Bounded the read to 5s

**Desktop correctness (parity with mobile)**
- [x] **Stale server snapshots accepted as current**: `fetch_server_price` took whatever `prices.get` returned, but the server returns its cached value and only kicks off a background refresh — so desktop persisted up-to-an-hour-old prices (and a fake history point) as just observed. Now rejects snapshots older than `SERVER_SNAPSHOT_TTL_MS` (mirrors mobile's `isFreshPriceSnapshot`)
- [x] **Health probes used `CRS326` for all 25 distributors**, so the model gate rejected the price for the 12 that stock CRS804 and reported them as errors. Ported `probe_model_for` from mobile's `PROBE_MODEL_BY_DISTRIBUTOR`
- [x] **Quiet hours evaluated in UTC** because the desktop Settings never persisted `utcOffsetMinutes`; now sends `Date.getTimezoneOffset()`
- [x] **Rust suppressed price alerts during quiet hours** while mobile applies quiet hours only to health alerts/digests — and skipping (rather than holding) permanently missed drops. Removed the gate; deleted the now-dead `is_in_quiet_hours`
- [x] **Price-rise alerts recorded as "Price Drop Alert!"** in history; the Rust event now carries `isRise` and the renderer labels by direction
- [x] **`rocnoc` used `td:contains('$')`**, which the Rust `scraper` crate cannot parse — `Selector::parse` returned Err and killed the entire selector list, so the parser always failed. Replaced with a supported selector AND added a fallback so an unparseable selector can never silently disable a parser again
- [x] **`mikrotikstore` targeted `mikrotik-store.de`** (mobile uses `.eu/en`); fixed
- [x] **History retention was 90 days** vs mobile/shared 365; aligned
- [x] **Corrupt JSON disabled the pipeline forever**: `read_json_file` returned Err and the poller ignores errors, so one bad file silently stopped all price polling and tray updates. Now quarantines the file and returns null
- [x] **Import/export dropped back-in-stock watches** and never refreshed the UI (the next renderer write mirrored stale localStorage back over the import). Added `stock_watches` to the export, a `storage-imported` event, and a `read_value_for_key` command the renderer uses to re-hydrate
- [x] Tray badge counted snoozed alerts; now excludes them like mobile

- [x] Tests: Rust `storage_key_allowlist` + `probe_model` (18 Rust tests total), parity test updated for the documented `:contains()` exception; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `308 passed | 1 skipped` / `1839 passed`, desktop `43 passed` / `218 passed`, DB 17 passed, `pnpm build` + `smoke:web` + desktop build green

## Phase 233: Review round 9 follow-ups (sync partial batch, tags, lint scope)

**Sync data integrity**
- [x] **Multi-batch push lost successful stamps**: when batch 2+ threw, the `catch` returned without persisting the stamps from batches that had succeeded, leaving those items with a meta stamp <= the old cursor so `collectDirty` treated them as already-synced and never re-pushed them. The catch now persists the accumulated stamps (verified non-vacuous)
- [x] **Pull drain advanced the cursor with pages pending**: hitting the 50-page guard still set `lastSyncedAt = pulled.lastSyncedAt`, permanently skipping the remaining pages. The cursor now stays at the previous value when the drain is incomplete (verified non-vacuous)
- [x] **`applyLocalItem` dropped locally added tags**: product-level fields came wholesale from the incoming copy, so a tag added on this device vanished after a sync. Tags are now unioned (verified non-vacuous)

**Server**
- [x] `auth.deleteAccount` (tRPC) had no `confirm: "DELETE"` guard unlike the REST endpoint; added for parity

**Desktop build hygiene**
- [x] `desktop/tsconfig.json` excluded `desktop/tests`, so `pnpm check:desktop` never typechecked them — adding them surfaced 3 real type errors (adapter `setItem`/`removeItem` returning non-void, an unused import). Fixed and now included
- [x] `pnpm lint` did not cover `desktop/src`; widened the glob, which surfaced 14 real `react/no-unescaped-entities` errors in desktop JSX. All fixed — lint is now 0 errors across desktop too

- [x] Tests: `sync-partial-batch` (3 cases, all verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `309 passed | 1 skipped` / `1842 passed`, desktop `43 passed` / `218 passed`, DB 17 passed, Rust 18 passed, `pnpm build` + `smoke:web` green

## Phase 234: Tauri release build (Linux bundles)

- [x] `cargo tauri build` now succeeds end-to-end on Linux (webkit2gtk-4.1, gtk3, libsoup3, librsvg all present): produces the release binary plus **3 bundles** — `.deb` (7.7M), `.rpm` (7.7M), `.AppImage` (82M), all versioned `5.16.0`
- [x] Fixed bundle metadata: the `.deb`/`.rpm` shipped `Maintainer: app` and `Description: (none)`. Added `publisher`, `copyright`, `category`, `shortDescription`, `longDescription` to `tauri.conf.json` `bundle` (verified: `Maintainer: Product Stock Finder`, real description, correct auto-detected deps with no duplicates)
- [x] Verified the AppImage structure (AppRun, `.desktop` with `Categories=Utility`, icon, 24M binary) and the `.deb` control fields
- [x] `desktop/src-tauri/target/` confirmed gitignored; desktop `tsc 0`, 218 tests, 18 Rust tests still green
- [ ] macOS/Windows bundles + code signing still require their own build hosts (not possible here)

## Phase 235: Server hardening + desktop correctness (round 9 follow-ups)

**Server hardening**
- [x] `/api/healthz` returned the raw DB error message to unauthenticated callers (driver errors can include host/user/schema); now logs server-side and returns only `{ok:false, db:"error"}`
- [x] Graceful shutdown closed the DB pool BEFORE the HTTP server, so in-flight requests failed during the drain window; now closes the listener + drains first, then the pool
- [x] No `unhandledRejection`/`uncaughtException` handlers; added (log always; exit non-zero on uncaught, stay up on unhandled rejection)
- [x] Rate-limit bucket map was unbounded under a rotating-IP flood (time-based prune alone never evicts active keys); now an LRU capped at `MAX_BUCKETS` (10k), enforced on insert too (verified non-vacuous)
- [x] Unbounded scrape queue: public `prices.get` could queue unlimited closures; now rejects past `MAX_QUEUED_SCRAPES` (50) so callers fall back to cache/miss. Also fixed the `finally` releasing a slot that was never acquired (would corrupt the active count)
- [x] Concurrent `notifications.pull` for one device could deliver the same events twice (select + upsert weren't atomic); now one transaction with `SELECT ... FOR UPDATE`

**Desktop correctness**
- [x] `parse_price_from_text` concatenated EVERY number in the element ("Was $100 Now $80" → 10080); now takes only the first number run, like mobile
- [x] Model gating used a bare substring match, so "CRS326" matched inside "CRS3260" (another product) and recorded its price; now requires a token boundary (normalization keeps separators as spaces)
- [x] The Rust poller only evaluated price alerts, so signed-out desktop users with a back-in-stock watch never got notified; the renderer now runs the TS `checkRestocks` on each `prices-checked` sweep

- [x] Tests: `rate-limit-bounded` (verified non-vacuous), Rust `parse_price_from_text_takes_only_the_first_number` + `text_mentions_model_requires_a_token_boundary`, updated `notifications` fake DB for the transaction; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `310 passed | 1 skipped` / `1843 passed`, desktop `43 passed` / `218 passed`, DB 17 passed, Rust 20 passed, `pnpm build` + `smoke:web` green

## Phase 236: Public repo + CI green (billing unblocked, migration fix)

- [x] Repo flipped to **public** (`pnoch/product-stock-finder`) after a secret scan (no `.env` tracked, no real API keys — `re_K5…` appears 0 times, VAPID hits are names/test placeholders, all DB URLs are localhost test creds) and scrubbing Railway service/proxy/deployment IDs from `docs/HANDOVER.md` + `todo.md`
- [x] CI now runs end-to-end (billing gate gone): **typecheck, desktop typecheck, lint, root tests, desktop tests all pass in CI**
- [x] Fixed the `pnpm db:push` CI failure: `drizzle/0023_quiet_hours.sql` ended with a trailing `--> statement-breakpoint`, so drizzle emitted an empty final statement and MySQL rejected it (`ER_EMPTY_QUERY: Query was empty`), aborting the migration run. Reproduced locally against a fresh DB, removed the trailing breakpoint, verified a clean-DB migrate + 17 DB tests
- [x] Added `tests/migration-files.test.ts` (no trailing breakpoint, no empty statements) — verified non-vacuous
- [x] E2E root `tsc 0`, lint 0 errors, root `311 passed | 1 skipped` / `1845 passed`

## Phase 237: Universal links + privacy policy (store-submission blockers)

- [x] **Universal links / App Links were configured but non-functional**: `app.config.ts` sets `associatedDomains: ["applinks:<host>"]` and an Android `autoVerify` https intent filter, but the server served no association documents, so the OS never verified the domain and https links opened the browser. Added `registerWellKnown` in `server/spa.ts` serving `/.well-known/apple-app-site-association` (built from `APPLE_TEAM_ID` + `IOS_BUNDLE_ID`, listing the real app routes) and `/.well-known/assetlinks.json` (from `ANDROID_SHA256_CERT_FINGERPRINTS` + `ANDROID_PACKAGE`); mounted in `server/_core/index.ts` before the SPA, with a startup log naming any unconfigured var. Both 404 with a clear message when unset
- [x] **Dead privacy-policy link** (`https://productstockfinder.app/privacy` → NXDOMAIN) would block App Store + Play Store submission. Added `lib/legal-links.ts` (`getPrivacyPolicyUrl`/`getSupportEmail`, overridable via `EXPO_PUBLIC_PRIVACY_URL`/`EXPO_PUBLIC_SUPPORT_EMAIL`, defaulting to the deployed web host) and a real `app/privacy.tsx` policy page served by the SPA. Support email now defaults to the verified domain instead of a dead mailbox
- [x] Tests: `tests/well-known.test.ts` (AASA/assetlinks builders + live routes + unconfigured 404s); E2E root `tsc 0`, lint 0 errors, root `312 passed | 1 skipped` / `1851 passed`, `pnpm build` + `smoke:web` green
- [ ] Needs values only you have: `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINTS` (from the signing keystore) on Railway, then universal links verify

## Phase 238: Store submission metadata

- [x] `eas.json`: added `channel` to preview/production build profiles and `submit` profiles (production + internal) with Android `track: internal`, `releaseStatus: draft` (validated against the installed eas-cli's `SubmissionAndroidReleaseStatus` enum). No placeholder values — iOS `ascAppId` is intentionally omitted so EAS prompts on first submit
- [x] `app.config.ts`: added `NSUserNotificationsUsageDescription` (without it iOS rejects the notification permission request on a release build). Deliberately did NOT add `buildNumber`/`versionCode` — `appVersionSource: remote` manages those
- [x] `docs/store-listing.md`: store copy (short/full description, keywords), identity table, required screenshot/icon assets, data-safety answers, and the exact `eas build`/`eas submit` commands
- [x] `tests/store-config.test.ts`: guards the usage string (exact key + non-empty value), iOS/Android identifier lockstep, valid eas.json profiles with no `REPLACE_WITH` placeholder, and the listing doc (verified non-vacuous)
- [x] E2E root `tsc 0`, lint 0 errors, root `313 passed | 1 skipped` / `1855 passed`, desktop 218, `pnpm build` + `smoke:web` green

## Phase 239: Low-severity audit cleanup (timers, N+1, dead code, auth buckets)

- [x] **Timer leaks**: 9 `Promise.race([p, new Promise(r => setTimeout(...))])` sites (push-token ×3, server-notifications ×2, server-images, server-insights, devices ×5) never cleared the timer, leaking one per call and holding the event loop open. All now use the existing `withTimeout` helper (which clears on settle)
- [x] **N+1 sync writes**: `sync.push` ran one INSERT + one SELECT per item sequentially (a 200-item push = 400 serialized round trips holding the response). Added `server/concurrency.ts` `mapWithConcurrency` and applied it at 8-way concurrency, preserving order so `stamped`/`rejected` stay stable. Verified against the real DB (17 DB tests pass) and non-vacuous
- [x] **Dead code**: removed `getTrending()` (fetched a non-existent `/api/trending` route, no callers) and its dead test block. Left `server/_core/heartbeat.ts` alone (framework dir per AGENTS.md)
- [x] **Auth rate-limit bucket sharing**: all 10 auth endpoints shared one 10/min per-IP bucket, so a NATed office or a `providers` poll could lock out logins. Each endpoint now has its own scoped bucket (`register:<ip>`, `login:<ip>`, `oauth-callback:<ip>`, …)
- [x] Tests: `concurrency` (order, concurrency cap, empty, rejection — verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `314 passed | 1 skipped` / `1858 passed`, desktop `43 passed` / `218 passed`, DB 17, Rust 20, `pnpm build` + `smoke:web` green

## Phase 240: Whole-app review round 10 (regressions + guards)

**Regressions from Phases 235-239 (fixed)**
- [x] **The 10mb `sync.push` body limit was dead**: the global 256kb parser was mounted first, so Express consumed the stream and 413'd any push >256KB before the path-scoped parser ran. Reproduced with a 499KB payload (413 `entity.too.large`). Reordered so the scoped parser mounts first; verified a 499KB push now 200s while `/api/auth/login` still 413s
- [x] **Health dedup swallowed recovery events**: alert and recovery both send the same `status`, and the new server-hour bucket made their keys identical, so a distributor that failed and recovered within an hour lost the recovery. Added a `kind: "alert" | "recovery"` field threaded client→schema→key (verified non-vacuous)
- [x] **`clampDedupKey` was bypassed**: `buildEvents` built draft keys with raw templates, so a long-id restock watch could still exceed `varchar(255)` and wedge the whole warmer tick. Drafts now clamp too
- [x] **Scrape-queue rejection was unhandled / aborted ticks**: `void refreshSingleFlight(...)` and the `Promise.all` in `refreshNearExpiry`/`warmCatalogRotation` now catch, so a queue-full shed no longer logs a stack or aborts the tick
- [x] **One bad device aborted the whole warmer tick** (starving every purge job → unbounded table growth): per-device/user evaluation is now isolated with a catch
- [x] **Desktop `parse_price_from_text` broke space-grouped prices** ("R 12 345.67" → 12): the first-number-run change stopped at the space. Now keeps space/NBSP/NNBSP as grouping and strips them before separator logic (Rust test added)
- [x] **Desktop `checkRestocks` read the wrong store**: the module default resolves to IndexedDB in a Tauri webview while the UI writes localStorage, so UI-created watches were invisible. `checkRestocks` now takes an injectable storage and the desktop passes its own; `back_in_stock_watches` is now mirrored to the Rust file (tray badge + poller)

**Guards**
- [x] `product-insights` / `drop-calendar` dereferenced `product.listings` unguarded → crashed Watchlist/Stats on a legacy/corrupt row; both now `?? []`
- [x] `cheapestByRegion` used static rates while the prices beside it used live rates (wrong "cheapest region"); the converter is now injectable and both call sites pass the live one
- [x] Native OAuth sign-in never published to the shared auth state, so sync/backfill/push registration didn't start until restart; added `publishAuthUser` and called it from the callback
- [x] Reschedule storage writes were outside try/catch (unhandled rejection + stuck modal); now guarded
- [x] `getTaxRate` / `CURRENCY_SYMBOLS` prototype-key access; `best-deal` NaN `taxRate` producing a NaN landed cost; `getSupportEmail` empty-string override
- [x] Tests: `round10-guards` (7 cases, key ones verified non-vacuous), Rust space-grouping test; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `315 passed | 1 skipped` / `1865 passed`, desktop `43 passed` / `218 passed`, DB 17, Rust 21, `pnpm build` + `smoke:web` green

## Phase 241: Whole-app review round 11 (data-loss paths, wrong prices)

**Data loss (highest impact)**
- [x] **`markDirty` tombstoned unknown ids**: a mutation reporting an id not present locally (stale UI, removed on another device, double-tap after removal) created a fresh tombstone that wins LWW and **deletes the item on the other device**. Now only tombstones an id that was previously synced (verified non-vacuous)
- [x] **Edits during a sync were silently never synced**: `setChangeSuppressed(true)` dropped `notify` entirely with no replay, so a local edit made during the sync window was never marked dirty and was treated as already-synced forever (settings worse: absorbed into the merge base). Suppressed changes are now buffered and replayed on unsuppress, skipping keys the sync itself applied (verified non-vacuous)
- [x] **IDB `withStore` resolved on `req.onsuccess`, not commit**: a commit-time abort (quota/teardown) was invisible, and `setItem` had already deleted the localStorage copy → silent data loss. Writes now resolve on `tx.oncomplete` (reads still resolve on request success)
- [x] **IDB `removeItem`/`multiRemove` swallowed failures and still deleted localStorage**, so the stale IDB value resurrected on the next read (and `clearAllData` could report success while leaving data). Now only the IDB-unavailable case falls back; real failures propagate

**Wrong prices (scrapers)**
- [x] **`findPriceElement` ignored selector priority**: it merged the selector list into one query and picked by depth/document order, so `.actual-price, .price` returned the strikethrough price. It now tries each selector in order and returns the first that matches (verified non-vacuous)
- [x] **linktechs returned the old price** ($599 instead of $499) — NopCommerce renders `old-price` before `actual-price`; selector now prefers `.actual-price`
- [x] **balticnetworks included an ancestor container** (`.productitem__price`) whose first digit run is the "Original price" compare-at; dropped it
- [x] Synced both selector changes into the Rust parsers (parity test caught the drift)

- [x] Tests: `scraper-strikethrough-price`, `sync-dirty-guards` (both verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `317 passed | 1 skipped` / `1873 passed`, desktop `43 passed` / `218 passed`, DB 17, Rust 21, `pnpm build` + `smoke:web` green

## Phase 242: Fix broken scraper search URLs + blocked-marker false positives

- [x] **Six parsers used search URLs that could never return results** (verified live): `mega` (`/search?q=` → 404; real form is `/en/?SearchText=`), `rocnoc` (`/search?q=` → 404; real form is `/search.php?keywords=`, and the storefront search is JS-driven so `useBrowser` was added), `pbtech` (`?q=` → "No products found"; real param is `?sf=`), `bhphoto` (`/search?q=` → 404; real path is `/c/search?q=`), `multilink` (`?q=` returned the Doofinder JS shell; real endpoint is `/search.php?search_query=` — now parses $175 live), `neobits` (left as-is; POST-only search)
- [x] Synced all five URL changes into the Rust parsers (parity test enforces it)
- [x] **`BLOCKED_MARKERS` produced false positives**: a bare `"challenge-platform"` matches the benign Cloudflare precursor script tag, and a bare `"captcha"` matches reCAPTCHA site keys embedded in normal page config — so healthy pages (multilink: 99 model hits) were classified `blocked` and never parsed. Narrowed to the actual challenge script path (`/cdn-cgi/challenge-platform/scripts/jsd/main.js`); verified live that multilink now fetches `ok` and parses a price (verified non-vacuous)
- [x] Updated the affected parser tests + `scraper-hosts` for the new hosts/URLs
- [x] E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `317 passed | 1 skipped` / `1874 passed`, desktop `43 passed` / `218 passed`, DB 17, Rust 21, `pnpm build` + `smoke:web` green

## Phase 243: Desktop scraper parity gaps

- [x] **Browser escalation was never enabled**: every dispatch arm passed `scrape(model, false)`, so the 16 parsers mobile marks `useBrowser: true` (aerial, bhphoto, getic, gowifi, hellascom, linktechs, mbsiwav, mega, miro, multilink, nasstore, networkdevices, pbtech, rocnoc, winncom, wisp) had no JS-rendered path on desktop. Now `true` for those 16
- [x] **Browser was browser-ONLY, not browser-first**: the Rust parsers returned the browser error instead of falling back to plain HTML (mobile tries browser then plain). All 25 now fall back
- [x] **Browser pool was broken**: `Playwright::launch()` was dropped while returning its `Browser`, and `impl Drop for Playwright` SIGKILLs the driver — so the browser was disconnected on arrival. The pool now holds the driver alongside the browser. Also fixed the accounting: `in_use` counts checked-out browsers, so concurrent acquires can no longer exceed the cap (the old check compared only against the idle list, making "pool exhausted" unreachable)
- [x] **`update_listing_price` never persisted `url`**: the listing link stayed at the stale seeded URL. Now writes `scrape.url` (matches mobile's `refreshListing`)
- [x] **`infer_stock_status` missed the `"expected"` marker** ("Expected 15 Sept" → back_order on mobile, unknown on desktop); added + Rust test
- [x] **`mikrotikstore` two-hop was absent in Rust** (search page is JS-rendered and ignores the query), so it could never return a price. Ported `resolve_product_url` + the category hop + `is_product_page`, with a Rust test
- [x] **Mobile `mikrotikstore` resolver picked accessory pages**: a PSU slug embeds the model it fits, so coverage+length scoring chose the power supply. Now penalizes accessory keywords and prefers shorter slugs
- [x] **All 25 Rust stock selectors were the generic fallback**; synced each to its mobile counterpart
- [x] E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `317 passed | 1 skipped` / `1874 passed`, desktop `43 passed` / `218 passed`, DB 17, Rust 24, `pnpm build` + `smoke:web` green

## Phase 244: Test-quality fixes (vacuous tests, untested critical paths)

- [x] **`drop-calendar-dst` tested a local copy of the logic**: it defined its own `buildGridCells` and tested that, so the real component could break freely. Exported the real function and imported it (verified non-vacuous by reverting the component to the DST-buggy version)
- [x] **`adversarial` parser test passed vacuously**: each case `return`ed for any parser that couldn't parse, and only asserted `if (result !== null)`. Now asserts every parser MUST parse and pick the target card, with a documented 1-entry exception list (`getic-gr` reads the model from attributes) plus a guard that the exception list is explicit and small
- [x] **`round10-guards` conditional assertion**: the `findBestDeal` NaN check was wrapped in `if (deal)`, so a regression to `return null` passed. Now asserts non-null first
- [x] **`web-export-invariants` was 3/4 no-op in CI**: CI runs `pnpm test` before `pnpm build`, so the dist-web/dist checks returned early. Replaced with source-level invariants that always run — a scan of `app/components/lib/hooks/constants/shared` for `import.meta` (comment-stripped) plus the sw.js precache check (verified non-vacuous)
- [x] **`createUserWithPassword` had no test** despite its stated atomicity guarantee. Added `tests/create-user-transaction.test.ts` (3 DB-backed cases: creates with hash, re-hashes without nulling, no NULL-hash rows) and wired it into `pnpm test:db` (verified non-vacuous)
- [x] E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `317 passed | 2 skipped` / `1872 passed`, desktop `43 passed` / `218 passed`, DB `3 files` / `20 passed`, Rust 24, `pnpm build` + `smoke:web` green

## Phase 245: Scraper card-boundary + model-matching fixes

- [x] **A shared row container swallowed every card**: `productRowContext`/`modelMismatch` used one `closest()` list where `tr`/`li` came first, so on Aerial (whose whole results grid is one `<tr>`) every price resolved to the shared row — whose text names every model — and the first card's price won. Split into specific card selectors (preferred) and generic row selectors (fallback), in both TS and Rust. Verified non-vacuous in both
- [x] **`matchesModel` rejected whitespace-less card text**: "MikroTikCRS326-24G-2S+IN" (brand concatenated to the model, as Aerial renders it) failed the leading-boundary check. A preceding LETTER is now allowed (brand concatenation) while a preceding DIGIT still rejects ("4032CRS804", "CRS3260" vs "CRS326"). Verified non-vacuous
- [x] Tests: `scraper-card-boundary` (3 cases), `utils.test.ts` whitespace-less case, Rust `card_boundary_beats_a_shared_row`; E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `318 passed | 2 skipped` / `1876 passed`, desktop `43 passed` / `218 passed`, DB 20, Rust 25, `pnpm build` + `smoke:web` green

## Phase 246: Remaining parser fixes (neobits browser escalation)

- [x] **`neobits` could never return results**: its GET search redirects to the homepage (verified live: 622KB homepage, 0 model hits). The site's search is a JS-driven POST form, so `useBrowser: true` was added and the URL switched to the real `?search_param=all&main_search_field=` form; synced to the Rust parser + dispatch
- [x] Verified the remaining "broken" parsers are correctly classified rather than silently wrong: `gowifi`/`networkdevices` are behind an unresolvable Cloudflare challenge (browser escalation reports blocked, not a wrong price), `hellascom` is a corporate site with no catalog, `mbsiwav` returns a JS shell — all already have `useBrowser: true`
- [x] E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `318 passed | 2 skipped` / `1876 passed`, desktop `43 passed` / `218 passed`, DB 20, Rust 25, `pnpm build` + `smoke:web` green

## Phase 247: Review round 12 (IDB write shadowing, selector-priority fallout)

- [x] **`idb-adapter.setItem` silently shadowed a failed write**: it caught ALL IDB errors and fell back to localStorage, but `getItem` prefers IDB — so a real failure (quota/abort) left the stale IDB value in place and the new write appeared lost. Now only the IDB-unavailable case falls back; real failures propagate (verified non-vacuous)
- [x] **Selector-priority change fallout**: `findPriceElement` now returns the first selector that matches, so a broad `.price` listed before a specific one would win. Reordered `bhphoto` (`[data-selenium='uppedDecimalPriceFirst']` first) and `pbtech` (`.product-price` first); synced both to Rust. Audited the other 11 lists — all already put `.product-price` before `.price`
- [x] E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `318 passed | 2 skipped` / `1877 passed`, desktop `43 passed` / `218 passed`, DB 20, Rust 25, `pnpm build` + `smoke:web` green

## Phase 248: Android release build (APK + AAB, signing, App Links)

- [x] **Release APK + AAB built locally** (JDK 21 + Android SDK 36 + NDK present): `app-release.apk` 46M, `app-release.aab` 34M, package `com.app.stocktrackerpro`, versionName 5.16.0, targetSdk 36
- [x] **Release signing**: the first build was debug-signed (Play Store rejects that). Generated a 2048-bit RSA release keystore (10k-day validity) and wired `signingConfigs.release` into `build.gradle`; verified with `apksigner` (`CN=Product Stock Finder`)
- [x] **Keystore stored outside `android/`** (`credentials/`, gitignored): `expo prebuild --clean` deletes `android/` entirely, which destroyed the keystore on the first attempt. Added `scripts/android-keystore.sh` (refuses to overwrite an existing key) and `*.keystore` + `/credentials/` to `.gitignore`
- [x] **Signing config persists across prebuild**: added `plugins/with-android-release-signing.js` (config plugin) that re-injects the release signingConfig every prebuild. Caught and fixed a bug where the regex matched the DEBUG build type instead of release, silently leaving release debug-signed
- [x] **Android App Links verified live**: computed the SHA-256 fingerprint from the keystore, set `ANDROID_SHA256_CERT_FINGERPRINTS` + `ANDROID_PACKAGE` on Railway; `/.well-known/assetlinks.json` now returns 200 with the real package + fingerprint (AASA still 404 pending `APPLE_TEAM_ID`)
- [x] E2E root `tsc 0`, lint 0 errors, `pnpm build` + `smoke:web` green

## Phase 249: Android release build script (production URL baked in)

- [x] **The first APK pointed at `localhost:3000`**: `EXPO_PUBLIC_*` is inlined into the JS bundle at build time, and the local `.env` has the dev URL — so the APK could not reach the server. Verified by extracting `assets/index.android.bundle` and grepping for the URL
- [x] **Gradle caches the bundle**: rebuilding with the correct env still reused the cached bundle. `scripts/android-release.sh` now sets the production `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_WEB_URL` and deletes the generated bundle first to force a re-run
- [x] Rebuilt APK + AAB with the production URL baked in (verified by extracting the bundle from both), still release-signed (`CN=Product Stock Finder`)
- [x] Script also guards: fails fast if `credentials/keystore.properties` or `android/` is missing
- [x] E2E root `tsc 0`, lint 0 errors

## Phase 250: Device-run fixes (two launch/tab crashes)

Running the release APK on an emulator found two crashes that tsc/lint/unit tests all passed:

- [x] **App crashed on launch**: `app/_layout.tsx` guarded a web-only listener with `typeof window !== "undefined"`, but React Native sets `global.window = global` — so the check is TRUE on native while `window.addEventListener` is undefined (`TypeError: undefined is not a function` in a passive effect). Now gated on `Platform.OS !== "web"`
- [x] **Watchlist tab crashed**: `Animated.event(..., { useNativeDriver: true })` was attached to a plain `SectionList`, which throws "Components based on VirtualizedList must be wrapped with Animated.createAnimatedComponent". Wrapped it via `Animated.createAnimatedComponent(SectionList)` (with a cast preserving the generics that the wrapper drops)
- [x] Verified on the emulator: app launches, onboarding completes, Home/Watchlist/Alerts/Rates/Settings all render with live production data and zero errors
- [x] Added `tests/rn-platform-guards.test.ts` (both guards verified non-vacuous by reverting each fix)
- [x] Built an x86_64+arm64 APK for emulator testing (`-PreactNativeArchitectures=x86_64,arm64-v8a`) — the default ARM-only APK cannot install on an x86_64 emulator
- [x] E2E root `tsc 0`, lint 0 errors, root `319 passed | 2 skipped` / `1879 passed`

## Phase 251: Device QA round 2 (product detail double header)

- [x] **Product detail rendered two headers**: the screen re-enabled the native `Stack.Screen` header (`headerShown: true`) while also rendering its own absolute sticky header. On device that drew a second bar on top of it — opaque WHITE in dark mode, with the title overlapping the status bar and the back/share controls hidden. Removed the native header (root Stack already sets `headerShown: false`); the screen's own sticky header (with back/share + safe-area padding) is the single header
- [x] Verified on the emulator: Home → product detail renders cleanly (title, image placeholder, info card, Deal Score, Distributor Prices), sticky header collapses on scroll, no errors
- [x] Also confirmed working on device: onboarding, all 5 tabs, region filter chips, Alerts empty state, live production prices + FX rate
- [x] E2E root `tsc 0`, lint 0 errors, root `319 passed | 2 skipped` / `1879 passed`

## Phase 252: Device QA round 3 (Android notification channels never applied)

- [x] **Android ignored every configured notification channel**: expo-notifications reads the channel from the TRIGGER, not `content` — with `trigger: null` it logs "Couldn't get channel for the notifications" and falls back to `expo_notifications_fallback_notification_channel`. So the HIGH importance / sound / vibration set up in Phase 219 were never applied to any immediate notification (price alerts, restock, digest, health). Confirmed by reading `BaseNotificationBuilder.kt` and by the device log
- [x] Added `immediateTrigger(kind)` which returns a 1-second `TIME_INTERVAL` trigger carrying `channelId` on Android (still fires immediately) and applied it to all 8 immediate sites; also moved `channelId` onto the DATE trigger for back-order reminders (same bug); removed the now-ignored `content.channelId` spreads
- [x] Verified on device: the warning is gone and `dumpsys notification` shows `price-alerts` (importance 4/HIGH, vibration), `stock-alerts` (4/HIGH), `digest` (3/DEFAULT) all created with the configured settings
- [x] Also verified on device this round: Add Product search (typing "CRS804" → 2 results), product detail scroll (sticky header collapse, "Set Alert at £426.55 (−5%)" — the Phase 215 fix), Best Deal with shipping/tax, multi-currency distributor rows (AUD/ZAR with live conversion), Price Alert creation + notification, Back-order Reminder
- [x] Added `tests/android-channel-trigger.test.ts` (verified non-vacuous); E2E root `tsc 0`, lint 0 errors, root `320 passed | 2 skipped` / `1882 passed`

## Phase 253: Device QA round 4 (trending card always "Product not found")

- [x] **Tapping a Trending card opened a broken product detail**: the card body pushed `/product/<id>`, but product detail resolves products from the local watchlist and trending products come from the server — so every card tap showed "Product not found". The Add button worked (it adds first), which is why this slipped through. Now the card body adds the product via the same `ensureWatchlistProduct` helper before navigating (mirrors `discoverProduct` in `app/search.tsx`); a product with no catalog entry still shows the existing "Not yet available" toast instead of navigating
- [x] Fixed the same bug on desktop (`desktop/src/components/TrendingSection.tsx`): the `<Link>` now calls `preventDefault` and adds-then-navigates via `useNavigate`
- [x] Verified on device (x86_64+arm64 release APK): tapping NVIDIA RTX 5090 opens a real detail screen and the card flips to "In Watchlist"; tapping NVIDIA DGX Spark (no catalog entry) shows "Not yet available" and does not navigate
- [x] Added `tests/trending-card-navigation.test.ts` + `desktop/tests/trending-card-navigation.test.tsx` (both verified non-vacuous by reverting each fix); E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `321 passed | 2 skipped` / `1884 passed`, desktop `44 passed` / `219 passed`

## Phase 254: Device QA round 5 (Share watchlist raw auth error + misleading platform message)

- [x] **"Share watchlist" in Settings showed a raw server error when signed out**: the button called `sharedWatchlists.create` (a sign-in-only endpoint) unconditionally, so a signed-out tap surfaced `Please login (10001)` with no way forward. It now checks `isAuthenticated` first and offers a "Sign in to share" dialog (Not now / Sign in → opens the login modal). The desktop Settings screen already guarded on auth — mobile was the outlier
- [x] **Health probe reported "browser escalation unavailable on web" on Android**: the native app resolves the `browser.web.ts` stub (Playwright is node-only), so the message was wrong on native. Reworded to "browser escalation unavailable on this platform"
- [x] Verified on device (x86_64+arm64 release APK): signed-out Share watchlist shows the "Sign in to share" dialog and "Sign in" opens the login modal; Health Dashboard renders live status (working/blocked/error filters), "Test All Distributors" completes all 25 with per-distributor latency, and the drill-down shows samples/uptime
- [x] Added `tests/settings-share-auth-guard.test.ts` (verified non-vacuous); E2E root `tsc 0`, desktop `tsc 0`, lint 0 errors, root `322 passed | 2 skipped` / `1886 passed`, desktop `44 passed` / `219 passed`

## Phase 255: Device QA round 6 (URL product parse truncated MikroTik '+' models)

- [x] **Pasting a distributor URL dropped the `+` segments from the model number**: `parseFromHtml` extracted the model with `[A-Za-z0-9._-]`, which excludes `+` — so `CRS326-24S+2Q+RM` became `CRS326-24S`. That partial model then fails distributor matching (the parsers gate on `modelMismatch`), so the product was added with "No distributor had it yet". Added `+` to both the title and URL model patterns
- [x] Verified against the live page: `parseProductText("https://mikrotik.com/product/crs326_24s_2q_rm")` now returns `modelNumber: "CRS326-24S+2Q+RM"` (was `CRS326-24S`)
- [x] Also verified on device this round: Add Product screen (category/brand/sort filters), Add Custom Product sheet, AI cleanup graceful fallback when the server LLM is unconfigured ("Couldn't reach the AI — please fill in the details manually"), URL fetch prefill, "Add & Search Distributors" progress + result, Health Dashboard "Test All Distributors" (all 25) + drill-down samples
- [x] Added `tests/product-parse-url-model.test.ts` (verified non-vacuous); E2E root `tsc 0`, lint 0 errors, root `323 passed | 2 skipped` / `1888 passed`

## Phase 256: Fix background price-check hang (Android frozen timers)

- [x] **The background price-check task hung while backgrounded**: every JS `setTimeout` freezes on Android (bridgeless/new-arch) while the app is backgrounded — `TimerManager` registers all timers (including 0ms) with `JavaTimerManager`, which fires only from the choreographer frame callback gated on `isPaused`; expo's background-task worker only emits a JS event and never starts a headless JS task (the thing that would unpause timers). Verified on device: the task body started, then froze at its first timer-based await (tRPC 4s race / rate-limit sleep) until foregrounding
- [x] Added `lib/background-safe-timers.ts` (`backgroundSafeDelay`, `backgroundSafeRace`, `setBackgroundAppState`) — RN-free (the server bundle imports `resilient.ts`); foreground uses plain `setTimeout`, backgrounded uses a setImmediate (microtask-backed) poll chain
- [x] **Microtask chains only run in bounded bursts** while backgrounded (Hermes drain cap × RuntimeScheduler's 255-retry bound), so the robust fix is native: added `lib/background-fetch.ts` — XHR-based fetch whose `timeout` is enforced by OkHttp `callTimeout` and delivered as a native event (works while backgrounded). Rate-limit sleeps are skipped entirely in the background path (politeness is moot inside the 25s budget; the breaker store still prevents stampedes)
- [x] **tRPC's batch loader dispatches via `setTimeout`** (`@trpc/client` dataLoader) — frozen while backgrounded, so the query never even fired. `lib/server-prices.ts` now bypasses the client in the background path and hits `/api/trpc/prices.get` directly with the superjson batch format via `backgroundFetch`; `lib/trpc.ts`'s custom fetch also enforces the deadline natively when backgrounded
- [x] Wired `setBackgroundAppState` from `AppState` in `app/_layout.tsx` (Android only; iOS keeps timers alive natively via `RCTTiming` sleep-timers)
- [x] Verified on device (x86_64+arm64 release APK, app backgrounded, job force-run): `price-drop-check` completed in 21s (within the 25s budget) and `health-probe` completed all 25 distributors, both with live network activity while backgrounded
- [x] Added `tests/background-safe-timers.test.ts` (harness simulating Android's frozen-timer contract); E2E root `tsc 0`, lint 0 errors, root `324 passed | 2 skipped` / `1896 passed`

## Phase 257: Tighten background timeouts (budget headroom)

- [x] The background task took 21s of its 25s budget with an unreachable server (8s native tRPC timeout per listing + 15s scrape timeout) — larger watchlists would overflow the WorkManager window. Tightened: `BACKGROUND_TRPC_TIMEOUT_MS` 8s→4s in `lib/trpc.ts`, and the backgrounded scrape timeout capped at 10s in `fetchPlain` (`Math.min(timeoutMs, 10_000)`)
- [x] Verified on device (backgrounded, job force-run): `price-drop-check` finished well under budget, `health-probe` 9s later — both complete while backgrounded
- [x] E2E root `tsc 0`, lint 0 errors, root `324 passed | 2 skipped` / `1896 passed`

## Phase 258: Device QA round 8 (Compare/Stats/Alerts + sparkline tap + Watchlist scroll)

- [x] **Compare screen PASS**: multi-line chart renders 3 distributor lines with legend, 1W/1M/3M/6M/1Y/All filters re-render correctly (1W rescaled to Sep 14–22), Cheapest by Region card (BEST Europe €956.00 Back Order), Current Prices table
- [x] **Stats screen PASS**: all cards render — Digest off empty state, Biggest Movers (Top Drops/Gainers, 7D/30D/All), movers summary with all-time-low medals, Drop Calendar heatmap (50 drops), Basket Value $8,500.99, Stock Health 31%, Data Freshness
- [x] **Alerts tabs PASS**: Alerts/Reminders empty states render; Notifications tab shows the health-probe's "Distributor Down" event (1 unread)
- [x] **Sparkline taps were dead on Android**: react-native-svg's `Svg` swallows touches (its touch handler returns true), blocking the parent "Open price chart" Pressable; the wrapper's `accessible`+`role=image` also intercepted. Fixed: `pointerEvents="none"` on the Svg + new `interactive` prop on `PriceSparkline` that drops the a11y boundary when embedded in a button. Verified: tap fires and navigates to Compare
- [x] **Watchlist list couldn't scroll on device**: the header content (offline banner, summary card, search, sort/group bar, region chips, price row, tag row) rendered as flex siblings of the SectionList, squeezing it into a ~240px strip at the screen bottom — swipes above it hit nothing. Fixed by moving all header content into the list's `ListHeaderComponent` (scrolls away with content) and dropping the now-unused `Animated.createAnimatedComponent(SectionList)` wrapper + `onScroll` Animated.event. Verified: full-height scrolling list, header intact when scrolled back up
- [x] E2E root `tsc 0`, lint 0 errors (169 pre-existing warnings), root `324 passed | 2 skipped` / `1896 passed`

## Phase 259: Foreground tRPC fetch timeout

- [x] The foreground tRPC fetch had no deadline: with the server unreachable, "Refresh all" pinned its spinner indefinitely (fetch hangs until the OS TCP timeout — minutes), the sync queue never flushed, and per-listing live-price queries dangled. Added a 15s `AbortController` deadline to the foreground fetch in `lib/trpc.ts` (the backgrounded path already enforced 4s natively)
- [x] Device-verified offline: the refresh cycle now completes in bounded time (~15s × React Query retries with backoff) instead of hanging forever; spinners clear
- [x] E2E root `tsc 0`, lint 0 errors (169 pre-existing warnings), root `324 passed | 2 skipped` / `1896 passed`

## Phase 260: Android cleartext traffic for dev backends

- [x] **Every fetch silently failed in Android release builds against a dev backend**: dev backends run over plain HTTP (`http://localhost:3000` via adb reverse, `http://10.0.2.2:3000` on the emulator) and Android 9+ blocks cleartext by default — the app showed "Backend unreachable" with no error surfaced anywhere. Added `plugins/with-android-cleartext-traffic.js`, which sets `android:usesCleartextTraffic="true"` on the `<application>` node. `android/` is gitignored, so a hand-edit to `AndroidManifest.xml` is lost on the next `expo prebuild --clean`; the plugin re-applies it every prebuild (mirrors `with-android-release-signing`). Production uses HTTPS, so this only relaxes dev
- [x] Added `tests/android-cleartext-traffic.test.ts` (verified non-vacuous by reverting the attribute assignment); E2E root `tsc 0`, lint 0 errors (164 warnings), root `325 passed | 2 skipped` / `1900 passed`

## Phase 261: Device QA round 9 (Settings + Rates)

- [x] **Settings screen PASS** (x86_64+arm64 release APK, dev backend): Connection (Signed out / Check Now / Last checked), Account (Sign in to sync, Google + Apple, Sync status), Data, Notifications, Display, Shipping Region, Check Interval, Scraper Status, AI/LLM, Collaborative Watchlist and About all render
- [x] Display Currency picker (EUR), Shipping Region picker (Europe) and Check Interval (Once a day) all persist their selection; blocked-distributor "Re-enable" flips ⚠️ → ✅ and stamps today's date
- [x] Data section exercised end-to-end: Export Backup produces `product-stock-finder-backup-<date>.json` via the share sheet; Export CSV produces `product-stock-finder-watchlist-<date>.csv`; Import Backup opens the document picker and rejects a non-backup file with "Invalid Backup" (no data touched)
- [x] About section: Privacy Policy opens the browser, Contact Support opens a mailto intent, Delete My Data shows the destructive confirm dialog (cancelled — no data deleted), Rate the App renders
- [x] LoginModal: Forgot password? switches to the "Reset password" view (the round-8 "tap did nothing" was a tap miss, not a defect); empty submit surfaces "Email is required"; Back to sign in returns to the login view
- [x] **Rates screen PASS**: all 12 currencies render with sparklines and % changes (GBP 0.7477/USD ⇒ 1 GBP = 1.3374 USD, cross-checked against the static table); 1W filter selects
- [x] No bugs found this round — no code changes; E2E root `tsc 0`, lint 0 errors, root `325 passed | 2 skipped` / `1900 passed`

## Phase 262: Device QA round 10 (Home + Health — suspension-poisoned response times)

- [x] **Home screen PASS**: header + Signed out chip, stat cards (Tracked 8 / In Stock 5 / Alerts 0), Recent Activity (5 cards with status chips + relative times), Trending Now (Add / In Watchlist states), Your Watchlist preview + "View all 8 products" → Watchlist; the `+` button opens Add Product
- [x] **Health Dashboard PASS**: filters (All 25 / working 9 / blocked 9 / error 7) filter correctly, per-distributor rows show status dot, reason, latency, uptime % and sparkline, "Test All Distributors" runs, drill-down renders the timeline strip + day-grouped samples
- [x] **Health response times were poisoned by app suspension**: `testAllDistributors` timed each probe with `Date.now() - start`, which spans the Android background freeze (see Phase 256) — so a scheduled probe that straddled a suspension recorded the suspension duration as latency. On device Server2U showed samples of `297437ms`, `1321585ms`, `1493263ms` and an "avg response 225131ms" (3.75 minutes) while every real sample was 2–5s
- [x] Added `sanitizeResponseTimeMs` + `MAX_RESPONSE_TIME_MS` (60s) in `lib/scrapers/health.ts`: the probe drops implausible durations at record time, `computeHealthSummary` ignores already-stored poisoned samples when averaging, and both health screens hide the bogus `ms` suffix on legacy samples
- [x] Verified on device (x86_64+arm64 release APK): Server2U's avg response is now `3595ms` (was `225131ms`) and the three poisoned rows render without a latency suffix
- [x] Added 6 tests to `tests/scrapers/health.test.ts` (all verified non-vacuous by reverting each fix); E2E root `tsc 0`, lint 0 errors (164 warnings), root `325 passed | 2 skipped` / `1906 passed`

## Phase 263: Device QA round 11 (editing flows — hitSlop overlap, dead product edit, digest vanish)

- [x] **Alert editing PASS**: created an alert for "Valve Steam Deck OLED" from the quick-set button ("Alert created — you'll be notified below $616.55"); the card renders product, distributor, target, toggle, pencil, moon and trash actions
- [x] **Snooze PASS**: the moon action shows "1 DAY / 7 DAYS / MORE…", snoozing dims the card and drops the active count 1→0
- [x] **Alert edit-save PASS**: the pencil opens `PriceAlertModal` prefilled; switching the currency to EUR saves ("Alert Updated"), re-targets €616.55 and re-activates the alert (clearing the snooze)
- [x] **Stacked alert-card actions were untappable**: `hitSlop={44}` is measured in dp, so at 420dpi it expands ~115px — far past the 8dp gap between the stacked edit/snooze/delete buttons, so the last-rendered button owned the whole column. Verified on device: tapping Edit's centre opened Snooze (Edit `[890,834][985,930]`, Snooze `[890,952][985,1049]`, Delete `[890,1069][985,1165]` — only a 3px sliver reached Edit)
- [x] Added `components/ui/icon-action-button.tsx` (`IconActionButton`, a real 44×44 target with no `hitSlop`) and switched `alert-card`, `triggered-alert-card`, `stock-watch-card` and `reminder-card` to it (also dropping the oversized `hitSlop` on Watch Again). Verified on device: Edit `[869,834][985,949]`, Snooze `[869,971][985,1087]`; tapping Edit's centre now opens Edit Alert while Snooze and Delete still work
- [x] **Product editing was dead code on mobile**: `EditProductSheet` was fully implemented but never imported or rendered anywhere, so product editing was unreachable (the desktop `ProductDetail` already wires it up). Wired it into `app/product/[id].tsx` with a pencil affordance in the sticky header and an `onSaved` callback that refreshes the screen (the hook loads once and doesn't subscribe to storage)
- [x] Verified on device end-to-end: the pencil opens the sheet pre-filled (USD / Drops below / Steam / 616.55), renaming to "Valve Steam DecQA" saves and updates the header live, then restored to "Valve Steam Deck OLED"
- [x] **Basket Value Alert PASS**: the bell opens the sheet, entering 7000 and enabling shows "Alert below €7,000.00"; reopening prefills 7000 with Disable/Enable; Disable clears the alert
- [x] **Digest card vanished once enabled**: `digest` needs a snapshot, but no snapshot exists until the first digest is actually delivered, and the placeholder only covered the `off` case — so toggling Off → Daily/Weekly removed the whole card with no feedback. Replaced `showDigestPlaceholder` with a `digestPlaceholder` union (`"off" | "pending"`) that renders "Digest scheduled / Your first digest will appear here once it's sent." in the pre-snapshot window. Verified on device: the placeholder now renders instead of a blank gap
- [x] Added `tests/alert-card-touch-targets.test.ts` (14 tests: touch targets, product-edit wiring, digest placeholder) — all verified non-vacuous by reverting each fix; E2E root `tsc 0`, lint 0 errors (164 warnings), root `326 passed | 2 skipped` / `1920 passed`

## Phase 264: Device QA round 12 (auth/legal routes — privacy URL unreachable behind onboarding)

- [x] **Export CSV PASS**: the Settings Data row produces `product-stock-finder-watchlist-<date>.csv` via the share sheet
- [x] **Restock Watches PASS**: created a watch on "Valve Steam Deck OLED" from the product-detail "Watch for Restock" button (button flips to "Watching for Restock"), the watch appears under Alerts → Restock Watches with the correct "Back Order" status, and Remove shows the confirm dialog then returns to the empty state
- [x] **verify-email PASS**: `productstockfinder://verify-email` (no token) shows "Missing verification token…"; `?token=invalidtoken123` round-trips to the server and shows "Invalid or expired token"
- [x] **reset-password PASS**: `productstockfinder://reset-password?token=abc123` renders; empty submit → "Please fill in both password fields."; short password → "Password must be at least 6 characters."
- [x] **Forgot password PASS**: Settings → Sign in → Forgot password? opens the "Reset password" view; empty submit → "Email is required"; a valid address shows the enumeration-safe "If an account exists for <email>, a reset email has been sent. Check your inbox."
- [x] **Privacy Policy was unreachable for every first-time visitor**: `app/_layout.tsx` rendered the onboarding carousel for *all* routes until the tour was completed, so opening the store-required `/privacy` URL (and the emailed verify/reset deep links) in a fresh browser showed "Track Prices Everywhere" instead of the policy — verified on device in a cleared Chrome profile. Added `isPublicRoute` + `PUBLIC_ROUTES` (`/privacy`, `/verify-email`, `/reset-password`, `/reset`, `/oauth/callback`, `/w/*`) in `lib/onboarding.ts` and gated the spinner/tour branches on `!isPublic`, using `usePathname()` so the bypass is synchronous on first render and also covers in-app deep links
- [x] Verified on device (rebuilt `dist-web`, cleared Chrome): `/privacy` now renders the policy directly; `/` and `/stats` still show the tour; `/verify-email`, `/reset-password?token=abc` and `/w/abc123` render their own screens
- [x] **Shared-watchlist error repeated its own heading**: the server's NOT_FOUND message is literally "Share not found", so the screen printed "Share not found" as both heading and subtitle. Now substitutes "This link may have expired, been revoked, or never existed." when the message only repeats the title
- [x] Added 6 `isPublicRoute` cases + 2 layout-wiring guards to `tests/onboarding.test.ts` (now 20) and a shared-watchlist subtitle guard to `tests/mobile-criticals.test.ts` (now 2) — all verified non-vacuous by reverting each fix; E2E root `tsc 0`, lint 0 errors (164 warnings), root `326 passed | 2 skipped` / `1936 passed`

## Phase 265: Device QA round 13 (search/tag flow — silent export, tag picker Done behind keyboard)

- [x] **Distributor Analysis export was silent**: `app/distributor-analysis.tsx` `handleExport` swallowed every outcome in a bare `catch`, so tapping Export on web (where `navigator.share` is unavailable) did nothing visible. Now imports `showAlert` from `@/lib/alert` and surfaces "Copied" / "Share unavailable" / "Nothing to export" / "Export failed", matching `stats.tsx`, `watchlist.tsx`, `product/[id].tsx` and `compare/[id].tsx`. Verified on device/web via Playwright against the rebuilt `dist-web` (dialog `Share unavailable — Sharing isn't supported in this browser.`)
- [x] **Tag picker "Done" was unreachable behind the keyboard**: after creating a tag the "New tag name" input keeps focus, so the IME covers Done (bounds `[63,2233][1017,2336]`). `KeyboardAvoidingView` is a no-op inside the Android `Modal` Dialog window under edge-to-edge (`app.config.ts` `edgeToEdgeEnabled: true`), so the only escape was hardware Back — which fires `onRequestClose={onClose}` WITHOUT `onApply`, silently discarding the tag selection (verified: tag created but not applied, `QA · 0`)
- [x] `components/tag-picker-sheet.tsx` now tracks the keyboard itself: `Keyboard.addListener("keyboardDidShow"/"keyboardDidHide")` (guarded by `if (!visible) return`, with `.remove()` cleanup) sets `keyboardHeight`, and the backdrop view is padded via `paddingBottom: keyboardHeight` (a `KeyboardAvoidingView` wrapper is a no-op inside the Android `Modal` Dialog window under edge-to-edge)
- [x] Verified on device end-to-end: with the keyboard open after typing a new tag, Done now sits above the IME (bounds `[63,1414][1017,1517]`); tapping it closes the sheet and commits the selection — the new "QA4" tag was applied to AMD Radeon RX 7900 XTX and "QA5" to Nintendo Switch 2 (Watchlist filter row shows `QA4 · 1` / `QA5 · 1`)
- [x] Added `tests/tag-picker-sheet.test.ts` (2 tests: keyboard listeners + Done→`onApply`) and a source-level export-feedback guard in `tests/distributor-analysis.test.ts` (now 8) — both verified non-vacuous by reverting each fix; E2E root `tsc 0`, lint 0 errors (164 warnings), root `327 passed | 2 skipped` / `1940 passed`

## Phase 266: Device QA round 14 (Stats + Compare — dead ActionButtons, leftover QA logs)

- [x] **Statistics PASS**: all 7 cards render (Digest off placeholder, Biggest Movers with 7D/30D/All + Top Drops/Gainers, Product Insights, 30-day drop calendar, Basket Value €7,410.04 "7 products · 5 excluded (no stock)", Stock Health 31%/0/1, Data Freshness avg 12.3 pts/listing). The "4 At all-time low" count vs 3 listed names is intentional (`insights-card.tsx` `slice(0, 3)`), not a defect
- [x] **Compare Prices PASS**: reached from the product-detail sparkline; 3M/1W filters re-scale the chart (1W → Sep 14–22), Cheapest by Region, Current Prices and the Select Distributors list (3/5 → 4/5 on tapping DuxTel, which then appears in Current Prices) all behave
- [x] **Leftover `[QA]` debug logs shipped in app code**: `app/product/[id].tsx` logged `[QA] push compare` on every chart open and `components/product/distributor-listing-card.tsx` logged `[QA] sparkline tap fired` on every sparkline tap — both left over from the Phase 258 QA round. Removed
- [x] **`components/product/action-buttons.tsx` was dead code**: 257 lines never rendered since the Phase 258 product-detail refactor (only re-exported by `app/product/_components.tsx`), yet still bundled into the web export. Its unique actions (Copy Link, Test Stock Alert, manual Refresh) were silently dropped by the refactor; Compare/Share/Set Alert remain reachable via the section components. Deleted the file and its barrel re-export
- [x] Added a `[QA]`-log sweep to `tests/silent-failures.test.ts` (now 5) and a "dead ActionButtons stays removed" guard to `tests/alert-card-touch-targets.test.ts` (now 16) — both verified non-vacuous by reverting each fix; E2E root `tsc 0`, lint 0 errors (164 warnings), root `327 passed | 2 skipped` / `1943 passed`

## Phase 267: Device QA round 15 (Watchlist — tag rename swallowed by keyboard)

- [x] **Watchlist PASS**: sort menu (7 modes; "Best deals" reorders with Raspberry Pi first), Tag grouping ("HIGH PRIORITY · 2"), Status grouping ("IN STOCK · 5"), region filter, swipe-to-Remove, per-card Edit tags / Delete product, and the Manage Tags sheet (rename, delete, colour swatches) all render and behave. The summary breakdown (8 in stock + 4 back order + 2 out of stock = 14) intentionally excludes the 12 "unknown" listings out of 26 — not a defect
- [x] **Tag rename silently did nothing on the first tap**: the Manage Tags rename input keeps the keyboard open, and the sheet's `ScrollView` had no `keyboardShouldPersistTaps`, so the first tap on the Confirm (✓) button was consumed dismissing the keyboard — the row stayed in edit mode and the name reverted on reopen. Verified on device: one tap left "High PriorityX" unchanged, a second tap committed it
- [x] Added `keyboardShouldPersistTaps="handled"` to the `ScrollView` in `tag-manage-sheet.tsx` (and, same bug class, to `tag-picker-sheet.tsx` and `bulk-tag-sheet.tsx`, whose tappable rows are likewise swallowed while their text input holds focus)
- [x] Verified on device (rebuilt x86_64+arm64 release APK): a single tap on ✓ now exits edit mode and the rename persists across close/reopen and into the filter row ("High Priority · 2")
- [x] Added 3 cases to `tests/tag-picker-sheet.test.ts` (now 6: all three sheets set `keyboardShouldPersistTaps`, Confirm wired to `handleRename`) — verified non-vacuous by reverting each fix; E2E root `tsc 0`, lint 0 errors (164 warnings), root `327 passed | 2 skipped` / `1947 passed`

## Phase 268: Device QA round 16 (Search — filter chrome squeezed the results list)

- [x] **Alerts screen PASS**: triggered-alert history renders, the Notifications tab lists events, "Mark all read" clears the unread dots to "All caught up", the Reminders tab shows its empty state, and the `+` FAB opens Add Product with a "Recent" chip
- [x] **Search results were squeezed into a ~324px strip**: `app/search.tsx` rendered the tag chips, the Category and Brand pill rows and the sort bar as fixed flex siblings above the results `FlatList`. On a 1080x2400 device that chrome consumed ~2076px, so the list viewport was `[0,2076][1080,2400]` — searching "rtx" showed "25 RESULTS" with only a sliver of the first card, and searching "zzzzqqq" rendered the empty state below the fold (verified on device via `uiautomator dump`)
- [x] Moved all filter chrome into the `FlatList`'s `ListHeaderComponent` and gave the list `style={{ flex: 1 }}`, matching the watchlist screen's QA-round-8 fix (`app/(tabs)/watchlist.tsx:77-79`); per-item horizontal padding moved onto the row wrappers since the list no longer carries `paddingHorizontal`
- [x] Verified on device (rebuilt x86_64+arm64 release APK): the chrome now scrolls away and the results fill the screen (RTX 5090/4090/APC SRT3000XLI/7900 XTX/MCX653106A-ECAT/UDG4-PRO all visible), the "zzzzqqq" empty state renders fully ("No results for \"zzzzqqq\"" + hint + Discover with AI), and the no-query "ALL PRODUCTS" view with the Recent chip still works
- [x] Added 3 cases to `tests/mobile-criticals.test.ts` (now 5: FlatList `flex:1`, chrome inside `ListHeaderComponent`, no chrome as fixed siblings) — verified non-vacuous by reverting the `flex:1` and by re-adding a sibling `TagFilterRow`; E2E root `tsc 0`, lint 0 errors, root `328 passed | 2 skipped` / `1950 passed`

## Phase 269: Device QA round 17 (Product Detail — three features silently dropped by the 2026-08-28 refactor)

- [x] **Product Detail regression found**: the `7b4b7e3` "product detail orchestration" refactor was meant to be a pure extraction (its spec says `[id].tsx (unchanged)` and "no logic changes"), but it dropped three render sites while still barrel-exporting the components. Private notes (Phase 90) and the Distributor Targets table (Phase 93) vanished from mobile while desktop kept both; the per-distributor price-history modal (and its CSV export) also vanished
- [x] Restored `<NotesCard productId={product.id} />` and `<TargetTableCard listings={visibleListings} alerts={alerts} productId={product.id} onSetTarget={handleSetTarget} />` in `app/product/[id].tsx`, plus the `alerts` state + `getAlerts()` load, `handleSetTarget`, `handleSetAlert`, `alertSuggestions`, `alertDistributors` and the shared `<PriceAlertModal>` (all pulled from the pre-refactor source at `7b4b7e3^`). Notes/targets sit outside the `shareRef` capture since they are device-private/personal
- [x] **CSV export moved to Compare rather than restoring the modal**: `172def2` had deliberately repointed the sparkline from the modal to `/compare/${id}`, so restoring the modal would have stranded Compare. `app/compare/[id].tsx` now has an export button in its sticky header that writes every listing's history via `priceHistoryToCsv` + the new shared `lib/csv-export.ts` (extracted from `components/settings/data-section.tsx` so both callers share one implementation)
- [x] Deleted the now-unreachable `components/product/price-chart-modal.tsx` and its barrel re-export, plus the orphaned `components/price-history-chart.tsx` (the modal was its only consumer; Compare's `MultiLineChart` is the mobile chart surface now)
- [x] Verified on device (rebuilt x86_64+arm64 release APK): "My Note" renders and a note ("QA17-note-test") saves and persists; "Distributor Targets" lists all 9 distributors with per-row `+`; tapping `+` opens the shared PriceAlertModal pre-scoped to that distributor (`selected="true"` on NAS Store EU); Compare's sticky header shows the download icon and tapping it opens the native share sheet (CSV written + `Sharing.shareAsync`)
- [x] Added 6 cases to `tests/mobile-criticals.test.ts` (now 11: NotesCard/TargetTableCard render sites, scoped-alert wiring, notes/targets outside the share capture, Compare CSV export, deleted modal + orphaned chart) and `tests/csv-export.test.ts` (2 tests for the shared helper) — all verified non-vacuous by reverting each fix; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1958 passed`

## Phase 270: Device QA round 18 (Shared Watchlist — "Add all" overstated duplicate adds)

- [x] **Shared Watchlist PASS**: a real share token renders the title, "2 products", "Last shared"/"Expires (30d TTL)" meta, per-product cards with best price, distributor rows + stock badges, and per-product "Export History (CSV)"; "Export CSV" and "Add all to Watchlist" both work
- [x] **"Add all to Watchlist" claimed to add products that were already tracked**: `addToWatchlist` silently no-ops on a duplicate (`lib/storage/watchlist.ts` `if (!exists)`), but `app/w/[token].tsx` counted every non-throwing call as an add. Tapping "Add all" twice on an already-imported share reported "Added 2 products" while the watchlist stayed at 14 (verified on device: 12 → 14 after the first tap, still 14 after the second)
- [x] `addToWatchlist` now returns `boolean` (true = inserted, false = already present) and the shared-watchlist screen branches on it: a second tap shows "Already on your watchlist — All 2 shared products are already tracked", a mixed batch shows "Added 1. Skipped 2 (2 already tracked, 0 invalid)"
- [x] Same overstatement fixed in the two other aggregate callers: the watchlist CSV import (`app/(tabs)/watchlist.tsx` — now reports "N already tracked") and the desktop parity screen (`desktop/src/pages/SharedWatchlist.tsx`, whose per-product Add button now says "is already on your watchlist" instead of "Couldn't add")
- [x] Verified on device (rebuilt x86_64+arm64 release APK): re-tapping "Add all" on the imported share shows the duplicate message, and adding a genuinely new product to the share then tapping "Add all" shows "Partially added — Added 1. Skipped 2 (2 already tracked, 0 invalid)."
- [x] Added a `addToWatchlist` return-value case to `tests/storage.test.ts` (now 69) and a shared-watchlist duplicate-count guard to `tests/mobile-criticals.test.ts` (now 12) — both verified non-vacuous by reverting each fix; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1960 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 271: Device QA round 19 (Shared Watchlist — silent 500-product truncation)

- [x] **Shared Watchlist truncation was silent**: the server caps the public share payload at `SHARED_WATCHLIST_MAX_ITEMS = 500` and returns `truncated: true` (`server/routers.ts`), but neither the mobile screen nor the desktop parity page read the flag — a >500-product share rendered "500 products" and looked like a complete (but short) watchlist. Verified on device with a 520-product share: the page showed "500 products" with no hint that 20 were missing
- [x] `app/w/[token].tsx` now reads `truncated` and renders "500 products (first 500)" plus a warning line ("This share is larger than the 500-product limit — only the first 500 are shown."); `desktop/src/pages/SharedWatchlist.tsx` mirrors it
- [x] Verified on device (rebuilt x86_64+arm64 release APK): the 520-product share now shows "500 products (first 500)" and the amber warning banner
- [x] Added a truncation-notice guard to `tests/mobile-criticals.test.ts` (now 13) — verified non-vacuous by removing the notice; the server-side flag already has coverage in `tests/shared-watchlists.test.ts` ("caps the returned products and flags truncation"); E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1961 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 272: Device QA round 20 (Shared Watchlist — exactly-500 share falsely flagged truncated)

- [x] **Off-by-one in the truncation flag**: `sharedWatchlists.get` used `.limit(SHARED_WATCHLIST_MAX_ITEMS)` and then `truncated: items.length >= SHARED_WATCHLIST_MAX_ITEMS`, so a share with *exactly* 500 products was reported as truncated even though nothing was dropped. With Phase 271 now surfacing the flag, that would have shown a false "only the first 500 are shown" warning on a complete share
- [x] The router now fetches `SHARED_WATCHLIST_MAX_ITEMS + 1` rows, sets `truncated = items.length > MAX`, and slices the extra row off before mapping — so exactly-500 is complete and 501+ is truncated
- [x] Verified against the live server (rebuilt `dist/`, restarted): a 500-product share returns `truncated: false` with 500 products, a 501-product share returns `truncated: true` with 500 products
- [x] Added a boundary case to `tests/shared-watchlists.test.ts` (now 10: "does not flag an exactly-500-product share as truncated") — verified non-vacuous by reverting to `>=` + `.limit(MAX)`; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1962 passed`

## Phase 273: Device QA round 21 (hardcoded plurals — "1 products" / "1 alerts")

- [x] **Shared Watchlist said "1 products"**: the header hardcoded the plural (`{products.length} products`), so a single-product share rendered "1 products" (verified on web via Playwright against the rebuilt `dist-web`). The desktop parity page already pluralized correctly
- [x] Fixed the shared-watchlist header and swept the same hardcoded-plural class across the other count displays that can render with a count of 1: Home "View all N products", Alerts header "N alerts" / "N reminders", the Stats Basket Value card "N products", and the branded `StatsShareCard` "N products"; mirrored the desktop Stats basket line for parity
- [x] Verified on web (rebuilt `dist-web`): the single-product share now renders "1 product"
- [x] Added a pluralization guard to `tests/mobile-criticals.test.ts` (now 14) — verified non-vacuous by reverting to the hardcoded "products"; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1963 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 274: Device QA round 22 (plural sweep — remaining count labels)

- [x] Follow-up to Phase 273: swept the remaining count labels that hardcoded the plural and can render with a count of 1 — Stock Health "N listings", the health drill-down "N samples" (summary + per-day group), the sparkline accessibility label "N points", and the bulk-import accessibility label "N products"
- [x] Mirrored the desktop parity fixes: Stats "N listings", HealthDetail "N samples" (summary + per-day group), Home "View all N products" aria-label, Watchlist sparkline aria-label "N points"
- [x] Added a 5-case "count labels pluralize" guard to `tests/mobile-criticals.test.ts` (now 19) — verified non-vacuous by reverting the Stock Health and sparkline labels; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1968 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 275: Device QA round 23 (Shared Watchlist — silent CSV export)

- [x] **Shared Watchlist exports were silent and hand-rolled**: both `handleExportDetailedCsv` and `handleExportHistoryCsv` in `app/w/[token].tsx` duplicated the web blob-download / native `Share.share` logic inline, with no try/catch and no success/failure feedback — a failed export did nothing visible, and native `Share.share` rejects on some platforms. Every other export in the app goes through the shared `lib/csv-export.ts` helper and reports the outcome
- [x] Both handlers now call `exportCsvFile` (web download / native cache-write + share sheet) and surface "Exported" / "Export unavailable" via `showAlert`, matching Compare/Settings; the now-unused `Share` import was dropped
- [x] Verified on web (rebuilt `dist-web`, real share token): "Export CSV" downloads `shared-<token>.csv` and shows the "Exported — The shared watchlist CSV has been created." dialog
- [x] Added an export-helper guard to `tests/mobile-criticals.test.ts` (now 20: uses `exportCsvFile`, no `Share.share`, reports "Export unavailable") — verified non-vacuous by reverting both handlers to the bare `Share.share` form; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1969 passed`

## Phase 276: Device QA round 24 (orphaned components — dead source cleanup)

- [x] Three components were left orphaned by earlier refactors and shipped as unreachable dead source (Metro tree-shakes them, but they lingered in the repo): `components/product/distributor-row.tsx` (never rendered by any commit), `components/themed-view.tsx` (its last consumer was the dev theme-lab, removed in `ece89bd`), and `components/share/product-share-card.tsx` (the branded share card, replaced by the visible-screen capture in `07c74a1`). None are imported anywhere, and none have tests
- [x] Deleted all three; `buildShareRows`/`ShareRow` remain in `lib/price-share.ts` because `buildShareText` still uses them internally
- [x] Added a 3-case "orphaned components stay deleted" guard to `tests/mobile-criticals.test.ts` (now 23) — verified non-vacuous by restoring each file; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1972 passed`, `pnpm build:web` clean

## Phase 277: Device QA round 25 (Compare CSV export — rows unattributable across distributors)

- [x] **The Compare CSV export flattened every distributor's history into one file with no distributor column**: Phase 269 moved the per-distributor price-history export to Compare, but `priceHistoryToCsv`'s header was `product,model,date,price,currency,stockStatus` and the export passed `listings.flatMap((l) => l.priceHistory)`. With 3+ distributors selected the rows were indistinguishable — you could not tell which price came from which distributor
- [x] `priceHistoryToCsv` now emits a `distributor` column (`product,model,distributor,date,price,currency,stockStatus`) and accepts `TaggedPricePoint`; `productHistoryToCsv` tags each point with its distributor's name (used by the shared-watchlist per-product export), and Compare tags each flattened row with `getDistributorById(l.distributorId)?.name`. The desktop `DistributorHistoryModal` tags its single-listing export too
- [x] Verified on device (rebuilt x86_64+arm64 release APK): Compare's export icon opens the share sheet with the CSV; the bundle contains the new header
- [x] Added 2 cases to `tests/csv.test.ts` (now 8: header has the distributor column, per-product rows are tagged with distributor names) — verified non-vacuous by reverting the header/column; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1974 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 278: Device QA round 26 (Android launch setup was entirely skipped)

- [x] **Phase 256 broke every Android launch side effect**: it added the Android app-state listener to the launch-setup effect with an early `return () => sub.remove()` on Android, so on Android the effect never reached `setupAndroidNotificationChannel`, the permission request, `registerPriceCheckTask`, `registerHealthProbeTask`, `checkPriceDropsNow`, `registerPushToken`, `syncServerNotifications`, or the notification-tap routing listener. Verified on device: after a fresh install + launch, `dumpsys notification` showed **no** `stock-alerts`/`price-alerts`/`digest` channels (they only existed from a pre-Phase-256 install), and the permission prompt never appeared
- [x] Moved the Android app-state listener into its own effect (`if (Platform.OS !== "android") return`), leaving the launch-setup effect free of any Android early-return
- [x] Verified on device (rebuilt x86_64+arm64 release APK, uninstalled + reinstalled to wipe channels): all three notification channels are now created, the permission prompt appears, and Home renders normally
- [x] Added a source-level guard to `tests/rn-platform-guards.test.ts` (now 3) — verified non-vacuous by folding the listener back into the setup effect; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1975 passed`

## Phase 279: Device QA round 27 (background tasks shared one interval marker)

- [x] **The price-check and health-probe tasks shared a single interval marker**: `registerPriceCheckTask` and `registerHealthProbeTask` both read/wrote `background_task_interval`, and `syncBackgroundTasks` runs the price task first. After an interval change (hourly→daily) the price task wrote the new value, so the health task read it, concluded nothing changed, and skipped re-registering — leaving the health probe on the old interval until the next change
- [x] The marker is now a per-task map under the same storage key (`{ "price-drop-check": 60, "health-probe": 1440 }`), so each task tracks its own last-registered interval while `clearAllData`'s single-key wipe still covers it
- [x] Added 2 regression cases to `tests/price-check.test.ts` (now 29: hourly→daily and daily→hourly both re-register the health task) — verified non-vacuous by making both tasks use one shared marker name (3 tests fail); E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1977 passed`

## Phase 280: Device QA round 28 (basket alert evaluated in hardcoded USD)

- [x] **The basket-value alert ignored the display currency**: `BasketAlertSheet` tells the user "Notify me when the total watchlist value drops below this amount (EUR)" and stores the threshold as entered, but `runPriceCheckCore` computed the total with `getBestPrice(p.listings, "USD")` and formatted both amounts as USD. A EUR user's €500 threshold was compared against a USD total (and a USD total was reported), so the alert fired or stayed silent wrongly
- [x] The check now computes and formats the total in `settings.displayCurrency` (falling back to USD), matching the sheet and the Stats basket card
- [x] Added a discriminating case to `tests/price-check.test.ts` (now 30: 520 USD → 478.40 EUR fires against a €500 threshold, which a USD total of 520 would skip) — verified non-vacuous by reverting to hardcoded USD; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1978 passed`

## Phase 281: Device QA round 29 (sparkline ignored the tapped distributor)

- [x] **Tapping a distributor's sparkline on product detail did not focus that distributor in Compare**: `onOpenChart` was wired as `() => router.push(`/compare/${id}`)`, discarding the tapped listing. Compare has read a `distributor` query param all along (and the desktop ProductDetail passes `?distributor=<id>` from both its sparkline and history modal), so the mobile handler was the only caller not using it — Compare fell back to its default top-3-by-price selection
- [x] `onOpenChart={(listing) => router.push(`/compare/${id}?distributor=${listing.distributorId}`)}` so the tapped distributor is the one selected
- [x] Verified on device (rebuilt x86_64+arm64 release APK): tapping the MikroTik Store EU sparkline on CRS326 opened Compare with "Select Distributors (1/5)" and MikroTik Store EU selected
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 24) — verified non-vacuous by reverting to the ignored-listing handler; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1979 passed`

## Phase 282: Device QA round 30 (watchlist "Refresh all" false failure + stale keys)

- [x] **"Refresh all" reported a server failure on an empty watchlist**: `useLiveWatchlist.refreshAll` returned `keys.some((key) => queryClient.getQueryData(key) != null)`, which is `false` when there are no keys — so the watchlist header's Refresh button (and the pull-to-refresh) showed "Couldn't refresh prices — The server is unreachable" even though there was simply nothing to refresh
- [x] **`refreshAll` used the pre-reload `queries` closure**: it called `reload()` then mapped the memoized `queries` (derived from the previous render's `products`), so a product added since the last render was never refetched by that call. `useLiveProduct.refresh` was already rewritten to derive keys from a fresh read; `refreshAll` now does the same (`getWatchlist()` → `deriveListingQueries`)
- [x] Added 2 cases to `tests/use-live-prices.test.tsx` (now 10: empty watchlist returns true; a product that appeared since the last render is refetched) — verified non-vacuous by reverting to the stale-closure form; E2E root `tsc 0`, lint 0 errors (164 warnings), root `328 passed | 2 skipped` / `1981 passed`

## Phase 283: Device QA round 31 ("Total Saved" counted price increases)

- [x] **The Alerts "Total Saved" banner counted rise alerts as savings**: a `direction: "rise"` alert fires when the price goes *up* (the user wants to know, e.g. to sell), but both the mobile hook and the desktop page computed `triggeredPrice - targetPrice` for rise alerts and added it to the total — so a price increase was reported as money saved. The triggered card also painted the rise price in success-green with a checkmark
- [x] Extracted `computeTotalSaved` in `lib/alert-savings.ts`: only drop alerts with a positive delta count, converted to the display currency. Both `hooks/use-alerts-data.ts` and `desktop/src/pages/Alerts.tsx` now use it (the desktop page's inline `convertPrice` import was dropped)
- [x] Added `tests/alert-savings.test.ts` (4 cases: drop sums, rise ignored, untriggered/non-positive ignored, currency conversion) — verified non-vacuous by restoring the rise-counting logic; E2E root `tsc 0`, lint 0 errors (164 warnings), root `329 passed | 2 skipped` / `1985 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 284: Device QA round 32 ("Across N triggered alerts" counted rise alerts)

- [x] Follow-up to Phase 283: the "Total Saved" banner's subtitle still counted every triggered alert with a price (`triggeredAlerts.filter((a) => a.triggeredPrice != null)`), including rise alerts the total now excludes — so the banner could read "Total Saved: $0.00 · Across 2 triggered alerts"
- [x] Added `savingAlerts` to `lib/alert-savings.ts` (drop alerts with a positive saving) and used it for the count in both `app/(tabs)/alerts.tsx` and `desktop/src/pages/Alerts.tsx`, so the count and the total describe the same set
- [x] Added a `savingAlerts` case to `tests/alert-savings.test.ts` (now 5) — verified non-vacuous by reverting to the `triggeredPrice != null` filter; E2E root `tsc 0`, lint 0 errors (164 warnings), root `329 passed | 2 skipped` / `1986 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 285: Device QA round 33 (removing a product orphaned its price alerts)

- [x] **Removing a product left its price alerts orphaned**: `removeFromWatchlist` only touched the watchlist, so an alert scoped to a removed product stayed in the Alerts tab. It could never fire (price-check skips products it cannot find in the watchlist) and rendered as "Unknown Product" while still counting toward the "N alerts" badge. Verified on device: after removing CRS804, the Alerts tab still showed "1 alert" with the product name, then "Unknown Product" once the watchlist entry was gone
- [x] `createStorage` now wraps `removeFromWatchlist` to cascade: after removing the product it deletes every alert whose `productId` matches. Cascading in the storage layer (rather than at each of the four call sites) covers every removal path, including the sync engine's `removeLocalItem`
- [x] Verified on device (rebuilt x86_64+arm64 release APK, clean install): set a scoped alert on Valve Steam Deck OLED, removed the product, and the Alerts tab went to "0 alerts" / "No alerts set"
- [x] Added a cascade case to `tests/storage.test.ts` (now 70) — verified non-vacuous by reverting the wrapper; E2E root `tsc 0`, lint 0 errors (164 warnings), root `329 passed | 2 skipped` / `1987 passed`

## Phase 286: Device QA round 34 (sync tombstone bypassed the alert cascade)

- [x] Follow-up to Phase 285: the cascade lived in `storage.removeFromWatchlist`, but the sync engine's `removeLocalItem` removed watchlist rows with a bare `updateWatchlist((list) => list.filter(...))` — so a product deleted on another device (arriving as a tombstone) left its alerts orphaned here, exactly the bug Phase 285 fixed for local removals
- [x] `removeLocalItem`'s watchlist branch now calls `storage.removeFromWatchlist(id)`, so the cascade runs for remote deletions too
- [x] Added a case to `tests/sync-engine.test.ts` (now 32: a remote watchlist tombstone also clears that product's alerts) — verified non-vacuous by reverting to the bare `updateWatchlist`; E2E root `tsc 0`, lint 0 errors (164 warnings), root `329 passed | 2 skipped` / `1988 passed`

## Phase 287: Device QA round 35 (desktop "lowest ever" badge used hardcoded USD)

- [x] **Desktop's "lowest ever" badge mixed currencies**: `isLowestEver` in `desktop/src/pages/ProductDetail.tsx` converted both the historical points and the current price to hardcoded `"USD"`, while every other price on the page (and the mobile watchlist's `atAllTimeLow` via `bestPricePoints`) uses the display currency. A EUR/GBP user's badge was computed across mixed units and could be wrong
- [x] Both conversions now use `displayCurrency` (and the memo depends on it)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 2) asserting the `isLowestEver` block contains no `"USD"` and uses `displayCurrency` — verified non-vacuous by restoring the hardcoded form; E2E root `tsc 0`, lint 0 errors (164 warnings), root `329 passed | 2 skipped` / `1989 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 288: Device QA round 36 (desktop Set Alert modal defaulted to USD)

- [x] **Desktop's main "Set Alert" modal never seeded its currency**: `alertCurrency` stayed at its `"USD"` initial value because the load handler only seeded `perListingAlertCurrency` and `inlineAlertCurrency` from `settings.displayCurrency`. Mobile seeds all three (`app/product/[id].tsx`), so a EUR/GBP desktop user's alert was created in USD
- [x] The load handler now also calls `setAlertCurrency(settings.displayCurrency ?? "USD")`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 3) asserting `setAlertCurrency(settings.displayCurrency` — verified non-vacuous by removing the call; E2E root `tsc 0`, lint 0 errors (164 warnings), root `329 passed | 2 skipped` / `1990 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 289: Device QA round 37 (active-alert counts disagreed across screens)

- [x] **Five user-visible "active alerts" counts used three different predicates**: the Alerts tab badge and tab counter excluded triggered + snoozed alerts, mobile Home excluded only triggered, and desktop Home excluded neither (`alerts.filter((a) => a.isActive)`) — so a snoozed or triggered alert inflated the Home stat card and the desktop count disagreed with its own Alerts tab
- [x] Added `isAlertActive` / `countActiveAlerts` in `lib/alert-state.ts` (enabled, not triggered, snooze elapsed) and used it in `hooks/use-alerts-data.ts`, `hooks/use-alert-badge.ts`, `app/(tabs)/index.tsx`, `desktop/src/pages/Home.tsx`, and `desktop/src/pages/Alerts.tsx`
- [x] Added `tests/alert-state.test.ts` (5 cases: enabled, disabled, triggered, snoozed, elapsed snooze) — verified non-vacuous by reducing the predicate to `isActive`; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `1995 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 290: Device QA round 38 (desktop basket alert clobbered concurrent settings)

- [x] **Desktop's basket-alert save used a whole-object write**: `handleSaveBasketAlert` read settings then called `storage.saveSettings({ ...current, basketAlertThreshold })`, so a settings change made between the read and the write (e.g. a theme/currency toggle) was clobbered. Mobile uses the serialized `updateSettings` for exactly this reason
- [x] Desktop now calls `storage.updateSettings({ basketAlertThreshold: threshold })`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 4) asserting the handler uses `updateSettings` and not `saveSettings` — verified non-vacuous by restoring the whole-object write; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `1996 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 291: Device QA round 39 (watchlist prefs clobbered each other)

- [x] **The two watchlist view-preference persists raced**: the in-stock/price-range effect did `getSettings()` then `saveSettings({ ...settings, ... })` with no serialization, and `persistViewPrefs` (sort/group) used a separate private chain — both wrote the whole settings object. Changing sort and toggling "In stock only" quickly meant both read the same base and the later write dropped the other's field
- [x] Both now use the storage-serialized `updateSettings` (which reads inside the write queue), so concurrent patches merge; the now-unused `saveSettings` import was dropped
- [x] Added a case to `tests/storage.test.ts` (now 71: two concurrent `updateSettings` patches both survive) — verified non-vacuous by moving the read outside the queue; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `1997 passed`

## Phase 292: Device QA round 40 (desktop settings writes raced each other)

- [x] Follow-up to Phase 291 on desktop: the Watchlist view-prefs effect did `getSettings()` then `saveSettings({ ...s, ... })` with no serialization, and `useSettings.update` used a private `writeChain` that still read settings outside the storage queue — so Watchlist prefs, the basket alert, and the theme toggle could clobber each other's fields
- [x] Both now use the storage-serialized `updateSettings` (which reads inside the shared write queue); the redundant private `writeChain` was removed
- [x] Updated the desktop test mocks/assertions that stubbed the old `saveSettings` path (`use-settings-update`, `parity-rates-search-watchlist`, `settings-webtoggle`, `ux-alignment`, `error-paths-safety`) to the `updateSettings` contract — desktop `44 passed` / `219 passed`; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `1997 passed`

## Phase 293: Device QA round 41 (desktop alert mutations had no error handling)

- [x] **Desktop Alerts mutation handlers swallowed failures as unhandled rejections**: `handleToggle`, `handleDeleteAlert`, `handleRearm`, `handleSnoozeAlert`, `handleDeleteReminder`, `handleDeleteWatch`, `handleReschedule`, and `handleSaveEdit` all `await`ed a storage write with no try/catch, so a quota/IDB failure produced an unhandled rejection and no user feedback (mobile surfaces an alert for each)
- [x] Each now catches and reports: toasts for the mutation handlers, inline errors for the reschedule/edit modals
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 5) asserting each handler wraps its write in try/catch — verified non-vacuous by reverting `handleToggle`; also added the missing `updateSettings` stub to `desktop/tests/nav-header.test.tsx` (an unhandled error surfaced by Phase 292's change); E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `1998 passed`; desktop `tsc 0`, `44 passed` / `219 passed` (exit 0)

## Phase 294: Device QA round 42 (desktop watchlist remove/undo had no error handling)

- [x] Follow-up to Phase 293 in the desktop Watchlist: `handleBulkDelete`, `handleUndo`, and `handleRemove` awaited `storage.removeFromWatchlist`/`addToWatchlist` with no try/catch, so a storage failure was an unhandled rejection with no feedback (mobile wraps each and shows an alert)
- [x] Each now catches and toasts ("Couldn't remove those products…", "Couldn't restore that product…", "Couldn't remove that product…")
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 6) asserting the three handlers wrap their writes in try/catch — verified non-vacuous by reverting `handleUndo`; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `1999 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 295: Device QA round 43 (desktop product-detail writes had no error handling)

- [x] Follow-up to Phases 293/294 in the desktop ProductDetail: `handleSetReminder`, `handleInlineReminder`, `handleWatchRestock`, and `handleToggleListingWatch` awaited storage writes with no try/catch, and `createPriceAlert` (used by the main, per-listing, and quick alert flows) awaited `storage.addAlert` unguarded — a storage failure was an unhandled rejection with no feedback
- [x] Each now catches: inline errors for the reminder modals, toasts for the watch toggles, and `createPriceAlert` returns `{ ok: false }` so callers show their existing permission/error toast
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 7) — verified non-vacuous by reverting `handleWatchRestock`; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2000 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 296: Device QA round 44 (desktop clear-all-data had no error handling)

- [x] Follow-up to Phases 293-295: the desktop Settings "Clear all data" handler awaited `storage.clearAllData()` with no try/catch, so a storage failure was an unhandled rejection with no feedback (mobile's About section wraps it)
- [x] It now catches and surfaces the failure via the section's message, and always closes the confirm state
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 8) — verified non-vacuous by reverting the wrapper; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2001 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 297: Device QA round 45 (desktop compare cross-alert had no error handling)

- [x] Follow-up to Phases 293-296: the desktop Compare "Alert me if any distributor drops below" handler awaited `storage.addAlert` with no try/catch, so a storage failure was an unhandled rejection with no feedback (mobile wraps it and shows an alert)
- [x] It now catches and toasts "Couldn't create alert. Please try again." without claiming success
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 9) — verified non-vacuous by reverting the wrapper; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2002 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 298: Device QA round 46 (product detail alerts state went stale)

- [x] **Alerts created outside the scoped modal never reached the screen's state**: `handleSetBestAlert` (Best-Distributor card) and `AlertSection` (inline product-wide alert) wrote to storage but did not call `setAlerts`, so the Distributor Targets table — which reads the screen's `alerts` state — stayed stale until the screen reloaded. Only `handleSetAlert` (the scoped `+` modal) updated state
- [x] `handleSetBestAlert` now appends the new alert to state; `AlertSection` gained an `onAdded` callback wired to `setAlerts` in `app/product/[id].tsx`
- [x] Verified on device (rebuilt x86_64+arm64 release APK): setting a scoped target via the `+` immediately shows "$649.00 · target $500.00" in the Distributor Targets table
- [x] Added 2 cases to `tests/mobile-criticals.test.ts` (now 26) — verified non-vacuous by reverting both; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2004 passed`

## Phase 299: Device QA round 47 (desktop product-detail alerts state went stale)

- [x] Follow-up to Phase 298 on desktop: `createPriceAlert` wrote to storage but returned only `{ ok, id }`, and none of its four callers (main Set Alert, inline alert, per-listing alert, quick alert) updated the screen's `alerts` state — so the Distributor Targets table (which reads `alerts`) stayed stale until reload
- [x] `createPriceAlert` now returns the created `alert`, and all four callers append it via `setAlerts((prev) => [...prev, alert])`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 10) — verified non-vacuous by dropping one `setAlerts` call; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2005 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 300: Device QA round 48 (desktop unguarded storage.then chains)

- [x] Follow-up to Phases 293-299: several desktop effects called `storage.getWatchlist()`/`getSettings()` with a bare `.then(...)` and no `.catch`, so a storage read failure became an unhandled rejection — `desktop/src/pages/Alerts.tsx` (names + currency), `desktop/src/pages/Watchlist.tsx` (view prefs), `desktop/src/components/TrendingSection.tsx` (added ids), and `desktop/src/components/SearchModal.tsx` (tracked ids)
- [x] Each chain now ends in `.catch(() => {})`; the decoration simply keeps its defaults on failure
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 11) asserting each chain has a `.catch` — verified non-vacuous by dropping the Watchlist catch; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2006 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 301: Device QA round 49 (mobile unguarded storage.then chains)

- [x] Follow-up to Phase 300 on mobile: `lib/web-notifications.ts` (`setupWebNotifications` read settings with a bare `.then`) and `components/home/trending-section.tsx` (focus effect read the watchlist with a bare `.then`) rejected unhandled on a storage failure
- [x] Both chains now end in `.catch(() => {})`; polling/added-state simply stay off/empty on failure
- [x] Added 2 cases to `tests/mobile-criticals.test.ts` (now 28) — verified non-vacuous by reverting the trending-section guard; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2008 passed`

## Phase 302: Device QA round 50 (basket alert didn't revert on save failure)

- [x] **The basket-alert save left a phantom threshold on screen**: both `app/stats.tsx` and `desktop/src/pages/Stats.tsx` set `basketThreshold` optimistically before the write; mobile's catch showed an alert but never reverted, and desktop had no try/catch at all — so a failed save displayed a threshold that was never persisted (and desktop's rejection was unhandled)
- [x] Both now capture the previous threshold and restore it on failure (desktop also toasts)
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 29) and `tests/desktop-chart-guard.test.ts` (now 12) — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2010 passed`; desktop `tsc 0`, `44 passed` / `219 passed`

## Phase 303: Device QA round 51 (desktop settings update didn't revert on failure)

- [x] Follow-up to Phase 302: the desktop `useSettings.update` hook applied the patch optimistically but its `.catch` only logged — it never restored the previous settings, so every failed settings write (theme, currency, region, interval, LLM fields, web-notification toggle) left the UI showing a value that was never persisted. Mobile's `updateSetting` already reverts
- [x] `update` now captures the pre-patch value via a `settingsRef` and restores it in the catch
- [x] Added a behavioral case to `desktop/tests/use-settings-update.test.tsx` (now 3: the optimistic theme patch is reverted when the write rejects) — verified non-vacuous by removing the revert; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2010 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 304: Device QA round 52 (tag picker toggle didn't revert on failure)

- [x] Follow-up to Phases 302/303: `TagPickerSheet.toggleTag` optimistically updated the selection then awaited `setProductTags` with no try/catch, so a storage failure was an unhandled rejection and the UI showed a tag that was never persisted
- [x] It now catches, restores the previous selection, and surfaces "Couldn't save tags. Please try again."
- [x] Added a guard to `tests/tag-picker-sheet.test.ts` (now 7) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (164 warnings), root `330 passed | 2 skipped` / `2011 passed`

## Phase 305: Device QA round 53 (orphaned product-detail hook)

- [x] `hooks/use-product-detail.ts` was orphaned when the product detail screen switched to `useLiveProduct` (the `7b4b7e3` refactor added it, then `2b2f316` removed its last screen import). Only its own test imported it, so it was dead source shipping in the bundle
- [x] Deleted the hook and `tests/use-product-detail.test.tsx`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 30) — verified non-vacuous by restoring the file; E2E root `tsc 0`, lint 0 errors (158 warnings, down from 164), root `330 passed | 2 skipped` / `2011 passed`

## Phase 306: Device QA round 54 (dead lib exports)

- [x] Three exports were referenced nowhere — not by any module, screen, or test: `parseWatchlistDetailedCsv` (`lib/csv.ts`), `getQueuedEditCount` (`lib/sync.ts`), and `computeWatchlistStats` (`lib/watchlist-stats.ts`). The latter's `WatchlistStats` interface became unused with it
- [x] Removed all four; `detailedCsvToProducts`/`parseDetailedCsv` and `countQueuedEdits` remain because they are still used internally
- [x] Added a 4-case guard to `tests/mobile-criticals.test.ts` (now 34) — verified non-vacuous by restoring `getQueuedEditCount`; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2015 passed`

## Phase 307: Device QA round 55 (desktop CSV import overstated duplicate adds)

- [x] **Desktop's CSV import counted every non-throwing `addToWatchlist` as added**: `addToWatchlist` returns `false` for an already-tracked product (the Phase 270 fix), but `desktop/src/pages/Watchlist.tsx`'s `handleImportFile` ignored the return and did `added += 1` unconditionally — so re-importing a CSV reported "Added N products" for products that were already on the watchlist
- [x] It now branches on the boolean, counts `duplicates`, and reports "N already tracked" in the summary, matching mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 13) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2016 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 308: Device QA round 56 (dead computation in the distributor selector)

- [x] `components/compare/distributor-selector.tsx` computed `allDistributorIds` with a `useMemo` and then immediately discarded it (`void allDistributorIds`) — dead work on every render, plus a now-unused `useMemo` import
- [x] Removed both
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 35) — verified non-vacuous by restoring the computation; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2017 passed`

## Phase 309: Device QA round 57 (dead pendingTags computation in desktop Home)

- [x] Follow-up to Phase 308: `desktop/src/pages/Home.tsx` declared `pendingTags` state, derived `pendingTagsArray`/`pendingTagsSize`, and immediately `void`ed both — dead work on every render (leftover from a pendingTags reactivity experiment)
- [x] Removed the state, both derivations, and the `void` statements
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 14) — verified non-vacuous by restoring the computation; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2018 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 310: Device QA round 58 (desktop unguarded product.listings access)

- [x] **Desktop pages accessed `product.listings.<method>` without the `?? []` guard mobile uses**: `Home.tsx` (`p.listings.some`), `Watchlist.tsx` (`getTrend`, `getDominantStatus`, the price-refresh job filter, and the listing-count cell), `Stats.tsx` (the comparison chart), `Compare.tsx` (param match, selection init, chart series, trends, sorted list), `ProductDetail.tsx` (seed listings, target table), and `Settings.tsx` (re-enable distributor). A product with no listings (manually added / discovery failed) crashed the page
- [x] All now use `(product.listings ?? [])`, matching mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 15) asserting no bare `X.listings.<method>` remains in those files — verified non-vacuous by reverting Home; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2019 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 311: Device QA round 59 (compare cross-alert double-submit)

- [x] **The Compare cross-distributor alert had no double-submit guard**: `handleCrossAlert` mints a fresh alert id on each call, so a rapid double-tap created two identical "alert me if any distributor drops below X" alerts (and scheduled two notifications). Both mobile (`app/compare/[id].tsx`) and desktop (`desktop/src/pages/Compare.tsx`) were affected
- [x] Both now track a `creatingAlert` state, early-return while a creation is in flight, and clear it in `finally`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 36) and `tests/desktop-chart-guard.test.ts` (now 16) — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2021 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 312: Device QA round 60 (product-detail alert double-submit)

- [x] Follow-up to Phase 311: the product-detail alert flows had no double-submit guard — `handleSetBestAlert` (Best-Distributor card) and `handleSetAlert` (the scoped PriceAlertModal, whose Set Alert button and `onSubmitEditing` both call it) each mint a fresh alert id per call, so a rapid double-tap or Enter+button created two alerts
- [x] Both now check a shared `creatingAlert` state, early-return while a creation is in flight, and clear it in `finally`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 37) — verified non-vacuous by reverting `handleSetAlert`; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2022 passed`

## Phase 313: Device QA round 61 (desktop product-detail alert double-submit)

- [x] Follow-up to Phase 312 on desktop: `handleSaveAlert`, `handleInlineAlert`, `handlePerListingAlert`, and `handleQuickAlert` each minted a fresh alert id per call with no double-submit guard, so a rapid double-click / Enter+button created two alerts
- [x] All four now check a shared `creatingAlert` state, early-return while a creation is in flight, and clear it in `finally`
- [x] Updated the existing `desktop/tests/best-price-signals.test.tsx` case that pinned the old behavior ("creates two distinct alerts on rapid double-tap" — its intent was id uniqueness, but duplicates were the bug) to assert a single alert; verified non-vacuous by reverting the guard. Added a source guard to `tests/desktop-chart-guard.test.ts` (now 17); E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2023 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 314: Device QA round 62 (restock-watch toggle double-submit)

- [x] Follow-up to Phases 312/313: `handleToggleStockWatch` had no double-submit guard, so a rapid double-tap on "Watch for Restock" scheduled two confirmation notifications; the second `addStockWatch` replaced the first (same deterministic id), orphaning the first notification id so it could never be cancelled
- [x] It now checks a `togglingWatch` state, early-returns while in flight, and clears it in `finally` (the reminder handler already dedups via `replacedNotificationId`, so only the watch toggle needed this)
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 38) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2024 passed`

## Phase 315: Device QA round 63 (desktop reminder/watch double-submit)

- [x] Follow-up to Phases 312-314 on desktop: `handleSetReminder`, `handleInlineReminder`, `handleWatchRestock`, and `handleToggleListingWatch` each mint a fresh random id per call with no double-submit guard, so a rapid double-click created two reminders or two restock watches
- [x] All four now check a shared `savingReminder` state, early-return while in flight, and clear it in `finally`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 18) — verified non-vacuous by reverting `handleInlineReminder`; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2025 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 316: Device QA round 64 (reminder reschedule double-submit)

- [x] Follow-up to Phases 312-315: `handleReschedule` in `hooks/use-alerts-data.ts` had no double-submit guard, so a rapid double-tap scheduled two reminder notifications; the second `addBackOrderReminder` replaced the first (same product/distributor), orphaning the first notification id so it could never be cancelled
- [x] It now checks a `rescheduling` state, early-returns while in flight, and clears it in `finally`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 39) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2026 passed`

## Phase 317: Device QA round 65 (AI discovery didn't add to the watchlist)

- [x] **Mobile AI discovery claimed "Added X to watchlist" but never added it**: `discoverProduct` (`lib/llm-discovery.ts`) only saves to the *discovered catalog* (`addDiscoveredProduct`), not the watchlist. `app/search.tsx`'s `handleDiscover` showed "Added X to watchlist" and navigated to `/product/<id>`, but the product detail screen reads the watchlist (`useLiveProduct` → `getWatchlist`) and rendered "Product not found". Desktop's `handleDiscover` explicitly calls `addToWatchlist` before navigating
- [x] Mobile now calls `addToWatchlist` with the discovered product before `loadData()` / navigation
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 40) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2027 passed`

## Phase 318: Device QA round 66 (verify Phase 317 fix; discovery is sign-in only)

- [x] Rebuilt the release APK and drove the AI discovery flow on device: with a query that has no catalog matches ("Zyxel XGS1250-12") the "Discover with AI" CTA appears and tapping it invokes `discovery.discover`. The endpoint is a `protectedProcedure` (`server/routers/discovery.ts`) and the device is signed out, so the server returns 401 and the end-to-end add-to-watchlist path cannot be exercised without credentials
- [x] Confirmed the rebuilt bundle is newer than the fixed source and contains the `addToWatchlist` call; the Phase 317 guard test pins the behavior
- [x] No code change this round

## Phase 319: Device QA round 67 (desktop discovery didn't mark the product tracked)

- [x] **Desktop AI discovery left the catalog row offering "Add"**: `handleDiscover` in `desktop/src/pages/Search.tsx` added the discovered product to the watchlist but never updated `trackedIds`, which drives the Add / "Tracked" button. Mobile's `handleDiscover` calls `loadData()`, which reloads `trackedIds`. So after a desktop discovery the same row still showed "Add" (and could be added again)
- [x] It now calls `setTrackedIds((prev) => new Set([...prev, res.product.id]))`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 19) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2028 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 320: Device QA round 68 (edit product sheet swallowed save failures)

- [x] **`EditProductSheet.handleSave` had no catch**: a storage failure from `updateProductDetails` rejected unhandled, and because the `finally` only cleared `saving`, the sheet stayed open with no error and no success feedback (the desktop `handleSaveEdit` wraps the same call and shows an inline error)
- [x] It now catches, fires an error haptic, and shows "Couldn't save — We couldn't save your changes. Please try again." without closing the sheet
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 41) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2029 passed`

## Phase 321: Device QA round 69 (removing a stock watch left its notification scheduled)

- [x] **`handleRemoveStockWatch` didn't cancel the watch's scheduled notification**: the Alerts screen removed the watch row but left its `notificationId` scheduled, so the "Restock watch set" confirmation still fired after removal. The product-detail toggle and `handleDeleteReminder` both cancel first
- [x] It now cancels `watch.notificationId` (when present) before `removeStockWatch`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 42) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2030 passed`

## Phase 322: Device QA round 70 (notification center unread badge stale closure)

- [x] **`NotificationCenter.handleOpen` decremented the unread badge from a stale closure**: `applyUnread(Math.max(0, unreadCount - 1))` read the `unreadCount` captured when the callback was created, so tapping two unread items in quick succession (before a re-render) decremented by one total instead of two — the badge under-counted
- [x] Added a `decrementUnread` callback using a functional `setUnreadCount((prev) => ...)` update (which also reports the new value to `onUnreadChange`) and used it in `handleOpen`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 43) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2031 passed`

## Phase 323: Device QA round 71 (notification center mark-all swallowed failures)

- [x] **`NotificationCenter.handleMarkAll` had no catch**: a storage failure from `markAllNotificationsRead` rejected unhandled and then cleared the badge/history as if the write succeeded (desktop's `handleMarkAllRead` wraps the same call and toasts on failure)
- [x] It now catches, shows "Couldn't update — We couldn't mark notifications as read. Please try again.", and returns without clearing state
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 44) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2032 passed`

## Phase 324: Device QA round 72 (notification center open swallowed failures)

- [x] Follow-up to Phase 323: `NotificationCenter.handleOpen` awaited `markNotificationRead` with no catch, so a storage failure rejected unhandled and then marked the item read in the UI anyway (desktop's `handleNotificationOpen` wraps the same call and toasts on failure)
- [x] It now catches, shows "Couldn't update — We couldn't update that notification. Please try again.", and returns without decrementing the badge or marking it read
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 45) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2033 passed`

## Phase 325: Device QA round 73 (verify-email didn't check the API base URL)

- [x] **`app/verify-email.tsx` fetched `${getApiBaseUrl()}/api/auth/verify` without checking the base URL was configured**: on an unconfigured build `getApiBaseUrl()` returns `""`, so the fetch hit the relative path `/api/auth/verify` and the screen showed a confusing "Verification failed" instead of explaining the build isn't connected. `app/oauth/callback.tsx` guards the same way
- [x] It now bails with "This build isn't connected to a server. Open the link in the app that requested it." when the base URL is empty
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 46) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2034 passed`

## Phase 326: Device QA round 74 (forgot/reset-password didn't check the API base URL)

- [x] Follow-up to Phase 325: the forgot/reset-password paths fetched `${getApiBaseUrl()}/...` without checking the base URL was configured — mobile `useAuth.forgotPassword` + `login-modal`, desktop `ResetPassword` + Settings forgot-password. On an unconfigured build they hit the relative path and showed a confusing failure
- [x] All four now throw "This build isn't connected to a server." when the base URL is empty
- [x] Added 3 guards to `tests/mobile-criticals.test.ts` (now 48) and 1 to `tests/desktop-chart-guard.test.ts` (now 20) — verified non-vacuous by reverting `useAuth.forgotPassword` and desktop `ResetPassword`; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2037 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 327: Device QA round 75 (launch side effects rejected unhandled)

- [x] **`app/_layout.tsx` fired launch side effects with no catch**: `void checkPriceDropsNow()` (whose `runPriceCheckCore` starts with `await getWatchlist()`, which rethrows adapter failures), `void loadFxRates()`, and `void maybeRefreshFxRates()` could each reject unhandled on a storage read failure. `app/(tabs)/settings.tsx` had the same unguarded `void maybeRefreshFxRates()`
- [x] All four now `.catch(...)` (the price check logs; the FX loads fall back to the static rate table)
- [x] Added 2 guards to `tests/mobile-criticals.test.ts` (now 50) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2039 passed`

## Phase 328: Device QA round 76 (CSV import accumulated duplicate alerts)

- [x] **Re-importing a CSV with target prices accumulated duplicate alerts**: both the mobile and desktop import loops created a new alert for every row with a `targetPrice`, even when the product was already tracked and already had an active alert (`addAlert` has no dedup). Importing the same file twice produced two identical alerts per row
- [x] Both now pre-load the set of products with an active, untriggered alert and skip alert creation for those (and add each newly-created product to the set, so a CSV with duplicate rows doesn't double-alert either)
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 51) and `tests/desktop-chart-guard.test.ts` (now 21) — verified non-vacuous by reverting both; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2041 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 329: Device QA round 77 (desktop Home refresh had a redundant read-and-discard)

- [x] **`desktop/src/pages/Home.tsx` `refreshDashboard` had a redundant block**: after `refreshWatchlist()`/`refreshAlerts()` (which update the hooks' state), it re-read `storage.getWatchlist()` and `storage.getAlerts()`, discarded both results, and cleared the `loadError` the previous block had just set — dead work that could also mask a real load failure
- [x] Removed the redundant block
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 22) — verified non-vacuous by restoring the block; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2042 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 330: Device QA round 78 (desktop Stats advanced the digest snapshot on every visit)

- [x] **Desktop Stats saved a digest snapshot on every load**: `loadStats` wrote a fresh `buildDigestSnapshot` after computing the digest (and again when the digest was off), advancing the diff base. The digest sender (`desktop/src/App.tsx` `maybeSendDigest`) owns the snapshot lifecycle and saves only when a digest is actually delivered — so the Stats card showed changes since the last Stats *visit* rather than since the last *sent* digest. Mobile's Stats page is read-only
- [x] Removed both saves (and the now-unused `buildDigestSnapshot`/`DigestSnapshot`/`LOG_ERROR`/`currency`); Stats is now read-only like mobile
- [x] Updated `tests/desktop-log-guard.test.ts` (whose old assertion pinned the now-removed `@shared/log` import in Stats) to its real intent: no desktop file reimplements `LOG_ERROR` locally — verified non-vacuous by adding a local definition. Added a digest guard to `tests/desktop-chart-guard.test.ts` (now 23); E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2043 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 331: Device QA round 79 (watchlist share text said "1 products")

- [x] **`buildWatchlistShareText` hardcoded "products"**: a single-product watchlist share read "My Watchlist — 1 products (30d)" and "Basket value: … (1 products)". The existing tests pinned the ungrammatical output
- [x] Both counts now pluralize (`watchlist.length === 1 ? "" : "s"`, same for `basket.productCount`); updated the two tests that asserted "1 products"
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 52) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2044 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 332: Device QA round 80 (distributor analysis shared the CSV as text)

- [x] **The Distributor Analysis "Export CSV" shared the CSV as a text message**: it called `shareText(csv, …)` (web clipboard / native `Share.share({ message })`) instead of the shared `exportCsvFile` helper, so the recipient got the CSV pasted as text rather than a `.csv` file — unlike Compare, the shared watchlist, and Settings, which all use `exportCsvFile`
- [x] It now calls `exportCsvFile(csv, "distributor-analysis-<date>.csv")` and reports "Exported" / "Export unavailable" (the now-unused `shareText` import was dropped)
- [x] Updated `tests/distributor-analysis.test.ts` (whose old assertion pinned the `shareText` outcome strings) to assert the file-export path, and added a guard to `tests/mobile-criticals.test.ts` (now 53) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2045 passed`

## Phase 333: Device QA round 81 (shared-watchlist invite accepted expired shares)

- [x] **`sharedWatchlists.invite` didn't check expiry**: unlike `get`, `members`, and `join` (which all reject an expired share), `invite` only checked ownership — so an owner could add members to an expired share, silently granting access to a dead share that no one can open
- [x] `invite` now rejects an expired share with NOT_FOUND "Share expired", matching the other endpoints
- [x] Added a case to `tests/shared-watchlists.test.ts` (now 11: invite rejects an expired share) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2046 passed`

## Phase 334: Device QA round 82 (settings data section swallowed export/import failures)

- [x] **`components/settings/data-section.tsx` had three unguarded storage paths**: `handleExport` (backup) and `handleExportCsv` had a `try` with only a `finally`, and the import confirmation's `onPress` async block also had no catch — a storage read/write failure rejected unhandled with no feedback
- [x] All three now catch and report ("Export Failed" / "Import failed")
- [x] Added 3 guards to `tests/mobile-criticals.test.ts` (now 56) — verified non-vacuous by reverting the CSV export catch; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2049 passed`

## Phase 335: Device QA round 83 (trending refresh wasn't transactional)

- [x] **`trending.refresh` deleted then inserted without a transaction**: a failed insert after the `delete(trendingProducts)` committed would leave the trending list empty until the next successful refresh (the previous list is lost). Every other multi-write path in the server uses a transaction
- [x] The replace now runs in `db.transaction((tx) => { tx.delete(...); tx.insert(...) })`
- [x] Added a guard to `tests/trending-refresh-guard.test.ts` (now 3) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2050 passed`

## Phase 336: Device QA round 84 (per-device notification evaluation loaded all retained events)

- [x] **`evaluateConfigDb` loaded every retained event for a device on every tick**: its `existing` query filtered only by `deviceId`, so it read up to 30 days of events per device per warmer tick. `isEventBlocking` only ever blocks within `DELIVERY_GRACE_MS` (7 days), and the per-user path (`evaluateUserDb`) already bounds its read by that window
- [x] The per-device query now filters `gt(notificationEvents.createdAt, now - DELIVERY_GRACE_MS)`, matching the per-user path
- [x] Added a guard to `tests/notification-dedup-grace.test.ts` (now 3) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2051 passed`

## Phase 337: Device QA round 85 (reminder section double-submit)

- [x] Follow-up to Phases 312-316: `ReminderSection.onSet` (the product-detail "Remind Me" fallback used when no `onRemind` is wired) had no double-submit guard, so a rapid double-tap scheduled two notifications and created two reminders; the second `addBackOrderReminder` replaced the first, orphaning the first notification id
- [x] It now checks a `saving` state, early-returns while in flight, and clears it in `finally`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 57) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2052 passed`

## Phase 338: Device QA round 86 (device id changed on every request when storage failed)

- [x] **`getDeviceId`'s storage-failure fallback minted a new id per call**: when `AsyncStorage` throws (browser privacy modes), the catch returned `generateId()` fresh each time, so the server saw a different device on every request — breaking device binding and revocation (a revoked device would look like a brand-new one). The desktop variant reads localStorage directly and would reject instead
- [x] The fallback id is now cached in memory (`memoryFallbackId`) so the device keeps a stable identity for the session
- [x] Added a case to `tests/device-id.test.ts` (now 3: stable in-memory id when storage fails) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2053 passed`

## Phase 339: Device QA round 87 (desktop device id could reject / churn)

- [x] Follow-up to Phase 338 on desktop: `getDesktopDeviceId` called `localStorage.getItem`/`setItem` outside any try/catch, so a storage failure rejected (the mobile variant falls back to an in-memory id), and its `pending` guard was ineffective because the first `getItem` await happened before the pending check — concurrent callers could each generate an id
- [x] It now mirrors mobile: the whole read/write is wrapped, a `memoryFallbackId` keeps a stable identity on failure, and the `pending` guard is checked first
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 24) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2054 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 340: Device QA round 88 (three more auth fetches skipped the base-URL guard)

- [x] Follow-up to Phase 326: `useAuth.changePassword`, `deleteAccount`, and `resendVerification` all fetched `${getApiBaseUrl()}/api/auth/...` without checking the base URL was configured, so on an unconfigured build they hit the relative path and surfaced a confusing failure (only `forgotPassword` had the guard)
- [x] All three now throw "This build isn't connected to a server." when the base URL is empty
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 58) asserting every auth fetch has the guard — verified non-vacuous by reverting `changePassword`; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2055 passed`

## Phase 341: Device QA round 89 (price-vs-average compared in-stock current against all-status history)

- [x] **`computePriceVsAverage` averaged out-of-stock history points**: `current` is the minimum in-stock listing price, but the 30-day average was computed over every listing's history regardless of stock status. An out-of-stock point (often a different price band) skewed the average, so the "Below average — good time to buy" / "Above average" verdict could be wrong — the same class of bug the all-time-low check fixed by switching to `bestPricePoints` (in-stock only)
- [x] The average now filters `p.stockStatus === "in_stock"`, matching `current`
- [x] Added a case to `tests/price-average.test.ts` (now 6: a 1000 out-of-stock point must not pull the average up) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2056 passed`

## Phase 342: Device QA round 90 (watchlist undo lost the product's alerts)

- [x] **Swipe-delete's Undo restored only the product, not its alerts**: Phase 285 made `removeFromWatchlist` cascade to the product's price alerts, but the watchlist Undo bar (`handleUndo`) only called `addToWatchlist` — so undoing a swipe-delete silently and permanently lost the product's price alerts
- [x] `handleSwipeDelete` now captures the product's alerts before the removal and passes them to `showUndoBar`; `handleUndo` re-adds them after restoring the product
- [x] Added 2 guards to `tests/mobile-criticals.test.ts` (now 60) — verified non-vacuous by reverting the restore; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2058 passed`

## Phase 343: Device QA round 91 (desktop watchlist undo lost the product's alerts)

- [x] Follow-up to Phase 342 on desktop: `handleRemove`'s Undo restored only the product, while `removeFromWatchlist` cascades to the product's alerts — so undoing a removal silently lost the price alerts
- [x] `handleRemove` now captures the product's alerts before removal and passes them to `showUndoBar`; `handleUndo` re-adds them after restoring the product
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 25) — verified non-vacuous by reverting the restore; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2059 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 344: Device QA round 92 (removing a product orphaned its reminders and stock watches)

- [x] **The removal cascade only covered alerts**: Phase 285 made `removeFromWatchlist` delete a product's price alerts, but its back-order reminders and stock watches were left behind. They render in the Alerts tab (they store `productName`) but can never fire — `restock.ts` skips a watch whose product is not on the watchlist — so they accumulate as dead rows and inflate the "N reminders" count
- [x] `removeFromWatchlist` now also deletes the product's reminders and stock watches (the shared `remindersStorage` instance is reused instead of a second `createRemindersStorage(ctx)`)
- [x] Added a case to `tests/storage.test.ts` (now 72: removal cascades to reminders and watches) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2060 passed`

## Phase 345: Device QA round 93 (settings sync resurrected a locally-removed field)

- [x] **The settings per-field merge resurrected a field the local device removed**: the merge iterates `Object.keys(local)` and keeps the local value for any field changed since the last-synced snapshot. A field the local device *removed* (e.g. Quiet Hours turned off, which sets `quietHours: undefined` and is dropped from JSON) is absent from `local`, so the loop never saw it and the incoming server value resurrected it — Quiet Hours silently turned back on after a sync
- [x] The merge now also iterates the last-synced base's keys and deletes any that are gone locally, so a local removal wins
- [x] Added a case to `tests/settings-field-merge.test.ts` (now 2: a locally-removed `quietHours` is not resurrected) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2061 passed`

## Phase 346: Device QA round 94 (device-scrape semaphore over-admitted past its cap)

- [x] **`lib/price-source.ts`'s device-scrape limiter could exceed its cap**: `releaseScrapeSlot` decremented `activeScrapes` then woke a waiter that re-incremented. A new `acquireScrapeSlot` called synchronously between the decrement and the waiter's continuation saw a free slot, took it, and then the waiter incremented too — admitting 4 concurrent scrapes with a cap of 3
- [x] Extracted a `createSemaphore` helper (`lib/concurrency.ts`) that transfers a released slot directly to the waiter (it stays counted as active), and used it in `price-source.ts`
- [x] Added a deterministic `createSemaphore` case to `tests/price-source.test.ts` (now 9) that releases and races a new acquire in the same turn — verified non-vacuous by restoring the decrement-then-wake form; E2E root `tsc 0`, lint 0 errors (158 warnings), root `330 passed | 2 skipped` / `2062 passed`

## Phase 347: Device QA round 95 (server scrape limiter had the same over-admission race)

- [x] Follow-up to Phase 346: `server/prices.ts`'s `acquireScrapeSlot`/`releaseScrapeSlot` had the same decrement-then-wake race (a racing acquire could take the freed slot and exceed `MAX_CONCURRENT_SCRAPES`), plus its own queue-full rejection
- [x] The server now uses the shared `createSemaphore(MAX_CONCURRENT_SCRAPES, { maxQueue: MAX_QUEUED_SCRAPES })` (the helper gained an optional `maxQueue`), so slot transfer is exact and the queue cap is preserved
- [x] Added a queue-full case and a server source guard to `tests/price-source.test.ts` (now 11) — verified non-vacuous by restoring the old server limiter; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2064 passed`

## Phase 348: Device QA round 96 (distributor analysis rendered $NaN on a malformed tax rate)

- [x] **`analyzeDistributors` used `cheapest.taxRate ?? 0`**: `??` does not sanitize `NaN`, so a malformed server payload carrying a NaN tax rate made `totalCost` NaN and rendered the whole Distributor Analysis row as `$NaN`. `findBestDeal` already guards the same field with `Number.isFinite`
- [x] It now uses `Number.isFinite(cheapest.taxRate) ? cheapest.taxRate : 0`
- [x] Added a case to `tests/distributor-analysis.test.ts` (now 9: a NaN tax rate is treated as zero) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2065 passed`

## Phase 349: Device QA round 97 (corrupt digest snapshot crashed the Stats tab)

- [x] **`getPriceDigestSnapshot` returned any parsed JSON without shape validation**: `computeDigest` then calls `previous?.products ?? []` and `.map`, so a corrupt payload with `products` as a non-array (e.g. a string) threw `... .map is not a function` inside `app/stats.tsx`'s `useMemo` — no error boundary, so the Stats tab crashed
- [x] It now validates that the parsed payload is an object with an array `products` and returns null otherwise
- [x] Added `tests/digest-snapshot-validation.test.ts` (3 cases: valid, non-array products, non-object) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2068 passed`

## Phase 350: Device QA round 98 (corrupt FX history crashed the Rates screen)

- [x] **`getFxHistory` didn't validate the payload shapes**: it only checked that `rates`/`timestamps` were truthy, so a corrupt payload with `timestamps` as a non-array (or `rates` as a non-object) made `sliceFxHistoryByRange`'s `.filter` / `Object.entries` throw inside `app/(tabs)/rates.tsx`'s `useMemo` — no error boundary, so the Rates tab crashed
- [x] It now requires `rates` to be a non-array object and `timestamps` to be an array, returning null otherwise
- [x] Added a corrupt-payload case to `tests/fx-history.test.ts` (now 8) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2069 passed`

## Phase 351: Device QA round 99 (corrupt circuit-breaker entry rejected the whole scrape)

- [x] **`createStorageBreakerStore`'s `readList` didn't validate entries**: it only checked `Array.isArray`, so a corrupt stored list containing a null/non-object entry made `list.find((e) => e.distributorId === id)` throw. `resilientFetch` does not catch that, so the whole scrape rejected instead of degrading
- [x] `readList` now filters to entries with a string `distributorId`
- [x] Added a case to `tests/resilient-fetch.test.ts` (now 31: malformed entries are ignored) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2070 passed`

## Phase 352: Device QA round 100 (Android alert overflow dropped the "More…" button)

- [x] **`showAndroidChoice` could pass 4 buttons to `Alert.alert`**: with 4+ actions and no Cancel it used `slots = 3`, producing 3 actions + "More…" = 4 buttons. Android silently drops the 4th, so the "More…" button (and every action behind it) was unreachable. The same overflow happened with a Cancel present and 3+ actions (2 + More… + Cancel = 4)
- [x] It now reserves a slot for "More…" when it is needed (2 actions with no Cancel, 1 action with Cancel), so the visible set never exceeds 3
- [x] Added an Android case to `tests/alert.test.ts` (now 7: never passes more than 3 buttons) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2071 passed`

## Phase 353: Device QA round 101 (detailed CSV export dropped a zero price)

- [x] **`watchlistToDetailedCsv` treated a price of 0 as missing**: it used `l.price ? String(l.price) : ""`, so a listing with a genuine 0 price exported an empty cell instead of `0` (the sibling `priceHistoryToCsv` already used a nullish check)
- [x] It now uses `typeof l.price === "number" ? String(l.price) : ""`
- [x] Added a case to `tests/csv.test.ts` (now 9: a 0 price exports as `0`) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2072 passed`

## Phase 354: Device QA round 102 (product card price-change badge used out-of-stock history)

- [x] **The watchlist product card's price-change badge mixed stock statuses**: it compared the current best orderable price against the oldest point of *any* listing's history (including out-of-stock), so an out-of-stock distributor's high historical price produced a fake drop — e.g. a 1000 out-of-stock point vs a 100 current best showed `▼ 90.0%`. The same class the all-time-low and price-vs-average checks already fixed
- [x] Extracted `computePriceChange` (`lib/price-change.ts`) which compares the current best against the historical minimum **in-stock** price (`bestPricePoints`), and used it in `components/watchlist/product-card.tsx`
- [x] Added `tests/price-change.test.ts` (3 cases: in-stock minimum, out-of-stock ignored, no orderable price) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2075 passed`

## Phase 355: Device QA round 103 (scheduled reminders lost their Android channel)

- [x] **`scheduleBackOrderReminder`'s DATE trigger omitted `channelId`**: Phase 252 correctly removed the ineffective `content.channelId` (Android reads the channel from the trigger) but never added `channelId` to the DATE trigger itself — so a scheduled reminder landed on the fallback channel with no HIGH importance/sound/vibration, unlike every immediate notification
- [x] The DATE trigger now carries `channelIdFor("stock")` on Android
- [x] Added a case to `tests/android-channel-trigger.test.ts` (now 4: the DATE trigger carries the channelId; also fixed the permission mock to return `status: "granted"`) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2076 passed`

## Phase 356: Device QA round 104 (triggered alert card rendered "→ $0.00")

- [x] **The triggered-alert card rendered a zero triggered price**: a server-detected trigger can store `triggeredPrice: 0` (the digest's `alertTargetsHit` already guards `> 0` for exactly this reason), but the card only checked `!= null`, so it showed `→ $0.00` next to the real target price
- [x] It now requires `alert.triggeredPrice > 0` before rendering the triggered price
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 61) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2077 passed`

## Phase 357: Device QA round 105 (digest targets-hit list had duplicate React keys)

- [x] **The digest "Targets Hit" list keyed rows on `productId`**: `computeDigest` emits one `alertTargetsHit` entry per triggered alert, and a product can have several triggered alerts, so two rows shared a `productId` and React logged duplicate-key warnings (and could mis-reconcile). Both the mobile `DigestCard` and the desktop Stats digest rendered `key={t.productId}`
- [x] `alertTargetsHit` entries now carry the unique `alertId`, and both renderers key on it
- [x] Added a case to `tests/price-digest.test.ts` (now 31: two triggered alerts for one product get distinct alertIds) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2078 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 358: Device QA round 106 (drop-calendar list had duplicate React keys)

- [x] **The drop-calendar's drop list keyed rows on `productId-from-to`**: two distributors for the same product can have identical from/to values (e.g. both 100→90), producing duplicate React keys in both the mobile `DropCalendarCard` and the desktop Stats drop list. `DropEvent` already carries a unique `distributorId`
- [x] Both renderers now key on `productId-distributorId-from-to`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 62) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2079 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 359: Device QA round 107 (a malformed product aborted the whole sync)

- [x] **`serializeItem`/`applyLocalItem` assumed `listings`/`priceHistory` were always arrays**: a corrupt or legacy stored product (or a pulled product) lacking `listings` made `product.listings.map(...)` throw. `collectDirty` is not per-item guarded, so the throw aborted the entire sync pass (not just that item) — every other module defensively uses `?? []`
- [x] Both functions now use `(product.listings ?? [])`, `(l.priceHistory ?? [])`, and `(existing.listings ?? [])`
- [x] Added 2 cases to `tests/sync-engine.test.ts` (now 34: serialize and apply a product with no listings) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2081 passed`

## Phase 360: Device QA round 108 (two screens used a bare back() that no-ops on deep links)

- [x] **`restock-watches.tsx` and `distributor-analysis.tsx` used bare `router.back()`**: a deep-linked cold start (web URL, notification tap) lands with no navigation history, where `router.back()` silently does nothing — the back button appeared dead. Every other screen uses `goBackOrHome`, which falls back to a safe route
- [x] Both now call `goBackOrHome(router, "/(tabs)/alerts")` / `goBackOrHome(router, "/(tabs)/watchlist")`
- [x] Added 2 guards to `tests/mobile-criticals.test.ts` (now 64) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2083 passed`

## Phase 361: Device QA round 109 (unknown health status produced a NaN sparkline)

- [x] **`computeHealthStats` mapped an unknown status to `undefined`**: `STATUS_VALUE[s.status]` has no fallback, so a corrupt sample with a status outside `working|blocked|error` (the stored history isn't shape-validated) produced `undefined` in the sparkline. The desktop `HealthSparkline` then computed `y = pad + (1 - v) * usableH` = NaN, emitting a malformed SVG polyline
- [x] The lookup now falls back to `0`
- [x] Added a case to `tests/scrapers/health.test.ts` (now 65: an unknown status maps to 0, all sparkline values finite) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2084 passed`

## Phase 362: Device QA round 110 (invalid sample timestamp collapsed the health timeline)

- [x] **`timelineSegments` produced NaN weights for an invalid timestamp**: with a corrupt sample whose `at` doesn't parse, `total` is NaN, `NaN <= 0` is false, and `Math.min(Math.max(NaN, 0), 1)` is still NaN — so every segment's `flex: NaN` made the health timeline strip collapse (mobile and desktop)
- [x] It now treats a non-finite span as a flat distribution (`!Number.isFinite(total) || total <= 0`)
- [x] Added a case to `tests/scrapers/health.test.ts` (now 66: invalid timestamps fall back to equal weights) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2085 passed`

## Phase 363: Device QA round 111 (a restock storage failure skipped the digest)

- [x] **`checkRestocks` could reject and abort the rest of `runPriceCheckCore`**: `runCheckRestocks` starts with `storage.getStockWatches()`, which rethrows adapter failures, and `checkRestocks` had no catch. `runPriceCheckCore` awaits it before sending the scheduled digest, so a storage read failure skipped the digest entirely — despite the comment calling the restock check "independent"
- [x] `checkRestocks` now catches and logs, resolving instead of rejecting
- [x] Added a case to `tests/restock.test.ts` (now 9: resolves when a storage read fails) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2086 passed`

## Phase 364: Device QA round 112 (health event uploads rejected unhandled)

- [x] **`uploadHealthEventToServer` rejections were unhandled**: its `run` reads and writes `pending_health_events` (which rethrows adapter failures), and both callers in `lib/background-tasks/health-alerts.ts` used `void uploadHealthEventToServer({...})` with no `.catch` — so a storage failure became an unhandled rejection
- [x] Both call sites now `.catch` and log
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 65) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2087 passed`

## Phase 365: Device QA round 113 (live-price persists rejected unhandled)

- [x] **Three `void updateProductListings(...)` sites in `hooks/use-live-prices.ts` had no catch**: `updateProductListings` rethrows adapter failures (its `enqueue` read/write), so a storage failure in `loadSeed`'s sample seed, the product persist debounce, or the watchlist persist effect became an unhandled rejection
- [x] All three now `.catch(() => {})`; the test mock for `updateProductListings` was updated to resolve (not return `undefined`) so it matches production and the `.catch` chain works
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 66) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2088 passed`

## Phase 366: Device QA round 114 (removing a product left its reminders' notifications scheduled)

- [x] **The removal cascade deleted reminders/watches without cancelling their scheduled notifications**: Phase 344 made `removeFromWatchlist` delete a product's back-order reminders and stock watches, but each carries a `notificationId` for an OS-scheduled notification. Deleting the row left the notification scheduled, so it still fired later with no corresponding reminder/watch
- [x] The cascade now cancels each removed reminder's/watch's `notificationId`. To avoid a static `storage ↔ notifications` import cycle (notifications imports the storage barrel) and keep expo-notifications out of the server/tests, the canceller is injected via `createStorage(adapter, { cancelNotification })`; the default instance supplies a lazy implementation
- [x] Added a case to `tests/storage.test.ts` (now 73: the cascade cancels the removed reminders'/watches' notifications) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2089 passed`

## Phase 367: Device QA round 115 (remote reminder tombstone left its notification scheduled)

- [x] Follow-up to Phase 366: the sync engine's `removeLocalItem` removed a reminder/watch by id with a bare `updateReminders`/`updateStockWatches` filter, so a reminder deleted on another device (arriving as a tombstone) left its scheduled OS notification firing here
- [x] Added `removeReminderById`/`removeStockWatchById` storage primitives (which cancel the notification first) and used them in the sync tombstone path
- [x] Added a case to `tests/sync-engine.test.ts` (now 35: a remote reminder tombstone cancels its notification) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2090 passed`

## Phase 368: Device QA round 116 (data wipe left all scheduled notifications firing)

- [x] **`clearAllData`/`clearAccountData` wiped reminders/watches without cancelling their notifications**: both remove the `REMINDERS`/`STOCK_WATCHES` keys, but every reminder/watch carries a scheduled OS notification that stayed scheduled — so after "Delete Account & Data" (or sign-out's account clear) the old reminders still fired
- [x] Added `cancelAllNotifications` (wraps `cancelAllScheduledNotificationsAsync`) in `lib/notifications.ts`, injected into `createStorage` like `cancelNotification`, and called it at the start of both wipes
- [x] Added a case to `tests/storage.test.ts` (now 74: clearAllData cancels scheduled notifications) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2091 passed`

## Phase 369: Device QA round 117 (desktop reconcile omitted the stale-event guard)

- [x] **Desktop `reconcileEvent` called `deactivateAlert` without the event time**: mobile passes `event.createdAt` so a stale server event cannot re-deactivate a freshly re-armed alert (the shared `deactivateAlert`'s third arg). Desktop omitted it, so a re-armed alert could be immediately re-triggered by an old event. It also only handled `price_drop`, not `price_rise`
- [x] Desktop now passes `event.createdAt` and handles both `price_drop` and `price_rise`
- [x] Updated the desktop test fixtures whose pulled-event `createdAt: 123` (1970) is now correctly rejected by the guard, and added a guard to `tests/desktop-chart-guard.test.ts` (now 26) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2092 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 370: Device QA round 118 (desktop only treated price_drop as stale)

- [x] Follow-up to Phase 369: desktop's `stalePriceDrop` check only matched `event.type === "price_drop"`, while mobile's `staleFired` checks both `price_drop` and `price_rise` — so a stale price_rise event for an inactive alert still fired a desktop notification
- [x] Desktop now treats both directions as stale
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 27) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2093 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 371: Device QA round 119 (desktop crashed on a listing with no price history)

- [x] **Desktop accessed `listing.priceHistory.<method>` without the `?? []` guard mobile uses**: a corrupt or legacy stored listing (missing the field) made `listing.priceHistory.forEach`/`.map`/`.flatMap` throw, crashing the whole page. Reachable in desktop Stats (the price-history chart), Watchlist (`getTrend` + the row sparkline), the distributor history modal's CSV export, and ProductDetail's best-listing sparkline. Mobile already guards every one of these (Phase 359 fixed the same class in sync)
- [x] All desktop accesses now use `(listing.priceHistory ?? [])`, and `Compare.getTrend` accepts `undefined`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 28) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2094 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 372: Device QA round 120 (desktop rendered a zero triggered price as "$0.00")

- [x] **Desktop's triggered-alert row rendered `alert.triggeredPrice ?? alert.targetPrice`**: a server-detected trigger can store `triggeredPrice: 0` (the digest's `alertTargetsHit` and the mobile `TriggeredAlertCard` both guard `> 0` for exactly this reason), but `??` doesn't fall back on 0, so the row showed "Triggered at $0.00" instead of the target price
- [x] Desktop now uses `alert.triggeredPrice && alert.triggeredPrice > 0 ? alert.triggeredPrice : alert.targetPrice`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 29) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2095 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 373: Device QA round 121 (desktop showed suspension-poisoned health response times)

- [x] **Desktop rendered raw `responseTimeMs` in the health views**: a probe that spans an Android suspension records the suspension duration (minutes, not milliseconds), and mobile sanitizes it via `sanitizeResponseTimeMs` (Phase 262). Desktop's Health list (`h.responseTimeMs ? ...`) and HealthDetail sample rows (`s.responseTimeMs ? ...`) printed the poisoned value verbatim
- [x] Both desktop views now use `sanitizeResponseTimeMs(...) != null` before rendering
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 30) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2096 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 374: Device QA round 122 (desktop drop calendar skipped the DST spring-forward day)

- [x] **Desktop built the drop-calendar day keys with fixed 24h steps** (`dateKey(now - i * 24 * 60 * 60 * 1000)`): a spring-forward day is only 23h long, so from a near-midnight anchor the loop jumps over it — the day's cell was missing and its drops were invisible. Mobile's `buildGridCells` deliberately uses calendar-date arithmetic (`setDate`) for exactly this reason (its DST test existed but was vacuous in a no-DST zone)
- [x] Extracted a shared `buildDayKeys(days, now)` in `lib/drop-calendar.ts` using calendar-date arithmetic; desktop Stats now uses it
- [x] Pinned `process.env.TZ = "America/New_York"` in `tests/drop-calendar-dst.test.ts` (the existing test was vacuous under UTC/Asia/Bangkok) and added a `buildDayKeys` case — verified non-vacuous by reverting the helper to the fixed-24h loop
- [x] Added a desktop guard to `tests/desktop-chart-guard.test.ts` (now 31); E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2098 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 375: Device QA round 123 (desktop compare chart blanked on an invalid date)

- [x] **Desktop's Compare chart pushed `new Date(p.date).getTime()` into `allDates` without filtering `NaN`**: one corrupt/legacy price point with an unparseable date made `Math.min`/`Math.max` return `NaN`, so `minDate`/`dateRange` were `NaN` and every x-coordinate was `NaN` — the whole multi-distributor chart rendered blank. Mobile's `MultiLineChart` filters `if (!Number.isNaN(t))` for exactly this reason
- [x] Desktop now filters invalid dates when building `allDates` (and returns the "No data" state when none remain) and skips invalid-date points when building each series' coords
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 32) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2099 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 376: Device QA round 124 (mobile "Lowest Price Ever" badge compared mixed currencies)

- [x] **Mobile's `BestDistributorCard` "Lowest Price Ever" check hardcoded USD** for both the prior-history minimum and the current price (`convertPrice(..., "USD")`), while the rest of the card renders in `displayCurrency`. For a EUR/GBP user the badge compared mixed units and could show or hide incorrectly. Desktop was explicitly fixed for the same bug in QA round 35 (its `isLowestEver` uses `displayCurrency`)
- [x] Mobile now converts both the history points and the current price in `displayCurrency`, and depends on it in the `useMemo`
- [x] Added a guard to `tests/mobile-criticals.test.ts` (now 67) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2100 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 377: Device QA round 125 (desktop views bypassed the live FX-rate overlay)

- [x] **Four desktop views imported `convertPrice`/`getBestPrice` from `@shared/currency`** (static `EXCHANGE_RATES`), bypassing the live-rate overlay that `lib/currency.ts` applies via `setExchangeRates` (loaded on desktop launch through `loadFxRates`). Mobile and desktop's own Home/Compare use `@/lib/currency`, so Watchlist (sort + row best price), Stats (price-history chart), ProductDetail, and `PriceHistoryChart` disagreed with the rest of the app once live rates loaded — wrong best-price ordering and converted values
- [x] All four now import `convertPrice`/`getBestPrice` from `@/lib/currency` (formatting/constants still come from `@shared/currency`)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 33) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2101 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 378: Device QA round 126 (desktop showed recovered health events as outages)

- [x] **Desktop's notification list always rendered health events with the red warning icon and color**, ignoring `healthStatus === "recovered"` — so a "distributor recovered" event looked like an ongoing outage. Mobile's `NotificationCenter` uses `healthIcon`/`healthColor` to show a green checkmark for recoveries
- [x] Desktop now picks `CircleCheck` and the emerald styling when `n.type === "health" && n.healthStatus === "recovered"`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 34) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2102 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 379: Device QA round 127 (desktop health list miscolored blocked-classified reasons)

- [x] **Desktop's health list colored every row by its raw status** (`statusColors[h.status]`), while mobile's `resolveStatusColor` (app/health.tsx) shows amber whenever the row's `reason` classifies as a block via `classifyFetchStatus` — e.g. a Cloudflare interstitial recorded with status `error`/`working` was shown as a hard red failure instead of a block
- [x] Desktop now has a `resolveStatusColor` that mirrors mobile (status `blocked`, or a reason that classifies as blocked → amber) and uses it for the dot, uptime text, and sparkline
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 35) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2103 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 380: Device QA round 128 (desktop digest notifications weren't clickable)

- [x] **Desktop's notification list built its route inline and never handled `type === "digest"`** (mobile's `notificationRouteFor` sends digest events to `/stats`), and it dropped health events that lacked a `distributorId` — so those rows rendered as non-clickable `<div>`s instead of links
- [x] Desktop now routes `digest` → `/stats` and health events without a distributor → `/health`, matching mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 36) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2104 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 381: Device QA round 129 (desktop Stats chart caption lied about "Top 3 by value")

- [x] **Desktop Stats' price-history chart took `products.slice(0, 3)`** (watchlist order) while its caption read "Top 3 of N by value" — so the chart showed the first three products, not the three most valuable. Now ranks by best price descending before slicing (and derives the distributor legend from the same set)
- [x] Added a guard to `tests/desktop-stats-parity.test.ts` (now 3) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2105 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 382: Device QA round 130 (desktop bulk import aborted on the first storage failure)

- [x] **Desktop's bulk import (`Search.tsx` and `SearchModal.tsx`) used a plain `for` loop with no per-item error handling**: one `addToWatchlist` rejection aborted the whole import as an unhandled rejection, and the success toast still claimed every product was imported. Mobile's `BulkImportModal` uses `Promise.allSettled` and reports skipped items
- [x] Both desktop call sites now use `Promise.allSettled`, mark only the fulfilled writes as tracked, and report `Imported N · M failed`
- [x] Added a guard to `tests/desktop-search-chrome-guard.test.ts` (now 4) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2107 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 383: Device QA round 131 (desktop watchlist sort threw / misordered on malformed products)

- [x] **Desktop's watchlist sort called `a.name.localeCompare(b.name)` and `new Date(a.lastRefreshed ?? a.addedAt).getTime()` directly**: a product with no name threw, and an invalid date produced a `NaN` comparator (implementation-defined ordering). Mobile's `sortWatchlist` guards both (`(a.name ?? "").localeCompare(...) || a.id.localeCompare(b.id)` and `Date.parse(...) || 0`)
- [x] Desktop's `name` sort now uses the `?? ""` guard with an id tiebreak, and `lastUpdated` uses `Date.parse(...) || 0` with an id tiebreak
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 37) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2108 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 384: Device QA round 132 (desktop compare price sort mixed currencies)

- [x] **Desktop's Compare price sort and "Best Price" card fell back to the raw price when a listing's currency couldn't be converted** (`convertPrice(...) ?? a.price`), so an unrated-currency listing was compared by its raw magnitude against converted ones — a wrong "best price" and order. Mobile's `sortedListings` returns `null` for unconvertible listings and sorts them last
- [x] Desktop's price sort now null-checks (`pa === null → 1`, `pb === null → -1`) and the `cheapest` card filters out unconvertible listings instead of using the raw price
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 38) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2109 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 385: Device QA round 133 (desktop "Lowest Price Ever" badge lied on unconvertible history)

- [x] **Desktop's `isLowestEver` mapped unconvertible prior points to `Infinity`** (`convertPrice(...) ?? Infinity`), so a history whose points all lacked a rate produced `priorMin = Infinity` and the badge claimed "Lowest Price Ever" for any current price. Mobile's `BestDistributorCard` filters nulls and returns false when none remain
- [x] Desktop now filters unconvertible prior points and returns false when none remain; the compare selection sort (`withHistory`) also no longer falls back to the raw price (same mixed-currency class as round 132)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 39) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2110 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 386: Device QA round 134 (desktop Home reminders stat understated the Alerts tab)

- [x] **Desktop Home's "Reminders" stat counted only date reminders** (`getBackOrderReminders().length`), but the Alerts tab it navigates to shows `reminders.length + watches.length` — so the dashboard card disagreed with its destination whenever stock watches existed
- [x] Desktop Home now loads stock watches too and sets `reminderCount = reminders.length + stockWatches.length`, matching the Alerts tab
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 40) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2111 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 387: Device QA round 135 (desktop Stats vanished the digest card before the first digest)

- [x] **Desktop Stats computed the digest against a null snapshot** (`computeDigest(snapshot, ...)` with `snapshot === null`), so before the first digest was delivered every product was reported as "new", and when the digest was enabled but no snapshot existed the whole card rendered nothing. Mobile returns `null` and shows a "Digest scheduled" placeholder (only when the watchlist is non-empty)
- [x] Desktop now computes the digest only when a snapshot exists (`snapshot ? computeDigest(...) : null`) and renders a "Digest scheduled" placeholder otherwise
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 41) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2112 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 388: Device QA round 136 (desktop server notifications skipped non-catalog products)

- [x] **Desktop's server-notification upload omitted `modelNumber`** for alerts, stock watches, and date reminders. The server resolves prices by model number and only knows the static catalog (`build-events.ts`: `alert.modelNumber ?? product?.modelNumber`), so manually added / rediscovered products got no server-side notifications. Mobile sends the model for every referenced product (with an explicit comment)
- [x] Desktop now builds a `modelByProductId` map from the watchlist and includes `modelNumber` on all three upload arrays; the `PushConfig` type and the desktop health-probe test mock were updated
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 42) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2113 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 389: Device QA round 137 (desktop edit modal didn't warn on a model change)

- [x] **Desktop's Edit Product modal gave no feedback when the model number changed**, while mobile's `EditProductSheet` shows "Model changed — listings will re-match on next refresh." — so a desktop user could rename the model and not know the listings would be re-matched
- [x] Desktop now shows the same amber warning under the Model field when `editModel.trim() !== (product.modelNumber ?? "")`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 43) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2114 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 390: Device QA round 138 (desktop edit modal saved a blank model)

- [x] **Desktop's Edit Product Save button only required a non-empty name** (`!editName.trim()`), while mobile's `EditProductSheet` requires both name and model (`canSave`). `updateProductDetails` only applies a trimmed non-empty model, so saving a blank model silently kept the old one while the UI implied it changed
- [x] Desktop now disables Save unless both name and model are non-empty, and `handleSaveEdit` guards the same condition
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 44) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2115 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 391: Device QA round 139 (desktop re-deleted re-created watches on an event replay)

- [x] **Desktop's server-notification pull never tracked displayed event ids**, so it re-ran `reconcileEvent` for every pulled event on every sync. A replay (the server can return the same event again) then deleted a stock watch / reminder the user had re-created after the first delivery. Mobile tracks `displayedIds`, marks an event only when it was actually shown, and skips reconciliation for already-delivered events
- [x] Desktop now loads `getDisplayedEventIds()`, records `recordDisplayedEventId` only when `sendDesktopNotification` returns true, and skips `reconcileEvent` for already-displayed events; the desktop health-probe test mock was updated
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 45) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2116 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 392: Device QA round 140 (desktop restock events never reached the Alerts tab)

- [x] **`lib/restock.ts` recorded the restock notification through the module-level default store** (`await import("./storage")`), not the injected `storage` the desktop passes. The module default resolves to IndexedDB in a Tauri webview — a different store from the desktop UI's localStorage — so a desktop restock fired the OS notification but the event never appeared in the Alerts tab (and the unread count stayed wrong)
- [x] `RestockStorage` now requires `recordNotificationEvent`, and the restock history write uses the injected `storage`; the `tests/restock.test.ts` mock was updated
- [x] Added a test asserting the injected store receives the event — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2117 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 393: Device QA round 141 (desktop alert modal had no price suggestions)

- [x] **Desktop's Set Price Alert modal had no suggested target prices**, while mobile's `PriceAlertModal` renders chips from `suggestAlertPrices` (Near low / Below avg / Under current) that fill the target field — so a desktop user had to type a price blind
- [x] Desktop now computes `alertSuggestions` from `suggestAlertPrices(product.listings, alertCurrency)` and renders the same chips above the Target Price input
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 46) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2118 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 394: Device QA round 142 (desktop Distributor Targets omitted the product-wide footer)

- [x] **Desktop's Distributor Targets section showed neither the product-wide alert footer nor the empty-state hint**, while mobile's `TargetTableCard` renders "Any distributor · target …" when a product-wide alert exists and "Set per-distributor targets with + to compare them here." when none do — so a desktop user couldn't tell a product-wide alert was active
- [x] Desktop now renders both, using `productWideAlert` / `scopedAlertFor`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 47) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2119 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 395: Device QA round 143 (desktop product note had no length cap)

- [x] **Desktop's product-note textarea had no `maxLength`**, while mobile's `NotesCard` caps the note at `maxLength={500}` — a desktop user could paste an unbounded note into the shared `product_notes` store
- [x] Desktop's note textarea now sets `maxLength={500}`, matching mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 48) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2120 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 396: Device QA round 144 (desktop device rename had no length cap)

- [x] **Desktop's device-rename input had no `maxLength`**, while the server caps labels at 64 (`z.string().min(1).max(64)`) and mobile's `RenameDeviceModal` sets `maxLength={64}` — a longer desktop label made the rename mutation fail
- [x] Desktop's rename input now sets `maxLength={64}`, matching mobile and the server cap
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 49) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2121 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 397: Device QA round 145 (desktop restock watches skipped the permission check)

- [x] **Desktop's `handleWatchRestock` and `handleToggleListingWatch` created restock watches without checking notification permission**, while mobile's `handleToggleStockWatch` calls `ensureNotificationPermission` first — so a desktop user with notifications denied got a saved watch that could never fire a notification
- [x] Both desktop handlers now call `checkNotificationPermission` and toast "Enable notifications to watch for restocks." when denied; widened the existing double-submit guard's slice window
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 50) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2122 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 398: Device QA round 146 (desktop compare cross-alert skipped the permission check)

- [x] **Desktop's `handleCrossAlert` (compare screen) created a cross-distributor price alert without checking notification permission**, while mobile's compare flow calls `ensureNotificationPermission` first — so a desktop user with notifications denied got an alert that could never notify
- [x] Extracted the desktop permission check to `desktop/src/lib/notification-permission.ts` (ProductDetail re-exports it) and gated `handleCrossAlert` on it
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 51) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2123 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 399: Device QA round 147 (desktop "Test notification" didn't test the real path)

- [x] **Desktop's "Test notification" button only called `displayWebNotification`**, which is a no-op in a Tauri webview (`isWeb()` is false) — so it could report "Test notification sent" without anything being shown, and never exercised the `sendDesktopNotification` Tauri path real alerts use
- [x] Desktop's test handler now calls `sendDesktopNotification` (Tauri native, falling back to the web Notification API) and reports success/failure from its result; dropped the now-unused imports
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 52) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2124 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 400: Device QA round 148 (desktop stock watches lacked the "Watching" badge)

- [x] **Desktop's Stock Watches rows showed only the status badge**, while mobile's `StockWatchCard` also renders a "👀 Watching" badge — so a desktop user couldn't tell a row was an active watch at a glance
- [x] Desktop's stock-watch rows now render the same "👀 Watching" badge
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 53) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2125 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 401: Device QA round 149 (desktop distributor analysis had no CSV export)

- [x] **Desktop's Distributor Analysis page had no export**, while mobile's `distributor-analysis` screen has an "Export CSV" button that writes `watchlistToDetailedCsv` — so a desktop user couldn't get the per-listing analysis out of the app
- [x] Desktop's page now has an "Export CSV" button (Tauri save dialog, browser download fallback) using `watchlistToDetailedCsv`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 54) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2126 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 402: Device QA round 150 (desktop compare had no CSV export)

- [x] **Desktop's Compare screen had only Share / Save image**, while mobile's `compare/[id]` has an "Export price history as CSV" button that writes `priceHistoryToCsv` — so a desktop user couldn't export the multi-distributor history
- [x] Desktop's Compare now has an "Export CSV" button (Tauri save dialog, browser download fallback) using `priceHistoryToCsv` over the sorted listings' history
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 55) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2127 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 403: Device QA round 151 (desktop Stats omitted freshness/stock-health rows)

- [x] **Desktop's Stats Data Freshness card omitted "Avg data points / listing"** and its Stock Health card omitted "Back-order everywhere", both of which mobile's `DataFreshnessCard` / `StockHealthCard` render — so a desktop user couldn't see those metrics
- [x] Desktop Stats now shows both rows
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 56) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2128 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 404: Device QA round 152 (desktop drop calendar drifted off weekday alignment)

- [x] **Desktop's drop-calendar grid laid 30 consecutive days into a 7-column grid with no leading blanks**, so the columns drifted off weekday alignment (a day in the "Monday" column wasn't Monday). Mobile's `buildGridCells` pads by the first day's weekday and renders a weekday header
- [x] Moved `buildGridCells` into `lib/drop-calendar.ts` (mobile re-exports it) and desktop Stats now uses it with the S–S weekday header
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 57) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2129 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 405: Device QA round 153 (desktop watchlist header had no Add Product button)

- [x] **Desktop's Watchlist header had no "Add Product" button**, while mobile's `WatchlistHeader` renders a primary + button that opens search — so a desktop user had no in-context way to add a product from the watchlist
- [x] Desktop's Watchlist header now has an "Add Product" button linking to `/search`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 58) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2130 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 406: Device QA round 154 (desktop mislabeled the watchlist summary "Total Value")

- [x] **Desktop labelled the watchlist summary "Total Value"**, but the shared `computeWatchlistSummary` sums every listing across all stock statuses — its own comment says it is NOT the basket value. Mobile correctly labels it "All Listings Value", so desktop's wording overstated the figure
- [x] Desktop now labels it "All Listings Value"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 59) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2131 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 407: Device QA round 155 (desktop basket card omitted its qualifier and excluded count)

- [x] **Desktop's Stats basket card was labelled just "Basket Value" and omitted the excluded count**, while mobile's `BasketValueCard` reads "Basket Value (best in-stock prices)" and appends "· N excluded (no stock)" — so a desktop user couldn't tell the figure used best in-stock prices or that some products were skipped
- [x] Desktop's basket card now shows the qualifier and the excluded count
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 60) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2132 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 408: Device QA round 156 (desktop stock-health header omitted the listing count)

- [x] **Desktop's dedicated Stock Health card header read just "Stock Health"**, while mobile's `StockHealthCard` header reads "Stock Health (N listings)" — so the desktop card didn't state its sample size
- [x] Desktop's Stock Health header now includes the listing count
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 61) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2133 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 409: Device QA round 157 (desktop digest card didn't state its period)

- [x] **Desktop's digest card header read just "Digest"**, while mobile's `DigestCard` header reads "Digest — {periodLabel}" ("this week" / "today") — so a desktop user couldn't tell the digest's window
- [x] Desktop's digest header now includes the period label from `digestFrequency`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 62) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2134 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 410: Device QA round 158 (desktop showed "Digest off" on an empty watchlist)

- [x] **Desktop showed the "Digest off" card even when the watchlist was empty**, while mobile's `digestPlaceholder` returns `null` for an empty watchlist so the whole digest card is hidden — the desktop card was noise before any products were tracked
- [x] Desktop now renders nothing for the digest card when `products.length === 0`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 63) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2135 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 411: Device QA round 159 (desktop Alerts tab omitted the active-alerts info banner)

- [x] **Desktop's Alerts tab showed no info banner when active alerts existed**, while mobile's Alerts tab renders "You'll be notified when a product's price drops below your target." — so a desktop user got no confirmation of what active alerts do
- [x] Desktop's `AlertsTab` now shows the same banner above the active alerts
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 64) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2136 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 412: Device QA round 160 (desktop reminders empty state had no CTA)

- [x] **Desktop's reminders empty state had no "Browse Products" CTA**, while mobile's reminders tab empty state links to search — so a desktop user with no reminders had no path forward
- [x] Desktop's reminders empty state now matches mobile (title "No reminders set", the "Remind me"/"Watch for Restock" hint, and a Browse Products button)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 65) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2137 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 413: Device QA round 161 (desktop search empty state had no suggestion hint)

- [x] **Desktop's search empty state showed only "No products found."**, while mobile's `SearchEmptyState` shows a "Try searching for RTX 4090, Pi 5, CRS326, or AirPods Max" hint (when no query/tags) — so a desktop user had no starting point
- [x] Desktop's empty state now shows the same suggestion hint (only when no query and no tag filter)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 66) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2138 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 414: Device QA round 162 (desktop hid Discover with AI when results existed)

- [x] **Desktop only showed "Discover with AI" when the catalog returned zero results**, while mobile shows the Discover footer whenever there is a query (even with partial matches) — so on desktop a query that matched the wrong catalog item couldn't be AI-discovered
- [x] Desktop now shows the Discover footer (and its error/loading states) for any non-empty query, matching mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 67) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2139 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 415: Device QA round 163 (desktop manual-add modal lacked mobile's title and hint)

- [x] **Desktop's manual-add modal was titled "Manual Add" with no hint**, while mobile's `ManualAddSheet` is titled "Add Custom Product ✨" with "Paste anything — a model number, product name, or a spec-sheet paragraph. AI cleans it up." — so a desktop user didn't know what the field accepted
- [x] Desktop's modal now uses the same title and hint
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 68) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2140 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 416: Device QA round 164 (desktop manual-add buttons didn't match mobile)

- [x] **Desktop's manual-add modal labelled the parse button "Parse with AI" and left the URL field unlabelled**, while mobile's `ManualAddSheet` uses "Clean up with AI" and "Paste distributor URL" — inconsistent wording between platforms
- [x] Desktop now uses "Clean up with AI" and adds the "Paste distributor URL" label; updated `desktop/tests/manual-add-ai.test.tsx` to the new button name
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 69) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2141 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 417: Device QA round 165 (desktop bulk-import modal title differed from mobile)

- [x] **Desktop's bulk-import modal was titled "Bulk Import"**, while mobile's `BulkImportModal` is titled "Import List 📋" — inconsistent wording between platforms
- [x] Desktop now uses "Import List 📋"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 70) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2142 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 418: Device QA round 166 (desktop search tag picker couldn't create tags)

- [x] **Desktop's search "Assign tags" modal only toggled existing tags**, while mobile's `TagPickerSheet` lets you create a new tag inline ("New tag name" + "Create tag") — so a desktop user with no tags had to leave search to create one
- [x] Desktop's search tag picker now has the inline "New tag name" input and "Create tag" button, adding the new tag to the pending selection
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 71) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2143 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 419: Device QA round 167 (desktop SearchModal tag picker couldn't create tags)

- [x] **The same inline-tag-creation gap existed in desktop's `SearchModal`** (the other search surface): it only toggled existing tags and pointed at the watchlist. Mobile's `TagPickerSheet` creates tags inline
- [x] Desktop's `SearchModal` tag picker now has the inline "New tag name" input and "Create tag" button; removed the now-unused `navigate` import and updated `tests/desktop-tags-pointer-guard.test.ts`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 72) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2144 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 420: Device QA round 168 (desktop alert row printed the raw direction enum)

- [x] **Desktop's alert row appended the raw `alert.direction` enum** ("drop"/"rise") as text, while mobile's `AlertCard` renders a direction arrow icon (up/red for rise, down/green for drop) — the desktop text was a leaked internal value
- [x] Desktop now renders the matching TrendingUp/TrendingDown icon with an accessible label
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 73) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2145 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 421: Device QA round 169 (desktop triggered alerts omitted the target and direction)

- [x] **Desktop's triggered alert row showed only "Triggered at $Y on DATE"**, while mobile's `TriggeredAlertCard` shows the direction arrow plus "Target: $X → $Y" — so a desktop user couldn't see what target the alert had or which direction it was
- [x] Desktop's triggered row now shows the direction icon, "Target: $X", and the "→ $Y" triggered price (still guarding a zero triggeredPrice)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 74) and updated the round-120 guard to the new markup — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2146 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 422: Device QA round 170 (desktop rearm button labelled "Rearm")

- [x] **Desktop's triggered-alert button said "Rearm"**, while mobile's `TriggeredAlertCard` button says "Watch Again" — inconsistent wording between platforms
- [x] Desktop's button now reads "Watch Again"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 75) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2147 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 423: Device QA round 171 (desktop reminders always said "Due")

- [x] **Desktop's reminder rows always read "Due {date}"**, while mobile's `ReminderCard` says "Was due {date}" for past reminders and "Remind on {date}" otherwise — so a desktop user couldn't tell a past-due reminder from an upcoming one at a glance
- [x] Desktop now uses the same "Was due "/"Remind on " labels
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 76) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2148 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 424: Device QA round 172 (desktop reschedule modal title lacked the emoji)

- [x] **Desktop's reschedule modal was titled "Reschedule Reminder"**, while mobile's `RescheduleModal` is titled "Reschedule Reminder 📅" — inconsistent wording between platforms
- [x] Desktop's title now includes the 📅 emoji
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 77) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2149 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 425: Device QA round 173 (desktop stock watches omitted the last-checked hint)

- [x] **Desktop's stock-watch rows showed only the status badge**, while mobile's `StockWatchCard` appends "· last checked" after the status — so a desktop user couldn't tell the status was a snapshot
- [x] Desktop's stock-watch rows now show the "· last checked" hint
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 78) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2150 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 426: Device QA round 174 (desktop listing freshness text wasn't color-coded)

- [x] **Desktop's Distributor Targets table rendered the freshness cell as plain gray text**, while mobile's `DistributorListingCard` colors it by freshness (green <1h, amber <6h, red older) and prefixes "🕐 Updated" — so a desktop user couldn't spot a stale listing
- [x] Desktop's cell now uses `getLastRefreshedColor` for the color and the "🕐 Updated" prefix
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 79) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2151 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 427: Device QA round 175 (desktop listing table omitted payment methods)

- [x] **Desktop's Distributor Targets table omitted each distributor's payment methods**, while mobile's `DistributorListingCard` shows "💳 Online Payment · Bank Transfer · …" per listing — so a desktop user couldn't see accepted payment methods per distributor
- [x] Desktop's Distributor cell now shows the payment methods; updated `desktop/tests/nav-header.test.tsx` (the text now appears twice)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 80) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2152 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 428: Device QA round 176 (desktop best-listing matcher mixed currencies)

- [x] **Desktop's `bestListing` matcher fell back to the raw price when a listing's currency couldn't be converted** (`convertPrice(...) ?? l.price`), so an unconvertible listing could falsely match the best price and be highlighted/marked best. Mobile's `bestInStockListing` skips unconvertible listings
- [x] Desktop now computes `converted` once and skips null (same class as rounds 132/133/135)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 81) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2153 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 429: Device QA round 177 (desktop Stats chart plotted mixed currencies)

- [x] **Desktop's Stats price-history chart fell back to the raw price for an unconvertible point** (`convertPrice(...) ?? pt.price`), plotting mixed currencies on a chart labelled in the display currency (same class as rounds 132/133/135/176)
- [x] Desktop's chart now skips unconvertible points instead of using the raw price
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 82) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2154 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 430: Device QA round 178 (desktop listing cell omitted the distributor region)

- [x] **Desktop's Distributor cell showed only "{country} {flag}"**, while mobile's `DistributorListingCard` shows "{country} · {region}" — so a desktop user couldn't see a distributor's region
- [x] Desktop's cell now includes the region
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 83) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2155 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 431: Device QA round 179 (desktop re-enable left the circuit breaker armed)

- [x] **Desktop's `handleReenableDistributor` only refreshed `lastChecked` and never cleared the circuit breaker**, so the distributor stayed in cooldown (still skipped by the health probe) while the UI showed "OK". Mobile clears it via `clearDistributorBreaker` with an explanatory comment. The shared helper also used `getDefaultAdapter()` (IndexedDB in a Tauri webview), a different store from the desktop probe's localStorage adapter
- [x] `clearDistributorBreaker` now accepts an optional adapter; desktop passes a localStorage adapter matching its health probe
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 84) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2156 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 432: Device QA round 180 (desktop reminder modal title lacked the emoji)

- [x] **Desktop's reminder date-picker modal was titled "Set Reminder"**, while mobile's `ReminderDatePickerModal` is titled "Set Reminder 📅" — inconsistent wording between platforms
- [x] Desktop's title now includes the 📅 emoji
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 85) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2157 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 433: Device QA round 181 (desktop edit-product modal title differed from mobile)

- [x] **Desktop's edit-product modal was titled "Edit product"**, while mobile's `EditProductSheet` is titled "Edit Product ✏️" — inconsistent wording between platforms
- [x] Desktop's title now reads "Edit Product ✏️"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 86) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2158 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 434: Device QA round 182 (desktop distributor alert modal had no suggestions)

- [x] **Desktop's dedicated "Set Distributor Alert" modal had no suggested target prices**, while mobile's per-distributor target flow reuses the shared `PriceAlertModal` (which shows the Near low / Below avg / Under current chips) — so a desktop user had to type a target blind
- [x] Desktop's modal now shows per-listing suggestion chips computed in the modal's currency (`perListingAlertSuggestions`)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 87) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2159 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 435: Device QA round 183 (desktop note placeholder didn't say it was device-local)

- [x] **Desktop's product-note placeholder read "Add a note about this product…"**, while mobile's `NotesCard` uses "Private note (only visible on this device)…" — so a desktop user didn't know the note is device-local
- [x] Desktop's placeholder now matches mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 88) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2160 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 436: Device QA round 184 (desktop empty-note text differed from mobile)

- [x] **Desktop's empty product-note state read "No note yet."**, while mobile's `NotesCard` shows "Add a private note…" (a call to action) — inconsistent wording between platforms
- [x] Desktop's empty state now reads "Add a private note…"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 89) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2161 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 437: Device QA round 185 (desktop last-refreshed text wasn't color-coded)

- [x] **Desktop's header showed "Updated {time}" in plain gray**, while mobile's `ProductInfoCard` shows "Last refreshed: {time}" colored by freshness (`getLastRefreshedColor`) — so a desktop user couldn't see whether the data was stale
- [x] Desktop's header now shows "Last refreshed: …" colored by freshness
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 90) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2162 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 438: Device QA round 186 (desktop header omitted the Distributors/In Stock stats)

- [x] **Mobile's `ProductInfoCard` shows a "Distributors / In Stock / Best Price" stats row**, while desktop's header only had the Best Price card — so a desktop user couldn't see how many distributors were listed or how many were in stock
- [x] Desktop's header now shows the same three-stat row; updated `desktop/tests/best-price-signals.test.tsx` for the now-duplicated "Best Price" label
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 91) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2163 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 439: Device QA round 187 (desktop header omitted the product region)

- [x] **Mobile's `DetailHeader` shows the product region** (the best deal's distributor region, else the first listing's), while desktop's header omitted it — so a desktop user couldn't see where the product ships from
- [x] Desktop's header now shows the region (using `DISTRIBUTORS.find`, matching the file's convention)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 92) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2164 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 440: Device QA round 188 (desktop empty region state had no Show All)

- [x] **Desktop's empty region state showed only "No distributors in {region}."**, while mobile's `DistributorListingSection` offers a "Show All" button that resets the region filter — so a desktop user had to find the filter control to recover
- [x] Desktop's empty state now offers the "Show All" button
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 93) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2165 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 441: Device QA round 189 (desktop compare silently ignored the 5-distributor cap)

- [x] **Desktop's compare distributor toggle silently ignored a click once 5 were selected**, while mobile's `toggleSelect` shows "You can compare up to 5 distributors" — so a desktop user couldn't tell why the selection wouldn't grow
- [x] Desktop now warns (via `handleToggleSelect`, avoiding a side effect inside the state updater) when the cap is reached
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 94) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2166 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 442: Device QA round 190 (desktop labeled the section "Price Drop History")

- [x] **Desktop's triggered-alert section header read "Price Drop History (N)"**, while mobile's alerts tab reads "Alert History (N)" — the section also holds rise alerts, so the desktop label was inaccurate
- [x] Desktop's header now reads "Alert History (N)"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 95) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2167 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 443: Device QA round 191 (desktop reminder headers lacked counts)

- [x] **Desktop's reminder sections were headed "Date Reminders" and "Stock Watches" without counts**, while mobile's alerts tab reads "Date Reminders (N)" and "Watching for Restock (N)" — so a desktop user couldn't tell how many were in each section, and "Stock Watches" differed from mobile's wording
- [x] Desktop's headers now read "Date Reminders ({n})" and "Watching for Restock ({n})"; updated `desktop/tests/ux-alignment.test.tsx` and `desktop/tests/nav-header.test.tsx` for the new text
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 96) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2168 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 444: Device QA round 192 (desktop alerts empty-state copy differed from mobile)

- [x] **Desktop's alerts empty state read "No price alerts" / "Set price alerts from product details…"**, while mobile's is "No alerts set" / 'Open a product and tap "Set Alert"…' — inconsistent wording between platforms
- [x] Desktop's empty state now matches mobile; updated `desktop/tests/ux-alignment.test.tsx`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 97) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2169 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 445: Device QA round 193 (desktop Home empty state differed from mobile)

- [x] **Desktop's Home empty state read "No products tracked" with "Add products to your watchlist to see your dashboard."**, while mobile's says "No products tracked yet" with "Tap + to add a product… across 25 distributors" plus a "Try: RTX 4090, Pi 5, CRS326, or U7 Pro Max" hint — desktop lacked the discovery hint
- [x] Desktop's Home empty state now matches mobile (title, description, and hint)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 98) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2170 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 446: Device QA round 194 (desktop empty-state CTA labels differed from mobile)

- [x] **Desktop used "Add Products" for both the Home and Stats empty-state CTAs**, while mobile uses "Add Product" (Home) and "Browse Products" (Stats) — inconsistent wording between platforms
- [x] Desktop Home's CTA now reads "Add Product" and Stats' reads "Browse Products"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 99) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2171 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 447: Device QA round 195 (desktop settings section titled "Share Watchlist")

- [x] **Desktop's settings section was titled "Share Watchlist"**, while mobile's settings section is "Collaborative Watchlist" — inconsistent wording between platforms
- [x] Desktop's section now reads "Collaborative Watchlist"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 100) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2172 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 448: Device QA round 196 (desktop settings section titled "Data Management")

- [x] **Desktop's data section was titled "Data Management"**, while mobile's `DataSection` is titled "Data" — inconsistent wording between platforms
- [x] Desktop's section now reads "Data"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 101) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2173 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 449: Device QA round 197 (desktop account-deletion button casing differed)

- [x] **Desktop's account-deletion button read "Delete account & data"**, while mobile's `AccountSection` button reads "Delete Account & Data" — inconsistent casing between platforms
- [x] Desktop's button now reads "Delete Account & Data"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 102) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2174 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 450: Device QA round 198 (desktop notification toggles lacked descriptions)

- [x] **Desktop's Stock Alerts and Price Alerts rows had no descriptions**, while mobile's notification rows describe each type ("Notify when item comes in stock" / "Notify when price drops below target") — so a desktop user couldn't tell what each toggle did
- [x] Desktop's Stock/Price Alerts rows now show the same descriptions (Health Alerts already had one)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 103) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2175 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 451: Device QA round 199 (desktop "Test notification" casing differed)

- [x] **Desktop's test-notification button read "Test notification"**, while mobile's notifications section row is labeled "Test Notification" — inconsistent casing between platforms
- [x] Desktop's button now reads "Test Notification"
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 104) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2176 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 452: Device QA round 200 (desktop connection button casing differed)

- [x] **Desktop's connection check button read "Check now"**, while mobile's `ConnectionSection` reads "Check Now" — inconsistent casing between platforms
- [x] Desktop's button now reads "Check Now"; updated `tests/desktop-p3b1-settings.test.ts`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 105) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2177 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 453: Device QA round 201 (desktop backup button labels differed)

- [x] **Desktop's backup buttons read "Export full backup" / "Import backup"**, while mobile's data section reads "Export Backup" / "Import Backup" — inconsistent wording between platforms
- [x] Desktop's buttons (and their aria-labels) now read "Export Backup" / "Import Backup"; updated `tests/desktop-backup.test.ts`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 106) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2178 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 454: Device QA round 202 (desktop data buttons had no descriptions)

- [x] **Desktop's data buttons had no descriptions**, while mobile's `DataSection` rows describe each action ("Save watchlist, alerts and settings to a file" / "Restore from a backup file (merges by id)" / "Save watchlist as CSV (prices in display currency)") — so a desktop user couldn't tell what each button did
- [x] Desktop's Export CSV / Export Backup / Import Backup buttons now carry the descriptions as `title` tooltips
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 107) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2179 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 455: Device QA round 203 (desktop hardcoded legal links on an unregistered domain)

- [x] **Desktop hardcoded the Privacy Policy URL (`https://productstockfinder.app/privacy`) and support email (`support@productstockfinder.app`)**, while mobile derives them via `getPrivacyPolicyUrl()` / `getSupportMailtoUrl()` — `lib/legal-links.ts` warns that domain "may not be registered" and the real support address is `support@productstockfinder.savvylife.icu`, so the desktop links were likely dead
- [x] Desktop now uses `getPrivacyPolicyUrl()` / `getSupportMailtoUrl()`, and renders "Not configured" instead of an empty `href` when no web base is available
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 108) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2180 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 456: Device QA round 204 (desktop check-interval labels were terse)

- [x] **Desktop's check-interval buttons showed "Manual" / "Hourly" / "Daily"**, while mobile's options are "Manual only" / "Every hour" / "Once a day" — inconsistent wording between platforms
- [x] Desktop's options now use mobile's labels
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 109) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2181 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 457: Device QA round 205 (desktop route-less notifications couldn't be marked read)

- [x] **Desktop rendered a notification with no route as a plain `<div>`**, so clicking it did nothing and it stayed unread forever — mobile's notification item is always pressable and marks read regardless of route. Reachable for server events without a product/distributor link
- [x] Desktop's route-less notification row is now a focusable `role="button"` that calls `handleNotificationOpen` on click/Enter/Space
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 110) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2182 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 458: Device QA round 206 (desktop Home header said "Dashboard")

- [x] **Desktop's Home header read "Dashboard"**, while mobile's Home shows "Product Stock Finder" with the "Global availability monitor" subtitle — inconsistent branding between platforms
- [x] Desktop's Home header now matches mobile; updated `desktop/tests/pages.test.tsx`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 111) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2183 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 459: Device QA round 207 (desktop distributor-analysis empty state had no CTA)

- [x] **Desktop's distributor-analysis empty state was a single "Add products to see distributor analysis." line**, while mobile's `EmptyStateView` shows "No distributor data yet" with a subtitle, a "Browse Products" CTA, and "Try Again" — so a desktop user had no path forward
- [x] Desktop's empty state now shows the title, subtitle, Browse Products, and Try Again
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 112) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2184 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 460: Device QA round 208 (desktop health filter empty state was misleading)

- [x] **Desktop showed the "No distributor health data. Tap Test All Distributors…" message whenever the filter matched nothing** — even when health data existed — while mobile distinguishes "No distributor health data" (with a Test All Distributors CTA) from "No matches" (with a Show All CTA)
- [x] Desktop now renders both empty states with the matching CTAs; updated `desktop/tests/health.test.tsx` and `desktop/tests/health-fallback.test.tsx` for the now-duplicated "Test All Distributors" label
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 113) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2185 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 461: Device QA round 209 (desktop health-detail not-found state had no guidance)

- [x] **Desktop's health-detail "Distributor not found" was a plain line**, while mobile's `EmptyStateView` shows a subtitle ("We couldn't find this distributor. Check the link or browse distributor health.") and a "Go back" CTA — so a desktop user hitting a bad link had no guidance
- [x] Desktop's not-found state now shows the subtitle and a "Go back" button
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 114) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2186 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 462: Device QA round 210 (desktop compare region rows omitted the stock pill)

- [x] **Desktop's "Cheapest by Region" rows showed only the price**, while mobile's `CheapestRegionCard` shows a per-row stock-status pill (In Stock / Back Order / Out of Stock / Unknown) — so a desktop user couldn't see stock availability per region
- [x] Desktop's region rows now render a `StockBadge` under the price
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 115) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2187 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 463: Device QA round 211 (desktop compare had no Current Prices table)

- [x] **Desktop's compare screen had no "Current Prices" table**, while mobile's `CurrentPricesTable` lists every selected distributor with its chart color, name/country, price, ≈ converted price, and stock pill — so a desktop user couldn't read the current prices behind the chart
- [x] Desktop's compare now has the "Current Prices" section (with the mobile empty state "No distributors selected"), using the selection-order chart color and a `StockBadge`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 116) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2188 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 464: Device QA round 212 (desktop compare header title wasn't "Compare Prices")

- [x] **Desktop's compare header showed the product name as the title**, while mobile's `CompareHeader` title is "Compare Prices" with the product name as the subtitle — so a desktop user couldn't tell the screen's purpose at a glance
- [x] Desktop's header title is now "Compare Prices", with the product name (plus brand/model) as the subtitle
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 117) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2189 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 465: Device QA round 213 (desktop watchlist no-products copy differed from mobile)

- [x] **Desktop's watchlist no-products state read "No products in watchlist" / "Search for products to start tracking prices and stock availability." / "Add products"**, while mobile shows "No products yet" / "Add products to track their availability and prices globally across 25 distributors." / "Browse Products" plus a discovery tip — so the desktop lacked the tip and used different wording
- [x] Desktop's empty state now matches mobile (title, description, Browse Products action, and the "Tip: Search for MikroTik CRS, Ubiquiti U7, RTX 4090, Pi 5, etc." hint)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 118) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2190 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 466: Device QA round 214 (desktop filtered-empty watchlist copy differed)

- [x] **Desktop's filtered-empty watchlist state read "No products match this filter."** with no guidance, while mobile says "No products match your filters" with "Try adjusting your filters or search — or add a new product to track." and a "Clear Filters" button
- [x] Desktop's filtered-empty state now matches mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 119) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2191 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 467: Device QA round 215 (desktop sync status hid sync errors)

- [x] **Desktop computed the sync status inline from `lastSyncedAt`**, so it always showed "Last synced Nm ago" and silently hid `meta.lastSyncError`. Mobile's `formatSyncStatus` reports the error (with an error tone) and also prefers `lastSyncOkAt` over `lastSyncedAt`
- [x] Desktop now loads the full `SyncMeta` and uses `formatSyncStatus(syncMeta, isAuthenticated, now)`, rendering the label with the tone color (error → red, success → emerald)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 120) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2192 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 468: Device QA round 216 (desktop lacked the local-only sync status)

- [x] **Desktop always showed "Sign in to sync across devices" when signed out**, while mobile distinguishes an unconfigured server with "Local-only mode — prices are fetched on this device" — so a desktop user without a configured server was told to sign in pointlessly
- [x] Desktop's sync-status fallback now checks `getApiBaseUrl()` and shows the local-only message when unconfigured
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 121) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2193 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 469: Device QA round 217 (desktop Home stat labels differed from mobile)

- [x] **Desktop's Home stat cards read "Total Tracked" and "Alerts Active"**, while mobile's are "Tracked" and "Alerts" — inconsistent wording between platforms
- [x] Desktop's labels now match mobile; updated `desktop/tests/home-activity.test.tsx` and `desktop/tests/pages.test.tsx`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 122) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2194 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 470: Device QA round 218 (desktop colored non-recovered health events red)

- [x] **Desktop colored non-recovered health notifications red**, while mobile's `healthColor` returns "warning" (amber) for anything but a recovery — so a blocked/down distributor looked like a hard error on desktop
- [x] Desktop's non-recovered health icon now uses the amber styling, matching mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 123) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2195 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 471: Device QA round 219 (desktop cross-alert copy differed from mobile)

- [x] **Desktop's cross-alert card read "Alert me below {target}" / "5% below the best in-stock price, any distributor"**, while mobile's `CrossAlertCTA` says "Alert me if any distributor drops below" / "{price} (5% below current best of {best})" — inconsistent wording and the desktop didn't show the current best
- [x] Desktop now computes `crossBest` (the cheapest in-stock price) and uses mobile's copy
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 124) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2196 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 472: Device QA round 220 (desktop distributor sort labels differed)

- [x] **Desktop's compare distributor sort chips read "Name" / "Price" / "Trend"**, while mobile's `DistributorSelector` chips are "Trend ▼" / "Price" / "A–Z" — inconsistent wording between platforms
- [x] Desktop's labels now match mobile ("A–Z" / "Price" / "Trend ▼")
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 125) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2197 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 473: Device QA round 221 (desktop compare lacked 6M/1Y ranges and chart hints)

- [x] **Desktop's compare time-range chips only offered 1W/1M/3M/All** (mobile's ChartCard has 1W/1M/3M/6M/1Y/All) and the chart section lacked mobile's "Select up to 5 distributors to overlay" subtitle and range hints ("Showing all available history — up to 1Y retained (older points may be limited)" / "Showing all available history")
- [x] Added the 6M/1Y chips (with `toTimeRange` mappings) and the subtitle + hints
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 126) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2198 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 474: Device QA round 222 (desktop best-price card lacked the "why" subtitle)

- [x] **Desktop's Best Price card had no explanation**, while mobile's `BestDistributorCard` shows "Cheapest in-stock option" / "Cheapest orderable option" / "Cheapest available option" based on the listing's status
- [x] Desktop's card now shows the matching subtitle
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 127) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2199 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 475: Device QA round 223 (desktop product header subline differed)

- [x] **Desktop's product header subline was "{brand} | {modelNumber} | {category}"**, while mobile's `DetailHeader` shows "{brand} · {category} · {modelNumber}" — different separators and field order
- [x] Desktop's subline now matches mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 128) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2200 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 476: Device QA round 224 (desktop drop-calendar cells showed the count, not the day)

- [x] **Desktop's drop-calendar cells rendered the drop count** on drop days, while mobile's `DropCalendarCard` renders the day-of-month number with the count in the label — so the desktop grid read as numbers-of-drops rather than a calendar
- [x] Desktop's cells now render `Number(key.slice(8, 10))` like mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 129) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2201 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 477: Device QA round 225 (desktop mover headers differed from mobile)

- [x] **Desktop's mover sections were headed plain gray "Top Drops" / "Top Gainers"**, while mobile's `MoversCard` uses "▼ Top Drops" (green) and "▲ Top Gainers" (red) — so the direction wasn't obvious on desktop
- [x] Desktop's headers now match mobile; updated `desktop/tests/stats-polish.test.tsx`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 130) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2202 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 478: Device QA round 226 (desktop mover change was plain text, not a pill)

- [x] **Desktop rendered the mover change as plain colored text**, while mobile's `MoveRow` wraps it in a colored pill (`color + "22"` background) — inconsistent styling between platforms
- [x] Desktop's mover change is now a colored pill (emerald for drops, red for gainers)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 131) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2203 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 479: Device QA round 227 (desktop "Dropping now" count wasn't brand-colored)

- [x] **Desktop rendered the insights "Dropping now" count in gray**, while mobile's `InsightsCard` uses `colors.primary` (sapphire) — inconsistent emphasis between platforms
- [x] Desktop's count now uses `text-brand-600 dark:text-brand-400`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 132) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2204 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 480: Device QA round 228 (desktop basket alert modal title lacked the emoji)

- [x] **Desktop's basket alert modal was titled "Basket Value Alert"**, while mobile's `BasketAlertSheet` is titled "🧺 Basket Value Alert" — inconsistent wording between platforms
- [x] Desktop's title now includes the 🧺 emoji
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 133) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2205 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 481: Device QA round 229 (desktop freshness labels differed)

- [x] **Desktop's Data Freshness rows read "Stale" and "Oldest update"**, while mobile's `DataFreshnessCard` uses "Stale (>7 days)" and "Oldest check" — inconsistent wording between platforms
- [x] Desktop's labels now match mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 134) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2206 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 482: Device QA round 230 (desktop stock-health labels differed)

- [x] **Desktop's Stock Health used a compressed single line ("N% in stock · N fully out of stock · N back-order everywhere")**, while mobile's `StockHealthCard` shows "Listings in stock" / "Fully out of stock" / "Back-order everywhere" as labelled columns
- [x] Desktop now shows the same three labelled columns (keeping the progress bar); updated the round-151 guard to the new label
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 135) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2207 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 483: Device QA round 231 (desktop digest card lacked section headers)

- [x] **Desktop's digest card had no "Price Changes" / "Stock Changes" / "🎯 Targets Hit" section headers** (it showed the rows without labels, and the target emoji inline), while mobile's `DigestCard` labels each section — so desktop rows were ambiguous
- [x] Desktop's digest card now shows the three headers and drops the inline 🎯 (now on the header)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 136) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2208 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 484: Device QA round 232 (desktop trending section hid fetch failures)

- [x] **Desktop's TrendingSection swallowed `fetchTrending` failures** (`.catch(() => {})`) and then rendered `null`, so the section silently vanished with no way to recover. Mobile's `TrendingSection` shows "Couldn't load" with a "Retry" button
- [x] Desktop now tracks `loadError`, exposes a `load` retry, and renders the "Couldn't load" + Retry state
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 137) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2209 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 485: Device QA round 233 (desktop empty-watchlist Home hid Trending)

- [x] **Desktop's empty-watchlist Home early-returned without the `TrendingSection`**, while mobile renders Trending below the stat cards regardless — so a brand-new desktop user had no in-app way to discover products
- [x] Desktop's empty state now renders `<TrendingSection />`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 138) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2210 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 486: Device QA round 234 (desktop device row marked current differently)

- [x] **Desktop appended " (current)" to the current device's label**, while mobile's `DeviceRow` shows a distinct "This device" badge — inconsistent emphasis between platforms
- [x] Desktop now shows the "This device" badge next to the label
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 139) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2211 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 487: Device QA round 235 (desktop enable-notifications row lacked its description)

- [x] **Desktop's "Enable Notifications" row had no description**, while mobile's row reads "Receive alerts on your device" — so a desktop user didn't know what the master toggle did
- [x] Desktop's row now shows the description
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 140) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2212 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 488: Device QA round 236 (desktop watchlist rows had no per-product tag editing)

- [x] **Desktop's watchlist row had no per-product tag assignment**, while mobile's `ProductCard` has an "Edit tags" (tag icon) action that opens the tag picker for that product — so a desktop user couldn't tag a watched product
- [x] Desktop's row now has an "Edit tags" action opening an "Assign tags" modal backed by `storage.setProductTags` (with inline create via Manage Tags)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 141) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2213 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 489: Device QA round 237 (desktop movers empty state lacked the hint)

- [x] **Desktop's movers empty state said only "No movers yet"**, while mobile's `MoversCard` adds "Not enough price history yet." — so a desktop user didn't know why the list was empty
- [x] Desktop's Top Drops / Top Gainers empty states now include the hint
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 142) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2214 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 490: Device QA round 238 (desktop drop-calendar count wording differed)

- [x] **Desktop's drop-calendar count read "N drops in 30 days"**, while mobile's `DropCalendarCard` reads "N price drops in the last 30 days" — inconsistent wording between platforms
- [x] Desktop's count text now matches mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 143) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2215 passed`; desktop `tsc 0`, `44 passed` / `220 passed`

## Phase 491: Device QA round 239 (desktop ignored the device-revoked error)

- [x] **Mobile's tRPC client (`lib/trpc.ts`) installs a `revokedDeviceLink` that detects `DEVICE_REVOKED_ERR_MSG` and signs the user out when this device is revoked from another device; the desktop client had no such link**, so a revoked desktop device stayed "signed in" with every request silently failing
- [x] Added `handleDeviceRevoked()` to `desktop/src/hooks/use-auth.ts` (clears session token + user info, notifies auth subscribers)
- [x] Added the `revokedDeviceLink` to `desktop/src/lib/trpc.ts` (mirrors mobile)
- [x] Added a wiring guard to `tests/desktop-email-auth.test.ts` and a behavior test to `desktop/tests/auth-functions.test.ts` — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2216 passed`; desktop `tsc 0`, `44 passed` / `221 passed`

## Phase 492: Device QA round 240 (desktop never swept stale device bindings)

- [x] **Mobile's sign-in effect (`app/_layout.tsx`) calls `cleanupStaleDevices()` (removes device bindings unseen for 30+ days); the desktop's authenticated effect only called `syncNow()`**, so stale devices lingered forever in the desktop Settings device list (the server only purges revoked-device rows, never stale bindings — a client has to ask)
- [x] Added `desktop/src/lib/device-cleanup.ts` (`cleanupStaleDevices(client, timeoutMs)` — timeout-guarded, returns 0 on failure)
- [x] Wired it into the desktop's authenticated effect in `desktop/src/App.tsx`
- [x] Added `desktop/tests/device-cleanup.test.ts` (3 tests) and a wiring guard to `tests/desktop-p1-parity.test.ts` — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2217 passed`; desktop `tsc 0`, `45 passed` / `224 passed`

## Phase 493: Device QA round 241 (desktop never uploaded local price history)

- [x] **Mobile's sign-in effect calls `backfillLocalHistory()` (uploads each watched listing's local price history to the server, newest `MAX_UPLOAD_HISTORY_POINTS` slice); the desktop never did**, so price history collected on desktop stayed invisible to the server and to other devices
- [x] Added `desktop/src/lib/history-sync.ts` (`backfillLocalHistory(client, watchlist)` — caps to `MAX_UPLOAD_HISTORY_POINTS`, per-listing failures non-fatal)
- [x] Wired it into the desktop's authenticated effect in `desktop/src/App.tsx`
- [x] Added `desktop/tests/history-sync.test.ts` (3 tests) and a wiring guard to `tests/desktop-p1-parity.test.ts` — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2218 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 494: Device QA round 242 (desktop drop calendar had no selected-day highlight)

- [x] **Mobile's `DropCalendarCard` visibly highlights the selected day (primary background + 2px border); the desktop day button only toggled `aria-pressed`, so clicking a day gave no visual selection feedback**, leaving keyboard/screen-reader users the only ones who could tell a day was selected
- [x] The desktop's selected day now renders `bg-brand-600 text-white ring-2 ring-brand-400`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 144) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2219 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 495: Device QA round 243 (desktop signed out on revocation with no explanation)

- [x] **Mobile's `registerDeviceRevokedHandler` shows "Signed Out / You were signed out on another device."; the desktop `handleDeviceRevoked` (added in round 239) cleared the session silently**, so a revoked desktop user landed in the signed-out state with no idea why
- [x] `handleDeviceRevoked` now fires the same message as an OS notification (`sendDesktopNotification`, best-effort, dynamically imported to avoid a use-auth ↔ notifications cycle)
- [x] Extended `desktop/tests/auth-functions.test.ts` (asserts the notification payload) and the wiring guard in `tests/desktop-email-auth.test.ts` — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2219 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 496: Device QA round 244 (desktop reminder card date format differed)

- [x] **Mobile's `ReminderCard` renders the reminder date as `Jan 5, 2026` (`toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })`); the desktop's reminder card used bare `toLocaleDateString()`**, producing the locale-numeric `1/5/2026` for the same reminder
- [x] Desktop's Alerts reminder card now uses mobile's month-name format
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 145) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2220 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 497: Device QA round 245 (desktop alert-card dates were locale-numeric)

- [x] **Mobile's `alert-card.tsx` formats "Snoozed until" (`{ month: "short", day: "numeric" }`) and "Triggered" (`{ month: "short", day: "numeric", year: "numeric" }`) with month names; the desktop's alert card used bare `toLocaleDateString()` for Snoozed/Triggered/Created**, so the same alert read differently across platforms
- [x] Aligned all three desktop alert-card dates to mobile's month-name formats
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 146) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2221 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 498: Device QA round 246 (desktop device row showed an absolute date, not last-seen)

- [x] **Mobile's `DeviceRow` renders `formatLastSeen(lastSeenAt)` → "last seen 2h ago"; the desktop's device list rendered `Active {toLocaleDateString()}`**, so recency was lost behind a date
- [x] Moved `formatLastSeen` into shared `lib/relative-time.ts`; `components/settings/device-management/device-utils.ts` now re-exports it (mobile import + its test unchanged)
- [x] Desktop Settings device row now uses `formatLastSeen(d.lastSeenAt)`
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 147) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2222 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 499: Device QA round 247 (desktop freshness/health dates were locale-numeric)

- [x] **Mobile's `DataFreshnessCard` formats "Oldest check" with a month name and its health-detail sample timestamps use `{ month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }`; the desktop used bare `toLocaleDateString()`/`toLocaleString()`** for both
- [x] Aligned the desktop Stats freshness "Oldest check" and HealthDetail sample timestamps (visible text + tooltip title) to mobile's formats
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 148) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2223 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 500: Device QA round 248 (reminder toasts used a locale-numeric date)

- [x] **Mobile's `ReminderSection` toast and both desktop reminder toasts rendered the target date as `1/5/2026` (bare `toLocaleDateString()`), while the reminder card and the date-picker modal render `Jan 5, 2026`** — inconsistent within mobile and across platforms
- [x] Unified all three on the month-name format (`{ month: "short", day: "numeric", year: "numeric" }`)
- [x] Added a guard to `tests/mobile-criticals.test.ts` covering both the mobile and desktop toasts — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2224 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 501: Device QA round 249 (desktop alert tabs showed "(0)" counts)

- [x] **Mobile's `TabSwitcher` renders a count only when non-zero (`Alerts`, `Alerts (3)`); the desktop's Alerts/Reminders tab buttons always rendered the count**, so empty tabs read "Alerts (0)" / "Reminders (0)"
- [x] Desktop tabs now omit the count when zero (Notifications already did)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 149) and updated `tests/desktop-list-awareness.test.ts`'s existing tab-count assertion to the conditional form — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2225 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 502: Device QA round 250 (desktop restock empty state didn't explain the outcome)

- [x] **Mobile's restock-watches empty state reads `Open a product and tap "Watch for Restock" to get notified when it's back in stock.`; the desktop's said `...to add one.`**, which didn't say what a watch does
- [x] Desktop now states the outcome (keeping the intentional "click" wording, guarded by `tests/desktop-search-polish.test.ts`)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 150) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2226 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 503: Device QA round 251 (desktop Home watchlist link omitted the noun)

- [x] **Mobile's Home watchlist preview link reads `View all N products →`; the desktop's rendered `View all N →`**, so the number had no noun
- [x] Desktop Home link now matches mobile (the `aria-label` already included "product(s)")
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 151) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2227 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 504: Device QA round 252 (desktop trending prices used a partial symbol map)

- [x] **Mobile's trending row renders the estimated price with `formatPrice(price, currency)`; the desktop used a local `currencySymbol` map covering only USD/EUR/GBP plus `toLocaleString()` without fixed decimals**, so e.g. MYR showed as "MYR 1,299" instead of "RM1,299.00" and cents were dropped everywhere
- [x] Desktop trending row now uses `formatPrice` (same helper as the rest of the app)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 152) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2228 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 505: Device QA round 253 (desktop compare CSV export had no empty guard)

- [x] **Mobile's Compare CSV export refuses when no listing has price history ("Nothing to export" / "No price history is available for this product yet."); the desktop's `handleExportCsv` had no such guard**, so it wrote a header-only CSV (with no data rows) and reported "Price history exported" — a misleading success
- [x] Desktop export now bails with "Nothing to export — no price history yet" and builds rows from only the listings that have history
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 153) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2229 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 506: Device QA round 254 (desktop copy still said "tap")

- [x] **Four desktop strings carried mobile's "tap" wording** (a pointer-desktop app): Health "Tap "Test All Distributors" to run a check.", Home "Tap + to add a product…", and Alerts "…and tap "Set Alert"…" / "…and tap "Remind me" or "Watch for Restock"."
- [x] Home's hint also referenced a "+" control the desktop does not have (its empty state offers an "Add Product" button)
- [x] Changed all four to desktop "click"/"Click" wording; Home now names the actual control ("Click Add Product…")
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 154) and updated the round-192 guard's copied assertion — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2230 passed`; desktop `tsc 0`, `46 passed` / `227 passed`

## Phase 507: Device QA round 255 (desktop basket alert threshold was settable but never fired)

- [x] **Mobile evaluates the basket-value alert after every price sweep (`lib/background-tasks/price-check.ts`): when the watchlist total (best in-stock price per product, in the display currency) is at or below `basketAlertThreshold`, it notifies and clears the threshold. The desktop let users set the threshold (Stats → 🧺 Basket Value Alert) but had no evaluation code at all**, so desktop basket alerts never fired
- [x] Added `desktop/src/lib/basket-alert.ts` (`evaluateBasketAlert(storage, notify)`) mirroring mobile: fires once, keeps the threshold if the send fails so it retries, clears it only on success
- [x] Wired it into the desktop's `onPricesChecked` handler in `desktop/src/App.tsx`
- [x] Added `desktop/tests/basket-alert.test.ts` (4 tests) and a wiring guard to `tests/desktop-p1-parity.test.ts` — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `330 passed | 2 skipped` / `2231 passed`; desktop `tsc 0`, `47 passed` / `231 passed`

## Phase 508: BYO-LLM settings now take effect (server-proxied)

- [x] **Gap:** the AI/LLM settings (`llmProvider`/`llmApiKey`/`llmModel`/`llmOllamaUrl`) were stored and synced but no code read them, so the section's promise ("used for price insights, product discovery…") was never honored
- [x] Added `server/user-llm.ts`: reads the config from bounded `x-llm-*` request headers, routes to the user's provider, and normalizes responses to the OpenAI shape callers already consume
  - `openai` → fixed `https://api.openai.com/v1/chat/completions`; `ollama` → fixed `https://ollama.com/api/chat`; `ollama-local` → loopback-only URL (SSRF guard); `forge`/absent → built-in `invokeLLM`
  - key used per-request and never persisted/logged; provider errors surface only the HTTP status
- [x] `discovery.discover` and `insights.get` consume the headers; BYO calls skip the process spend budget (user-funded), Forge calls are unchanged
- [x] Mobile + desktop tRPC clients forward `x-llm-*` from `AppSettings` (nothing sent for Forge)
- [x] `images.get` stays on the built-in service (separate image API + shared cache); both LLM sections' copy corrected to state the real scope
- [x] Documented the headers in `server/README.md`
- [x] Tests: `tests/user-llm.test.ts` (SSRF/loopback, routing, error hygiene), `tests/byo-llm-wiring.test.ts`, BYO cases in `tests/discovery-spend-budget.test.ts` / `tests/price-insights.test.ts`, `desktop/tests/byo-llm-headers.test.ts` — all verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `333 passed | 2 skipped` / `2248 passed`; desktop `tsc 0`, `48 passed` / `235 passed`

## Phase 509: rejected BYO-LLM key shows actionable copy

- [x] **Gap:** a bad/expired user key made the provider return 401 → discovery surfaced a generic "Server error (500). Try again in a moment." with a Retry that could never succeed (mobile's hand-rolled copy fell through to the *parse* branch)
- [x] `server/user-llm.ts` throws `UserLlmAuthError` on provider 401/403; `discovery.discover` maps it to a `PRECONDITION_FAILED` tRPC error carrying `BYO_LLM_AUTH_ERR_MSG` (not 401/403, which the client reserves for "sign in required")
- [x] `lib/llm-discovery.ts` parses the tRPC error message, maps it to a new `byo-auth` error kind, and `toDiscoverErrorState` returns a non-retry "Check your API key" state
- [x] Mobile `app/search.tsx` now uses the shared mapper (was duplicating the messages, so the new kind would have shown a parse error); desktop already did
- [x] Tests: auth-error case in `tests/user-llm.test.ts`, router mapping in `tests/discovery-spend-budget.test.ts`, client mapping in `tests/llm-discovery.test.ts`, mobile-mapper guard in `tests/mobile-criticals.test.ts` — all verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `333 passed | 2 skipped` / `2253 passed`; desktop `tsc 0`, `48 passed` / `235 passed`

## Phase 510: "Test connection" for the BYO-LLM provider

- [x] Added a protected `llm.test` endpoint (`server/routers/llm.ts`) that probes the caller's configured provider with a minimal request and returns `{ ok, provider, reason? }` (`reason` = `auth` for a rejected key, `error` otherwise); Forge returns ok without calling any provider
- [x] Client helpers `lib/server-llm.ts` (mobile, timeout-guarded) and `desktop/src/lib/server-llm.ts`; the tRPC clients already forward the `x-llm-*` headers
- [x] "Test connection" button in both LLM settings UIs (shown only for non-Forge providers) with ok / rejected-key / failure feedback
- [x] Tests: `tests/llm-router-test.test.ts` (forge, ok, auth, error) + wiring guards in `tests/byo-llm-wiring.test.ts` — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `334 passed | 2 skipped` / `2259 passed`; desktop `tsc 0`, `48 passed` / `235 passed`

## Phase 511: Device QA round 256 (desktop custom dialogs were keyboard-inaccessible)

- [x] **Nine hand-rolled dialog overlays (Settings rename-device; Stats basket alert; Watchlist manage-tags/bulk-tags/product-tags; Alerts reschedule/edit; Search tags/import/manual-add) used a bare `fixed inset-0` div with no Escape-to-close, no focus-on-open/restore, no Tab trap, and no `role="dialog"`/`aria-modal`** — while the shared `Modal` component (used by ProductDetail, SearchModal, Onboarding, DistributorHistory) provides all of it. Keyboard users could open these and not Escape out; screen readers didn't announce them.
- [x] Added `desktop/src/components/DialogOverlay.tsx` (backdrop + Escape-to-close via a topmost-only stack, focus-on-open, focus restore, Tab trap, `role="dialog"`/`aria-modal`) and converted all nine overlays (inner panels unchanged)
- [x] Tests: `desktop/tests/dialog-overlay.test.tsx` (5 behavior tests: a11y attrs, focus, Escape, backdrop-vs-child click, Tab trap, closed) + `tests/desktop-dialog-a11y.test.ts` (source guard: no hand-rolled overlays remain) — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2261 passed`; desktop `tsc 0`, `49 passed` / `240 passed`

## Phase 512: Device QA round 257 (SearchModal's nested sheets + split Escape stacks)

- [x] **The round-256 sweep missed three more hand-rolled overlays in `desktop/src/components/SearchModal.tsx`** (tag picker, bulk import, manual add) because the exclusion filter matched "SearchModal.tsx" as a substring of "Modal.tsx". They had the same a11y gaps.
- [x] **More importantly, `Modal` and `DialogOverlay` each kept their own Escape stack**, so an overlay layered over a Modal (exactly this case) would close *both* on Escape. Extracted `desktop/src/lib/dialog-stack.ts` (push/pop/isTopDialog) and moved both components onto it.
- [x] Converted the three SearchModal sheets to `DialogOverlay` (with `z-[60]`), and extended the source guard to cover SearchModal
- [x] Tests: nested-stack Escape test in `desktop/tests/dialog-overlay.test.tsx` (asserts only the topmost closes) + expanded `tests/desktop-dialog-a11y.test.ts` — both verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2262 passed`; desktop `tsc 0`, `49 passed` / `241 passed`

## Phase 513: Device QA round 258 (signed-out "Test connection" reported a fake network error)

- [x] **`llm.test` was a `protectedProcedure`, but the AI/LLM settings section renders signed out.** A signed-out user tapping "Test connection" got a 401 that the client wrapper swallows and reports as "Couldn't reach the server" — a nonexistent connectivity problem.
- [x] Made `llm.test` public, matching `insights.get` (also public and also accepts a BYO key). It only ever uses the caller's own key, is rate-limited per IP, and with no BYO config returns `{ ok: true, provider: "forge" }` without touching any provider.
- [x] Updated `server/README.md` and added a signed-out (null-user) case to `tests/llm-router-test.test.ts` — verified non-vacuous by reverting to `protectedProcedure`; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2263 passed`; desktop `tsc 0`, `49 passed` / `241 passed`

## Phase 514: Device QA round 259 (DialogOverlay didn't lock background scroll)

- [x] **The shared `Modal` locks background scrolling while open (ref-counted), but `DialogOverlay` (added in round 256) didn't** — so a dialog opened from a page (basket alert, tag manager, bulk import, …) let the page scroll behind its backdrop. Re-examining round 256's own work surfaced this.
- [x] Moved the scroll lock into `desktop/src/lib/dialog-stack.ts` as a ref-counted `lockBodyScroll`/`unlockBodyScroll` (so nested dialogs don't unlock early) and used it from both `Modal` and `DialogOverlay`
- [x] Tests: scroll-lock + nested-lock cases in `desktop/tests/dialog-overlay.test.tsx` — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2263 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 515: Device QA round 260 (desktop shared-watchlist listing copy)

- [x] **Desktop's shared-watchlist product card said `+N more` (mobile: `+N more distributors`) and rendered nothing at all for a product with no listings**, where mobile shows a "No distributor prices yet" fallback. So a shared product with no prices looked like a rendering bug on desktop.
- [x] Matched both to mobile
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 155) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2264 passed`; desktop `tsc 0`, `49 passed` / `243 passed`
- [ ] Noted (not built): the server's collaborative membership endpoints (`sharedWatchlists.invite/members/join/leave` + the `sharedWatchlistMembers` table) have **no client usage** on mobile or desktop — a dead backend feature that needs a product decision (how to invite: by id? email lookup?) before wiring.

## Phase 516: Device QA round 261 (desktop rows hid the per-distributor "+")

- [x] **The desktop's "Distributor Targets" row set `alert = scopedAlertFor(...) ?? productWideAlert(...)`.** With a product-wide alert present, `alert` became truthy for every row, so the row rendered a delta and **not** the "+" button — a per-distributor target could no longer be added from the table. Mobile's `TargetTableCard` scopes the row to per-distributor alerts only and shows the wide alert in a footer.
- [x] Desktop row now uses the scoped alert only (wide alert still shown in the footer)
- [x] Added a guard to `tests/desktop-targets-reminders.test.ts` — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2265 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 517: Device QA round 262 (undo dropped reminders and restock watches)

- [x] **Removing a product cascades (`lib/storage/index.ts removeFromWatchlist`) to its alerts, back-order reminders, and restock watches. Desktop's undo restored only the product + alerts, so a reminder/watch was silently lost on undo; mobile's swipe-undo has the same gap.**
- [x] Desktop `handleRemove` now captures reminders + watches and `handleUndo` restores them (desktop reminders/watches carry no OS `notificationId`, so restoring the row is sufficient — the server sync re-schedules)
- [x] Updated the existing undo guard's slice window and added a guard asserting the reminder/watch restore — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2266 passed`; desktop `tsc 0`, `49 passed` / `243 passed`
- [ ] Fixed mobile follow-up: `app/(tabs)/watchlist.tsx` `handleSwipeDelete`/`handleUndo` capture only alerts, so reminders/watches are still lost on undo (and their expo notifications were cancelled — restoring needs re-scheduling). Left for a dedicated mobile round.
- [x] Note: this round began from a false positive — I read a truncated `grep | head` and thought the desktop had no CSV import; it already has a complete one (`handleImportFile`). Reverted the duplicate before committing.

## Phase 518: Device QA round 263 (mobile undo also dropped reminders and watches)

- [x] Closes the mobile follow-up noted in Phase 517: `app/(tabs)/watchlist.tsx` `handleSwipeDelete` captured only alerts, so the cascade's back-order reminders and restock watches were lost on undo
- [x] `handleSwipeDelete` now captures all three (in parallel) and `handleUndo` restores them. Date reminders are **re-scheduled** (`scheduleBackOrderReminder`) with the new notification id — the cascade had cancelled the old one, so restoring the dead id would leave a reminder that never fires. Restock watches are restored as-is (status-driven, not id-driven)
- [x] Updated `tests/mobile-criticals.test.ts`'s existing undo guards and added a reminder/watch case — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2267 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 519: Device QA round 264 (mobile card Delete had no undo)

- [x] **Mobile's two delete affordances were inconsistent: the swipe offered Undo, but the product card's Delete button called a separate handler that removed the product (and its cascaded alerts/reminders/watches) permanently with no recovery** — while the desktop's equivalent trash button does show Undo.
- [x] Extracted `removeProductWithUndo(product)` and routed both the SwipeableCard and the ProductCard through one `handleDelete`; removed the duplicate `handleSwipeDelete`
- [x] Reworked `tests/mobile-criticals.test.ts`'s undo guards (they sliced `handleSwipeDelete`, now gone) and asserted **both** `onDelete` call sites are wired to the undo path — verified non-vacuous by reverting the card caller; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2267 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 520: Device QA round 265 (desktop range chips didn't expose the selection)

- [x] **Mobile's compare `ChartCard` chips carry `accessibilityRole="radio"` + `accessibilityState={{ selected }}`; the desktop's `TimeRangeChips` set only an `aria-label`**, so a screen-reader user couldn't tell which range was active. The desktop chips also hard-coded the 1W–All list instead of deriving from the shared `TIME_RANGES` (the previous round's guard asserted that literal list, a drift risk).
- [x] Rewrote `TimeRangeChips` to map `TIME_RANGES` and expose `role="radio"`/`aria-checked` inside a labelled `role="radiogroup"`
- [x] Updated the round-221 chip guard to the derived form and `desktop/tests/compare-chart-width.test.tsx` to query the radio role (plus assert `aria-checked`); added a round-265 guard — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2268 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 521: Device QA round 266 (desktop single-select rows didn't expose the active option)

- [x] **Mobile exposes the active option on every single-select row (`accessibilityRole="radio"` / `accessibilityState.selected`) — search category/brand/sort, product-detail region + alert direction, alert-edit currency/direction/distributor, compare sort, settings theme/check-interval/digest-frequency/day. Several desktop rows rendered the active *visual* style but had no `aria-pressed`/`role`**, so a screen reader couldn't tell what was selected.
- [x] Added `aria-pressed` to: `search-chrome.tsx` `PillFilterRow` (All + options), Search page + SearchModal sort chips, ProductDetail region chips + all three direction segmented controls, Alerts edit-modal currency/direction/distributor chips, Compare sort chips, Settings theme / check-interval / digest-frequency / digest-day chips (audited with a script that parses `<button>` tags for conditional active classes)
- [x] Added a guard covering every site to `tests/desktop-chart-guard.test.ts` (now 158) — verified non-vacuous by reverting one; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2269 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 522: Device QA round 267 (desktop product header lacked the in-stock badge)

- [x] **Mobile's `DetailHeader` renders an "In Stock" `StockBadge` when a best deal exists** (a best deal is always in-stock, so it confirms an available option); the desktop product header showed the region/description but not the badge.
- [x] Added it to the desktop header
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 159) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2270 passed`; desktop `tsc 0`, `49 passed` / `243 passed`
- [x] Swept (found clean): reschedule/edit-alert validation and error copy, `addBackOrderReminder` upsert semantics, `analyzeDistributors`/`computeDropCalendar`/`computeHealthStats` domain logic, Cheapest-by-Region + Current Prices rows, compare color assignment, health dashboard stats.

## Phase 523: Device QA round 268 (desktop restock remove used generic copy)

- [x] **Mobile's restock-watch remove confirm names the product ("Stop watching for X? This cannot be undone."); the desktop's was generic ("Stop watching for this restock?")** — no indication of which watch was about to be removed. The desktop also surfaced the raw storage error (`e.message`) instead of mobile's friendly "We couldn't remove that watch. Please try again."
- [x] `RestockWatches.handleRemove` now takes the product name and uses the friendly error copy
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 160) — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2271 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 524: Device QA round 269 (digest stock rollup diverged from the watchlist)

- [x] **`computeDigest`'s `productState` hand-rolled its own product-level stock rollup, which disagreed with the canonical `productStatus` (`lib/watchlist-org.ts`) the watchlist cards use.** For a product with an out_of_stock listing *and* an unknown listing, the watchlist showed "Out of Stock" while the digest recorded "unknown" — so a stock change was reported (and a digest sent) when nothing the user could see had changed.
- [x] `productState` now reuses `productStatus`, so the digest and watchlist agree
- [x] Added a regression test to `tests/price-digest.test.ts` — verified non-vacuous by restoring the inline logic; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2272 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 525: Device QA round 270 (product card a11y label contradicted its badge)

- [x] **The mobile product card rendered `StockBadge status={productStatus(product)}` but built its accessibility label from a separate inline rollup** that fell back to "out of stock" for anything not in_stock/back_order. For an all-`unknown` product the badge said "Unknown" while a screen reader announced "out of stock".
- [x] The label now derives from `bestStatus` (the same value the badge renders, incl. "unknown")
- [x] Added a guard to `tests/mobile-criticals.test.ts` — verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2273 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 526: Device QA round 271 (chart colors were duplicated and unstable)

- [x] **Compare chart colors were implemented three different ways:** mobile defined an identical `hashId` in three files (`app/compare/[id].tsx`, `current-prices-table.tsx`, `distributor-selector.tsx`); the desktop kept its own **8-color** palette (vs the shared 5) and indexed colors by *selection order*. Consequence: on desktop, deselecting one distributor **recolored all the others** (chart lines, selector chips, table dots), and mobile/desktop could assign a different color to the same distributor.
- [x] Added `distributorColor(id)` to `shared/src/compare-utils.ts` (deterministic hash over the shared `CHART_COLORS`) and switched all six call sites to it; removed the three local `hashId`s and the desktop's duplicated palette
- [x] Tests: `tests/compare-utils.test.ts` pins known id→color mappings (so a constant/index regression fails) + a source guard in `tests/desktop-chart-guard.test.ts` (no local `hashId`, all four files use `distributorColor`) — both verified non-vacuous; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2275 passed`; desktop `tsc 0`, `49 passed` / `243 passed`

## Phase 527: Device QA round 272 (desktop StockBadge mangled the expected date)

- [x] **`expectedDate` is a human-readable string from the parsers/sample data ("Sept 15, 2026", "Aug 2026"), not an ISO date. The desktop `StockBadge` ran it through `new Date(...)` + `toLocaleDateString`**, normalizing "Sept"→"Sep" and — worse — fabricating "Aug 1, 2026" for a month-only value. Mobile renders it verbatim (its test pins `Back Order · 2026-09-01`). The desktop also appended the date for *any* status; mobile only for `back_order`.
- [x] Desktop `StockBadge` now renders `expectedDate` verbatim and only for `back_order`
- [x] Added `desktop/tests/stock-badge.test.tsx` (raw date, no fabricated day, non-back-order omits it) — verified non-vacuous by restoring the parse path; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2275 passed`; desktop `tsc 0`, `50 passed` / `246 passed`

## Phase 528: Device QA round 273 (desktop leaked a foreign timezone into synced quiet hours)

- [x] **The desktop persisted `utcOffsetMinutes` inside the synced `quietHours` setting.** Settings sync across devices, so a desktop in one timezone leaked its offset into mobile — where `isInQuietHours` prefers a present offset over device time, so the phone then evaluated quiet hours against the *desktop's* (and stale) timezone.
- [x] Dropped the stored offset: the setting is now just `{start, end}`. Both platforms already stamp a **fresh** device offset at upload (`server-notifications.ts`), which is what the server's quiet-hours evaluation (`evaluate.ts`, `digest.ts`) actually consumes — so the server behaviour is unchanged and local evaluation now always uses device time. (The removed comment also wrongly claimed the Rust poller evaluates quiet hours; it deliberately does not.)
- [x] Added a guard to `tests/desktop-chart-guard.test.ts` (now 162) — verified non-vacuous by re-adding the stored offset; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2276 passed`; desktop `tsc 0`, `50 passed` / `246 passed`

## Phase 529: Device QA round 274 (BYO-LLM key was synced to the server and other devices)

- [x] **`llmApiKey` is an `AppSettings` field, and settings sync as one `SyncItem` — so the user's provider API key was pushed to the server (stored at rest in the settings row) and pulled onto every other device.** That contradicted the BYO-LLM proxy's stated contract ("never persisted server-side") and leaked the secret to the operator/DB dumps and any lost device. The server only ever needs it per-request (`x-llm-key` header).
- [x] `lib/sync.ts`: the pushed settings are stripped of `llmApiKey`, and both apply paths (per-field merge + no-base first-sync fallback) preserve the local device's key instead of adopting the incoming one
- [x] Tests: three cases in `tests/sync-engine.test.ts` (push omits the key; pull keeps the local key via the merge path; pull keeps it on the no-base first sync) — each verified non-vacuous by reverting its guard; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2279 passed`; desktop `tsc 0`, `50 passed` / `246 passed`

## Phase 530: Device QA round 275 (exported backup leaked the BYO-LLM API key)

- [x] **`buildBackup` serialized `settings` verbatim — including `llmApiKey` — so "Export Backup" wrote the user's provider API key into a plaintext, user-shareable JSON file.** `parseBackup`/`mergeSettings` would then also *adopt* a key from any imported (possibly shared or hand-crafted) backup, overwriting the local one. Same secret, second user-facing leak vector (the first, settings sync, was Phase 529).
- [x] Extracted `lib/settings-privacy.ts` (`stripDeviceLocalSettings` / `applyLocalLlmKey`) and used it from both `lib/sync.ts` (replacing its private copies) and `lib/backup.ts`: export strips the key, `parseBackup` strips it defensively, and `mergeSettings` never adopts it
- [x] Tests: two cases in `tests/backup.test.ts` (export omits the key; a crafted backup carrying one is ignored and the local key survives) — each verified non-vacuous; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2281 passed`; desktop `tsc 0`, `50 passed` / `246 passed`

## Phase 531: Device QA round 277 ("Dropping ×N" badge false negatives)

- [x] **`computeProductInsights` computed the drop streak from `mergedPoints` — the average across *all* listings (including out-of-stock/unknown). When a distributor's history ends (it went out of stock) its stale point leaves the mean, so the averaged series *rises* on the last step and a genuinely falling product reported `dropStreak: 0`** — suppressing the "▼ Dropping ×N" badge on the card and the "Dropping now" count on the Insights card. (The all-time-low check already used the best in-stock series for exactly this reason.)
- [x] The streak now reads the best in-stock series (`bestPricePoints`, already computed for the all-time-low check — reused, no extra pass); `mergedPoints` still drives volatility (a price-level measure)
- [x] Reproduced first with a failing test (A falls 100→95→90 while B, out of stock, has a shorter history → average 75/72.5/90 → streak 0), then fixed; test verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2282 passed`; desktop `tsc 0`, `50 passed` / `246 passed`
- [ ] Not changed: `lib/deal-score.ts` still uses the averaged window for its (small, ≤10 pt) streak factor — its range/trend/volatility factors are all price-level and internally consistent; flagging rather than altering without a spec.

## Phase 532: Device QA round 279 (desktop restock alerts never fired)

- [x] **`checkRestocks` (shared `lib/restock.ts`) had no injectable notifier: with the desktop's RN stub reporting `Platform.OS === "web"`, the restock alert went through `displayWebNotification` (browser Notification API) instead of the Tauri channel the desktop uses for price/digest/basket alerts.** In the Tauri webview that permission is not granted, so `notified` stayed false → no notification, and the watch was deliberately *kept* for retry, so it was retried forever and never recorded in the Alerts history. A desktop user could never receive a restock alert.
- [x] Added an optional `notify` parameter (`RestockNotifier`) to `checkRestocks`, ahead of the platform branches — matching the injectable notifiers already used by `maybeSendDigest` and `evaluateBasketAlert`; mobile behaviour is unchanged (default notifier still used)
- [x] Desktop `App.tsx` now passes a Tauri notifier (`sendDesktopNotification(..., "/alerts")`)
- [x] Tests: two cases in `tests/restock.test.ts` (injected notifier delivers + consumes the watch; a failed notifier keeps it) + a wiring guard in `tests/desktop-chart-guard.test.ts` (now 163) — each verified non-vacuous by reverting; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2285 passed`; desktop `tsc 0`, `50 passed` / `246 passed`

## Phase 533: Device QA round 280 (web notification fallback reported false success)

- [x] **`desktop/src/notifications.ts`'s web fallback called `displayWebNotification(title, body)` and returned `true` unconditionally**, ignoring that it returns `false` when the browser Notification permission isn't granted. Callers treat that return as "was it shown" and consume state on success — the basket alert clears `basketAlertThreshold`, `maybeSendDigest` saves the digest snapshot, and `checkRestocks` removes the restock watch — so an ungranted-permission desktop saw the alert silently burned (and, for restock, retried forever).
- [x] The fallback now returns `displayWebNotification(...)`'s actual result, so the "delivered" signal is honest and unconsumed alerts retry
- [x] Tests: `desktop/tests/send-notification.test.tsx` gained a false/permission-denied case and a true/shown case — verified non-vacuous by restoring the unconditional `true`; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2285 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 534: Known-item sweep (desktop Alerts badge + deal-score streak)

- [x] **Desktop sidebar Alerts badge counted *unread notifications*, while mobile's Alerts tab badge counted active price alerts + date reminders + restock watches.** Same tab, different data. Aligned the desktop to mobile's semantics (shared `countActiveAlerts` predicate + the reminder/watch lengths); unread stays visible on the Alerts page's Notifications sub-tab. Updated the weak `tests/desktop-notif-history.test.ts` guard, non-vacuous.
- [x] **`computeDealScore`'s streak factor was the last consumer of the all-listing averaged series** (round 277 fixed the insights badge). It now reads the best in-stock series (`bestPricePoints`), windowed to the same 90 days — consistent with the "Dropping ×N" badge. New regression test in `tests/deal-score.test.ts`, non-vacuous.
- [x] E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2286 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 535: Collaborative shared-watchlist membership now has a client

- [x] Closes the flagged item "membership endpoints have no client". The server already supported `join`/`leave` (self-service, no user lookup needed), but `get` exposed no membership, so no UI could be built.
- [x] `sharedWatchlists.get` (public) now returns `isOwner`/`isMember` for the viewer (best-effort: signed-out → false/false; skips the members query for the owner)
- [x] Both shared-watchlist pages gained a Join / Leave control shown to signed-in non-owners: mobile `app/w/[token].tsx` and desktop `desktop/src/pages/SharedWatchlist.tsx` (uses the auth hook + join/leave mutations, refetch on success)
- [x] Tests: server membership cases in `tests/shared-watchlists.test.ts` (owner / outsider / member / signed-out) + a wiring guard in `tests/desktop-chart-guard.test.ts` (now 164) — each verified non-vacuous; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2289 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [ ] Still deferred: `sharedWatchlists.invite(token, userId)` + a member roster UI. Inviting needs a user-lookup-by-email endpoint (and a privacy decision on email enumeration), so it is out of scope until that is agreed. `members` remains server-only.

## Phase 536: Collaborative share invites + roster (member management)

- [x] Completes the membership feature (Phase 535 wired join/leave). `invite` was unreachable from any client because it takes a raw numeric `userId`; there was also no way to see who a member was.
- [x] Server: `sharedWatchlists.inviteByEmail` (owner-only; normalises the email, exact-match lookup via `getUserByEmail` — no prefix search, so no enumeration beyond the address typed; invites as **viewer**), `sharedWatchlists.removeMember` (owner-only), and `members` now resolves display names/emails via `getUserById` for the roster. `invite` (by userId) is left intact.
- [x] Clients: both owner-side shared-link cards (mobile `app/(tabs)/settings.tsx`, desktop `Settings.tsx`) gained a member roster with per-member Remove and an invite-by-email input, in a `SharedLinkMembers` component (skipped for expired links, since `members` rejects those).
- [x] **Decision recorded:** invitations are viewer-only — the `editor` role has no enforced capabilities anywhere in the server, so exposing a role picker would imply powers that don't exist. No editor-write/ownership change was made.
- [x] Tests: `tests/shared-watchlists.test.ts` (inviteByEmail found/unknown/non-owner, removeMember owner-only, roster names; fake DB's `insert` now models `.onDuplicateKeyUpdate`) + a wiring guard in `tests/desktop-chart-guard.test.ts` (now 165) — each verified non-vacuous; E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2295 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 537: Members-only shares + "Shared with me" (real access control + delivery)

- [x] **(b) Members-only shares.** Added `membersOnly` to `shared_watchlists` (drizzle `boolean` default false + generated migration `0027_clean_rumiko_fujikawa.sql`), a `sharedWatchlists.setMembersOnly` owner-only mutation, and a gate in `get`: for a members-only share the token alone is refused with an actionable 403 ("Ask the owner to invite you"). Owner + invited members still see it. `list` now returns `membersOnly` so the owner UI can show the toggle.
- [x] **(a) Delivery / "Shared with me".** New `sharedWatchlists.listJoined` returns the shares the caller is a member of (with the owner's display name, dropping expired ones). Both platforms render a "Shared with me" list in Settings with Open (deep-links `/w/:token`) and Leave. Both owner-side link cards gained a "Members only" checkbox next to the invite field.
- [x] Tests: `tests/shared-watchlists.test.ts` (members-only gating for outsider/owner/member, `setMembersOnly` owner-only, `listJoined` mapping + expiry drop; fake DB now models `update`) + a wiring guard in `tests/desktop-chart-guard.test.ts` (now 166) — each verified non-vacuous. The three desktop Settings test mocks gained the new `sharedWatchlists` hooks.
- [x] Note: an owner enabling members-only should invite people first — the share link is then useless on its own. The invite itself still sends no email/push; "delivery" here means the share surfaces in the invitee's "Shared with me" list.
- [x] E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2300 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 538: Onboarding tour renders icons, not emoji

- [x] **Reported bug:** the first-run tour drew a hollow "tofu" rectangle above each title. The slides used bare emoji (`🛒`/`✨`/`🔔`), which need a system emoji font — absent on many Linux desktops, so the glyph rendered as an empty box.
- [x] Desktop `OnboardingModal` now renders lucide icons (`ShoppingCart`/`Sparkles`/`Bell`) in a tinted rounded slot; mobile `onboarding-screen` uses `IconSymbol` (`cart.fill`/`sparkles`/`bell`, all already mapped for Android/web) in a tinted circle. Captions unchanged.
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 167) asserting both surfaces carry `icon:` and no `emoji: "` — verified non-vacuous by reverting the desktop slide.
- [x] E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2301 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [ ] **Remaining emoji (76 sites, mirrored across both platforms)** — deliberately not swept in this commit. Categories: decorative prefixes in JSX (`💳`/`🕐`/`🎉`/`👀`/`🔥`/`🏅`/`🧺`/`🎯`/`➕`/`➖`/`📅`/`✏️`/`📋`), status glyphs (`❓`/`✅`/`⚠️`/`❌` in distributor health), and **notification titles** (`🟢 Back In Stock!`, `🧺 Basket Alert`, health alerts) which the OS renders. Many are pinned by existing tests (e.g. `"Add Custom Product ✨"`, `"👀 Watching"`). Needs a phased decision per category.

## Phase 539: Emoji sweep A — status glyphs and error states

- [x] Distributor-health status used emoji (`❓`/`✅`/`⚠️`/`❌`) on both platforms; now a coloured dot (desktop `Settings.tsx` returns a Tailwind `dot` class; mobile `scraper-status-section.tsx` returns the `color` and renders a dot). The status label already rendered on the right, so nothing is lost.
- [x] The two mobile error boundaries (`app-error-boundary.tsx`, `route-error-boundary.tsx`) drew `⚠️`; now `IconSymbol name="exclamationmark.triangle.fill"` in the existing tinted circle.
- [x] `tests/app-error-boundary.test.tsx` gained an `@/components/ui/icon-symbol` mock (its module, `expo-symbols`, doesn't parse under jsdom — same mock the other IconSymbol-rendering tests use).
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 168) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2302 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [ ] Still to sweep (category B): decorative JSX prefixes (💳 🕐 🎉 👀 🔥 🏅 🧺 🎯 ➕ ➖ 📅 ✏️ 📋 ✨). Category C (notification titles) deliberately left as-is — OS-rendered, emoji is conventional there. Also noted: `distributor.countryFlag` is an emoji flag used across many screens — a separate decision (would need a flag asset or country code).

## Phase 540: Emoji sweep B — decorative JSX emoji

- [x] Removed the decorative emoji prefixes/markers from ~22 mirrored UI files (trending, product card, deal-band badge, digest “Targets Hit”/➕/➖, insights “all-time low”, basket value/sheet, stock-watch “👀 Watching”, snoozed “😴”, reschedule/edit/reminder/import/manual-add/rename modal titles, payment-method and “Updated” lines, desktop equivalents). Added `+`/`−` (plain signs) where a marker carried meaning.
- [x] The three standalone celebratory `🎉` glyphs (desktop savings card; mobile savings card + “Lowest Price Ever”) became a **star icon** (lucide `Star` / `IconSymbol star.fill`) — the same concept on both platforms.
- [x] Label text kept otherwise, so accessible names stay meaningful; `✓` (U+2713, a font-safe dingbat — “Added ✓”, “Verified ✓”) is deliberately kept.
- [x] Updated the guards that pinned the removed emoji: 10 assertions in `tests/desktop-chart-guard.test.ts`, both `🔥` assertions in `tests/deal-score-surfaces.test.ts`, and `desktop/tests/nav-header.test.tsx`'s payment-methods line.
- [x] New guard: `has no decorative emoji left in the swept UI surfaces` (deny-list over the 22 files) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2303 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [ ] Category C left as-is by decision: notification titles/bodies (`🟢 Back In Stock!`, `🧺 Basket Alert`, `📈 Price Increase Alert!`, `💰 Price Alert Set`, `📦 Back-Order Reminder`, `📊 Price Digest`, health-alert titles) — rendered by the OS notification surface, where emoji is conventional and a system emoji font is present.
- [ ] Not swept: `distributor.countryFlag` (an emoji flag) is shown across many screens; converting needs a flag asset or country-code fallback — a separate product call.

## Phase 541: Device QA round 283 (digest body vs in-app card disagreed)

- [x] **The emoji sweep left the digest summary inconsistent with itself:** the in-app digest card now renders `+ 2 product(s) added` / `− … removed` / `Targets Hit`, but `lib/price-digest.ts` (the notification body, and the same lines the card shows) still built them with `➕`/`➖`/`🎯 `. A user reading the in-app digest and then the notification saw different markers.
- [x] Aligned the digest body to plain signs (`+`/`−`, no `🎯` prefix) so the in-app and notification content match. Notification **titles** keep their emoji by the category-C decision.
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 170) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2304 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 542: Device QA round 284 (desktop probed a rate-limited endpoint for connectivity)

- [x] **Mobile's connection probe hits the dependency-free liveness endpoint `/api/health`; the desktop's hit `/api/trpc/fx.get`.** That made the desktop's "are we online" signal depend on a *rate-limited* tRPC query (`fx.get`, 60/min) and on the FX provider path — a hiccup or a limit hit reads as **offline on a perfectly reachable server**. FX is warmed separately by the desktop's launch sequence, so the probe gained nothing.
- [x] Desktop `use-connection.ts` now probes `/api/health` with the same 3 s timeout, matching mobile.
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 171) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2305 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 543: Device QA round 285 (desktop logout left the previous account's data)

- [x] **Mobile's logout calls `clearAccountData()` — it wipes the previous account's synced collections (watchlist/alerts/reminders/watches/notification history/discovery/health) and the sync cursor, keeping device-local preferences. The desktop's logout only unregistered the push token and removed the session token**, so after signing out the previous account's watchlist, alerts, and reminders (plus a stale `lastSyncedAt`) stayed on disk — the next account signing in on that device inherited them and could push them to its own account.
- [x] Desktop `use-auth.logout` now calls `storage.clearAccountData()` (dynamically imported, mirroring the module's cycle-avoiding style). The desktop adapter's `multiRemove` also mirrors the clears into the Tauri file store, so the Rust side stops seeing the old account's watchlist too. `cancelAllNotifications` defaults to a no-op there (desktop reminders are server-delivered), so nothing expo-related loads.
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 172) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2306 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 544: Device QA round 286 (recent searches survived a wipe)

- [x] **`recent_searches` lives under its own key outside `STORAGE_KEYS`, so neither `clearAccountData` (logout) nor `clearAllData` (Settings → Danger Zone) removed it.** Consequence: "Clear all data" left the user's search terms behind, and the **next account on the device still saw the previous user's recent searches** on the Search screen (the same class as the Phase-543 desktop logout leak — `recently_viewed`, its sibling, *is* wiped).
- [x] Exported `RECENT_SEARCHES_KEY` from `lib/recent-searches.ts` and added it to both wipe lists; the desktop's `search-chrome.tsx` now aliases that key instead of re-typing `"recent_searches"` (a second definition that could drift from the one the wipe uses).
- [x] Test added to `tests/clear-account-data.test.ts` (both wipes remove the key) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2307 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 545: Device QA round 287 (error breadcrumbs outlived every wipe)

- [x] **The two error boundaries persist `last_error` (500 chars of `error.message`) and `last_route_error` to AsyncStorage, and nothing anywhere reads them** — unread diagnostics that can embed user data (error messages often interpolate ids/emails) and survived every wipe, including "Delete My Data".
- [x] Added both keys to `clearAccountData` and `clearAllData` (extended the wipe test to assert all three keys are removed by both).
- [ ] Open item recorded: those writes are dead (never read). A future round should either wire them into a support/crash-report flow or delete the writes — I cleared them on wipe rather than removing the writes so the apparent diagnostic intent isn't silently dropped.
- [x] E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2307 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 546: Device QA round 288 (mobile restock ignored a revoked permission)

- [x] **The mobile restock branch called `scheduleStockAlert()` with no permission check.** On iOS/Android `scheduleNotificationAsync` *resolves* even when notification permission has been revoked since the watch was created (the alert is scheduled but never presented), so `notified = true` and the watch was **consumed silently** — removed and written to the history with no alert. The price-drop path already guards this with `ensureNotificationPermission()` before deactivating an alert; restock now matches.
- [x] `lib/restock.ts` gates the native branch on `ensureNotificationPermission()`; without permission the watch is kept and retried next cycle (the desktop is unaffected — it passes a `notify` and takes the injected-channel branch).
- [x] Tests: permission-denied case added to `tests/restock.test.ts` (13) + the `ensureNotificationPermission` mock — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2308 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 547: Device QA round 289 (AlertSection skipped the permission gate)

- [x] **`components/product/alert-section.tsx` (the product detail's "Price Alert" card) created the alert and toasted "Alert created — watching for X" without first checking notification permission** — the only alert-creation path anywhere that didn't. The other three mobile paths (`app/product/[id].tsx` ×2, `app/compare/[id].tsx`) and the desktop (`checkNotificationPermission` inside `createPriceAlert`) all prompt/gate, so a user with notifications denied could add an alert on the detail page and never be notified, with no permission prompt.
- [x] `onAdd` now runs the same `ensureNotificationPermission()` gate with the standard "Permission Denied" copy (Platform/Haptics/showAlert were already imported).
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 173) asserting the gate sits between the price parse and `addAlert` — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2309 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 548: Device QA round 290 (the digest ignored the notifications master toggle)

- [x] **`maybeSendDigest` checked `digestFrequency` and quiet hours but not `settings.notificationsEnabled`.** Every other channel honours the master "Enable notifications" toggle (`lib/restock.ts` checks `notificationsEnabled !== false && stockAlerts`, `health-probe.ts` checks `notificationsEnabled && healthAlerts`, the Rust poller checks it for price alerts) — only the digest ignored it, so a user who turned notifications off but left a daily/weekly digest frequency kept receiving digests on both platforms.
- [x] Added the gate (`if (settings.notificationsEnabled === false) return null;`, `undefined` counts as enabled for old settings) — one place covers mobile and desktop since `maybeSendDigest` is shared.
- [x] Test added to `tests/price-digest.test.ts` — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2310 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [x] Also verified this round (no change needed): `drizzle-kit generate` reports "No schema changes" (migrations match `schema.ts`); the Rust tray badge already counted alerts+reminders+watches (consistent with the round-281 sidebar fix); `/w/:token` exists as a desktop route.

## Phase 549: Device QA round 291 (rate-limiter pruning truncated long windows)

- [x] **`server/rate-limit.ts`'s `pruneStale(maxAge)` pruned EVERY bucket using the *calling* endpoint's window.** So a short-window call truncated a long-window bucket's history down to the caller's window, silently loosening that endpoint's limit. Every endpoint currently uses 60 s, so there was no live impact — but `checkRateLimitByKey` accepts arbitrary windows, making it a landmine for the next endpoint that needs a longer one.
- [x] Buckets now carry their own `windowMs` and are pruned by it (`pruneStale()` no longer takes a caller window).
- [x] Test added to `tests/rate-limit-by-key.test.ts`: fill a 1 h bucket (limit 3) with three calls over 4 min, let a 60 s-window call trigger the prune, then assert the 4th long-window call is still refused. **Verified it fails against the committed pre-fix implementation** (via `git show HEAD:server/rate-limit.ts`) and passes with the fix. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2311 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 550: Device QA round 292 (basket alerts were delivered but never recorded in-app)

- [x] **Basket-value alerts fire once and then auto-disable, but were not written to the in-app notification history** — on either platform. The price-drop paths record explicitly ("otherwise the Notification Center only shows server events and the counts diverge"), as does restock and the desktop's Rust price-drop handler; the basket alert (and the digest) were the exceptions. So after a basket alert the only trace was a dismissible OS notification: the mobile Notification Center and the desktop Notifications tab (and their unread counts) never showed it.
- [x] Both basket paths now record the event after a successful fire, best-effort (a history write failure still clears the threshold / doesn't resurrect it): `lib/background-tasks/price-check.ts` and `desktop/src/lib/basket-alert.ts` (its `BasketAlertStorage` gained `recordNotificationEvent`). Tagged `type: "digest"` — the shared history/routing type whose destination is `/stats`, where the basket value lives (mobile already sends `data.type = "digest"` on that notification).
- [x] Assertions added to `tests/price-check.test.ts` (mobile) and `desktop/tests/basket-alert.test.ts` (records once on success, not on failure) — both verified non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `335 passed | 2 skipped` / `2311 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [ ] Open question (not changed): the periodic digest is likewise never recorded in the in-app history on either platform. Whether a periodic summary belongs in the Notification Center is a product call, so I left it.

## Phase 551: Device QA round 293 (the periodic digest was never recorded in-app)

- [x] Resolves the open question from Phase 550: **the periodic digest was the last delivered notification not written to the in-app notification history** on either platform, so the mobile Notification Center and the desktop Notifications tab (and their unread counts) diverged from what was actually delivered — while *server-batched* digests ARE recorded when pulled, and the routing table already maps `digest` → `/stats`.
- [x] Mobile `sendPriceDigestNotification` records after a successful schedule; the desktop digest notifier in `App.tsx` records after a successful `sendDesktopNotification`. Both use a day-keyed id (`local-digest-<YYYY-MM-DD>`) so a same-day retry dedups, and both are best-effort (a history write failure doesn't change delivery).
- [x] Tests: `tests/send-digest-notification.test.ts` (delivered → recorded with the right type/title/id; failed schedule → not recorded) + a source guard in `tests/desktop-chart-guard.test.ts` (now 175, anchored via `lastIndexOf` since the restock notifier shares the signature) — both verified non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2314 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [x] With this, every delivered notification path records to the in-app history: price-drop, restock, health, basket, digest, and pulled server events.

## Phase 552: Device QA round 294 (Stats price-history chart ignored dark mode)

- [x] **`desktop/src/components/MultiLineChart.tsx` (the Stats page's "Price History" chart) hardcoded light-mode greys** — `stroke="#e5e7eb"`, `fill="#6b7280"`, `bg-white` legend chips, a light-only tooltip — with no dark variants, so in dark mode its axes/labels were low-contrast and the legend rendered as white chips on a dark page. The sibling chart (`PriceHistoryChart`) is theme-aware via `useTheme()`, and the project convention is not to hardcode theme colors.
- [x] MultiLineChart now derives `isDark` from `useTheme()` and pairs every color (grid/axis/tick/label/tooltip/legend/activeDot/cursor) with a dark variant, using the same palette `PriceHistoryChart` uses.
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 175) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2315 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 553: Device QA round 295 (Compare's real chart still ignored dark mode; Stats colours diverged)

- [x] **Correction to Phase 552:** `MultiLineChart` is rendered by **Stats**, not Compare — Compare renders its own `SeriesChart`. So the round-294 fix was real but mislabelled, and **Compare's actual chart still hardcoded light greys** (`#e5e7eb` grid, `#6b7280` axis labels, `#0F52BA` hover cursor) with no dark variants. `SeriesChart` is now theme-aware via `useTheme()` (grid/axis/label/cursor paired), like the other charts. Phase 552's heading/description in this file were corrected.
- [x] **Stats' chart coloured distributors by index with its own duplicated `CHART_COLORS` array**, so a distributor could be blue on Stats and green on Compare (which uses the shared `distributorColor(id)` hash — the round-271 principle). Stats now derives the colour from `distributorColor(id)` in the same order as its series and the local palette is gone.
- [x] Guards added to `tests/desktop-chart-guard.test.ts` (now 177) for both — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2317 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 554: Device QA round 296 (Rates sparkline used the light brand blue in dark mode)

- [x] **`desktop/src/pages/Rates.tsx` drew every FX sparkline with a hardcoded `#0F52BA`** (the light-theme primary) and had no dark variant, so on the dark background the line was near-invisible. Mobile's `FxSparklineCard` draws it with `colors.primary`, which is theme-aware.
- [x] Rates now derives `isDark` from `useTheme()` and passes `isDark ? "#3B7DD8" : "#0F52BA"` (the same pair `PriceHistoryChart` uses).
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 178) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2318 passed`; desktop `tsc 0`, `50 passed` / `248 passed`
- [x] Note: the desktop's trend sparklines (`Watchlist.tsx`, `ProductDetail.tsx`) use Tailwind emerald/red hexes — internally consistent with the desktop's Tailwind palette, so left as-is.

## Phase 555: Device QA round 297 (desktop "Clear All Data" didn't say it re-syncs)

- [x] **For a signed-in device, the desktop's "Clear All Data" is effectively undone:** `clearAllData()` also wipes `SYNC_META`, so the next sync pulls from `lastSyncedAt = 0` and restores the watchlist/alerts/reminders/settings from the server. The button (red, in the Danger Zone, with an "Are you sure?" confirm) looked like a real wipe and then the data reappeared; mobile has no local-only clear (its "Delete My Data" removes the server account too), so there was no parity signal either.
- [x] The Danger Zone now shows, when signed in: "this clears this device's copy only… use 'Delete Account & Data' to remove it everywhere." (Signed-out local-first users keep the intended local reset.)
- [x] Guard added to `tests/desktop-chart-guard.test.ts` (now 179) — non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2319 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 556: the AI-discovery client sent no auth / BYO-LLM headers

- [x] Correcting my own round-298 note: the AI/LLM **settings are wired** (Phase 508's server-side proxy reads the `x-llm-*` headers the tRPC clients build). But **`lib/llm-discovery.ts`'s `discoverProduct` does a raw `fetch` (the tRPC client can't wrap its abort/timeout needs) with only `Content-Type` + cookies** — so:
  - **no `Authorization`/`x-device-id`:** `discovery.discover` is a `protectedProcedure`, and `establishSession` (the function that would set a session cookie) is **dead, never called** — so on native mobile and in the desktop app (sessions are Bearer tokens in storage, not cookies) the request was unauthenticated → 401 → the UI showed a bogus **"Sign-in Required"** even while signed in;
  - **no `x-llm-*`:** the user's configured BYO provider was **ignored for the flagship AI-discovery feature**, silently falling back to the built-in service.
- [x] Added an injectable `setDiscoveryHeadersProvider()` to `lib/llm-discovery.ts`; `discoverProduct` now spreads the provider's headers into its fetch. Extracted `trpcHeaders()` on both clients (mobile `lib/trpc.ts`, desktop `desktop/src/lib/trpc.ts`) — the same header object their tRPC links use — and registered it at each app root (`app/_layout.tsx`, `desktop/src/App.tsx`), mirroring the `registerSyncSetup` pattern.
- [x] Tests: `tests/llm-discovery.test.ts` (registered provider's headers are sent; none when unregistered) + a wiring guard in `tests/desktop-chart-guard.test.ts` (now 180) — both non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2322 passed`; desktop `tsc 0`, `50 passed` / `248 passed`

## Phase 557: Device QA round 302 (native import dropped restock watches)

- [x] **The desktop's native JSON import wrote five collections in Rust (`watchlist_products`, `price_alerts`, `back_order_reminders`, `app_settings`, `back_in_stock_watches`) but the renderer's rehydrate read only four** — `desktop/src/import-export.ts` pulled watchlist/alerts/reminders/settings back into localStorage and skipped the watches. So after "Import Backup", imported restock watches never reached the UI (the pre-import ones stayed), and the next renderer write mirrored that stale copy back over the imported file — exactly the split-brain the Rust's `storage-imported` comment was written to prevent.
- [x] Added `back_in_stock_watches` to the rehydrate (`invoke("read_value_for_key")` → `storage.saveStockWatches`).
- [x] Tests: `desktop/tests/import-export.test.ts` (behaviour: all collections rehydrate, watches included) + a cross-language parity guard in `tests/desktop-chart-guard.test.ts` (the Rust `import_watchlist` block and the rehydrate must name the same keys) — both non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2323 passed`; desktop `tsc 0`, `51 passed` / `249 passed`
- [x] Note: the Rust also emits `storage-imported`, which nothing listens for — harmless, since the renderer that triggers the import rehydrates itself in the same function. Left as-is.

## Phase 558: Device QA round 303 (Tauri insight path ignored the BYO-LLM provider)

- [x] **The desktop's price-insight fetch took the Tauri branch through the Rust `fetch_price_insight` command, which sent no headers at all** — so a configured BYO-LLM provider (`x-llm-*`) was silently ignored for price insights in the actual desktop app, while the browser path (tRPC client) and mobile both send them. (Only `discover` was fixed in round 299; this is the same class.) `fetch_product_image` is unaffected — images never used BYO.
- [x] Rust `fetch_price_insight` now takes `llm_headers` and sets each valid `HeaderName`/`HeaderValue` on the request; `ProductDetail` passes `llmHeaders: await byoLlmHeaders()`. Verified with `cargo check` (cargo 1.92 is available in this environment).
- [x] Tests: `desktop/tests/insight-skeleton.test.tsx` now mocks `byoLlmHeaders` and asserts the invoke forwards `llmHeaders`; a cross-language guard in `tests/desktop-chart-guard.test.ts` (now 182) checks the page passes them and the Rust applies them — both non-vacuous. E2E root `tsc 0`, lint 0 errors (157 warnings), root `336 passed | 2 skipped` / `2324 passed`; desktop `tsc 0`, `51 passed` / `249 passed`; `cargo check` clean

## Phase 559: Device QA round 304 (dead Tauri commands; JS↔Rust contract guards)

- [x] **Audited every `#[tauri::command]` against the renderer.** `get_app_data_dir`, `write_watchlist`, and `backfill_local_history` (plus its single-use `upload_server_history` helper) had **no caller on either side** — the renderer writes the watchlist through the allowlisted `set_value_for_key`, and the desktop backfills history through the TS path (`lib/history-sync.ts`); `git log -S` confirms no JS call site ever existed for the other two. Removed all four.
- [x] Verified with no defect found: the Rust scraper dispatch covers exactly the 25 shared parser ids (plus the `server2u-my` → `server2u` alias); Rust history retention (365-day window + same-day dedup) matches `appendPricePoint`; the tray badge's active-alert predicate matches `isAlertActive`, its reminder/watch counts match the mobile badge, and the price-drop gate (`notificationsEnabled && priceAlerts`, quiet hours correctly excluded) mirrors `lib/background-tasks/price-check.ts`; `is_allowed_storage_key` also guards `read_value_for_key`; the loopback OAuth listener bounds reads and ignores strays. Kept `check_price_drops` (0 JS callers, but named in `desktop/src/background.ts` as the event's origin; its inner fn runs via the poller).
- [x] Tests: new two-way contract guard in `tests/desktop-chart-guard.test.ts` (now 183) — every `invoke(...)`/`inv(...)` name must be a registered `#[tauri::command]` (a rename is a dead button at runtime, not a type error), the `TAURI_MIRRORED_KEYS` set must stay writable in Rust (drift = a silently-refused write and a localStorage/file-store split brain), and the removed commands must not return uncalled. Non-vacuous (renaming an invoke and re-adding a command each fail it). Root `tsc 0`, lint 0 errors (157 warnings), `2325 passed`; desktop `tsc 0`, `249 passed`; **`cargo test` 25 passed** (the Rust has parser unit tests — `cargo check` alone skips them)

## Phase 560: Device QA round 305 (dead Tauri event; JS↔Rust event-contract guard)

- [x] **Swept every Rust `emit(...)` against every renderer `listen(...)`.** `storage-imported` was emitted by `import_watchlist` with a comment claiming it told the renderer to reload, but **nothing in the renderer listened** — so it never did anything (the TS import path in `desktop/src/import-export.ts` already rehydrates the store from the Rust files itself). Removed the dead emit and the now-dangling comment reference in `desktop/tests/import-export.test.ts`. The other five events (`notification-activated`, `listing-updated`, `prices-checked`, `price-drops-triggered`, `health-check-progress`) are each both emitted and listened.
- [x] Tests: new two-way event guard in `tests/desktop-chart-guard.test.ts` (now 184) — every `listen(...)`/`once(...)` name must be emitted by the Rust, and every Rust `emit(...)` must have a listener (a rename on either side silently kills deep-links, live refreshes, and the poller's restock/digest work). Non-vacuous: re-adding the emit fails "emits but nothing listens" and renaming a listener fails "has no Rust emit". Extracted a shared `desktopSrcFiles()` walker for both contract guards. Root `tsc 0`, lint 0 errors (157 warnings), `2326 passed`; desktop `tsc 0`, `249 passed`; `cargo test` 25 passed

## Phase 561: Device QA round 306 (Rust parsers could not express `:contains`; offline parity restored)

- [x] **Audited the desktop's 25 Rust parsers against the shared `lib/scrapers/` set** — search URLs, currencies, price selectors, stock selectors and browser-escalation flags all matched except one real divergence: rocnoc's price selector. jQuery's `:contains()` is supported by cheerio but **not** by the Rust `scraper` crate, so the Rust variant had been silently swapped to a `[data-price]` list — and `parse_price_page` fell back to a *generic* selector list whenever a `:contains` selector was passed, so winncom's `td:contains('In Stock')` stock lookup was silently ignored too.
- [x] **Implemented `:contains(text)` in the Rust selector engine** (`scrapers/mod.rs`: `split_contains` + `select_selector_list` — document order, deduplicated, per-alternative skip instead of a whole-list fallback) and pointed rocnoc back at the shared selector. Rust unit tests cover a `td:contains('$')` price cell, a `td:contains('In Stock')` stock cell, and an unparseable alternative not killing the list.
- [x] Tests: `tests/desktop-scraper-parity.test.ts` no longer grants the `:contains` exception (parity is now required both ways); new guard in `tests/desktop-chart-guard.test.ts` (now 185) asserts both `:contains` selectors pass through unchanged and that the silent `or_else(...)` fallback cannot come back. Non-vacuous (reverting rocnoc's selector fails it). Root `tsc 0`, lint 0 errors (157 warnings), `2327 passed`; desktop `tsc 0`, `249 passed`; `cargo test` 27 passed (was 25); `cargo clippy` adds no new warnings

## Phase 562: Device QA round 307 (desktop model-matching was stricter than the shared parser)

- [x] **Ported the shared `matchesModel` corpus into the Rust engine as a test — it failed**, confirming a real parity gap: `text_mentions_model` normalised both sides into space-separated tokens and demanded whole-token boundaries, so it (a) rejected a card that glues the brand to the model (`"MikroTikCRS326-24G-2S+IN"`) and (b) had no commerce-suffix tolerance (`"+RM"`, `"-IN"`). The desktop therefore reported "no price found" for pages the server-side parser handles.
- [x] Rewrote `text_mentions_model` to mirror the shared rules exactly (as documented in `lib/scrapers/utils.ts`): a preceding LETTER is a brand concatenation and is allowed while a preceding DIGIT is not, a trailing separator in the model requires one character, and a 2-3 letter `COMMERCE_SUFFIXES` tail is tolerated after a trailing separator. Added `regex = "1"` (already a transitive dependency, so no new code is pulled in); removed the now-unused `normalize_model`.
- [x] Tests: the Rust now carries the shared 19-case corpus (`text_mentions_model_agrees_with_the_shared_parser`); `cargo test` 28. `tests/desktop-scraper-parity.test.ts` gained a guard that the Rust keeps the letter rule, the trailing-separator rule and an identical commerce-suffix list, plus the whitespace-less corpus on both sides. Non-vacuous (removing the letter rule or a suffix fails it). Root `tsc 0`, lint 0 errors (157 warnings), `2328 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` adds no new warnings

## Phase 563: Device QA round 308 (desktop browser wait hard-failed on the wrong selector)

- [x] **Compared the remaining unguarded parity dimensions**: rate limits (all 25 match) and browser `waitForSelector`s. Two real divergences in the desktop's browser escalation: (a) `fetch_with_browser_page` hard-failed the selector wait (`locator.wait_for(None)?`), so a missing selector discarded a JS-rendered page and fell back to plain HTML — which cannot contain results for JS-driven stores — after a 30s stall, while the shared path soft-fails after 10s and returns whatever loaded; (b) every Rust parser hardcoded `Some(".product-price, .price")`, ignoring the per-distributor wait target (aerial `.feat-pricerow`, miro `[itemprop='price']`, winncom `.product-link, .price`, bhphoto `.price, [data-selenium]`, pbtech/getic `.price`, mbsiwav `.product-views-price`, and `None` for rocnoc/neobits).
- [x] Fixed both: the wait is now soft (10s cap, error ignored, content returned) and the nine divergent parsers pass the shared selector (or `None`, matching mobile).
- [x] Tests: two guards in `tests/desktop-scraper-parity.test.ts` (now 5) — every browser-using Rust parser must wait for the same selector as mobile, and the wait must not be able to fail the fetch. Non-vacuous (reverting the aerial selector or the soft-fail each fails). Root `tsc 0`, lint 0 errors (157 warnings), `2330 passed`; desktop `tsc 0`, `249 passed`; `cargo test` 28 passed; `cargo clippy` adds no new warnings

## Phase 564: Device QA round 309 (shared stock parser missed a hyphen-less "Preorder")

- [x] **Ported the shared `parsePriceFromText` and `inferStockStatus` corpora into Rust tests** (from `tests/scraping-integration.test.ts`). Price parsing agreed on every case; the stock corpus exposed one real divergence — and this time the *Rust* was right: the shared list had `pre-order` but not `preorder`, so a store's "Preorder available" was classified **in_stock** server-side/mobile/browser while the desktop said `back_order`. A false in-stock can fire a false restock/in-stock signal.
- [x] Added the missing `preorder` marker to the shared `inferStockStatus` (`lib/scrapers/utils.ts`) — the server (`server/prices.ts`) and mobile both route through it, so the fix propagates — with the failing-then-passing test case.
- [x] Tests: the Rust now carries both shared corpora (`cargo test` 31); `tests/desktop-scraper-parity.test.ts` gained a guard that the Rust stock markers are an identical set to the shared parser's and that both platforms keep the same price/stock corpus strings. Non-vacuous (dropping `preorder` from either side fails it). Root `tsc 0`, lint 0 errors (157 warnings), `2333 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged

## Phase 565: Device QA round 310 (desktop price selection merged selector order and ignored hrefs)

- [x] **Audited the container logic against the shared `productRowContext` / `matchDepth` / `modelMismatch`.** Three divergences, each able to record a wrong price or drop a correct one on the desktop's offline fallback:
  - the Rust merged a comma selector list into document order, while `findPriceElement` treats alternatives as **priority order** (".actual-price, .price" must prefer the actual price even when the compare-at element comes first) and, within one alternative, prefers the element with the **shortest walk-up** to a model-matching card;
  - the context never consulted the product link **href**, though many cards name the model only in the URL;
  - the walk covered two ancestors of text only and rejected a context-free price, while the shared parser walks four levels (stopping at `body`/`html` so a page header cannot validate a decoy) and accepts a context-free price (fail open).
- [x] Ported the shared semantics into `parse_price_page` (`closest_matching`, `product_row_context`, `match_depth`, `model_mismatch`). `closest` had to include the element itself, because the crate's `ancestors()` starts at the parent (a card otherwise resolved to its shared row and matched every model in it).
- [x] Tests: `cargo test` 34 — the shared `modelMismatch` suite, an href-only card, and a selector-priority case (`".actual-price, .compare-at"` → 480, not 999); `tests/scrapers/utils.test.ts` gained the href case for the shared parser; `tests/desktop-scraper-parity.test.ts` (now 8) guards the helpers, href, walk start and alternative loop. Non-vacuous: dropping the href or reversing the alternative order fails.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2335 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged. (`tests/auth-functions.test.ts` "handleDeviceRevoked …" flaked once and passed on re-run — unrelated; noted as a known flaky test.)

## Phase 566: Device QA round 311 (flaky desktop auth test waited on a dynamic module load)

- [x] **Root-caused the `handleDeviceRevoked` flake** (seen once in round 310's run): the test waited for `invoke("send_notification", …)` inside `vi.waitFor`'s default 1s budget, but `handleDeviceRevoked` reaches notifications through a **dynamic `import("../notifications")`** — under a loaded parallel run the module load exceeded the budget (the failure ran 1006ms, i.e. the timeout itself).
- [x] Reproduced deterministically: with an artificial 3s delay on the notifications module the old assertion form failed at 1006ms, while the new form passes with the module still delayed. Mocked `../src/notifications` in `desktop/tests/auth-functions.test.ts` (the OS-notification payload stays covered by `tests/send-notification.test.tsx`) and asserted the call and copy against the mock. Non-vacuous: changing the copy fails it.
- [x] Kept the lint baseline at 157 (the new import sits above `vi.mock`; vitest hoists mocks). Root `tsc 0`, lint 0 errors (157 warnings), `2335 passed`; desktop `tsc 0`, `249 passed`; the auth file was run repeatedly with no flake.

## Phase 567: Device QA round 312 (shared price parser truncated malformed separator runs)

- [x] **Closed the last known parser divergence.** The shared `parsePriceFromText` ended with `parseFloat(normalized)`, which silently truncates a malformed separator run to a plausible-looking but wrong price — "1.2.3" → 1.2, "1,23,456" → 1.23, "1.234.56" → 1.234 — while the desktop's Rust parser fails closed (a strict `f64` parse). A price element holding such text would record a wrong price server-side/mobile.
- [x] Switched the shared parser to `Number(normalized)` (strict, keeping the same non-finite/zero rejection) so both platforms agree. Added the malformed cases to the shared corpus (failing first) and to the Rust corpus for parity; the parity guard's corpus sample list now includes "1.2.3".
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2336 passed`; desktop `tsc 0`, `249 passed`; `cargo test` 34.

## Phase 568: Device QA round 313 (timing-sensitive test audit; AGENTS.md seeding drift)

- [x] **Audited the rest of both suites for the round-311 flake class** (`vi.waitFor`/`waitFor` default 1s budgets versus a module load): the eight timeout-less `vi.waitFor` sites in the root suite all assert injected mocks, timers, or modules with no dynamic imports (`lib/sync.ts`, `server/prices.ts`, `lib/fx.ts`), and the only fire-and-forget dynamic import in app code was the `handleDeviceRevoked` path already made deterministic. Empirically, two full root runs (2336) and two full desktop runs (249) were clean.
- [x] **Fixed an AGENTS.md drift the audit surfaced:** the doc claimed "CRS804 + CRS326 are auto-seeded" in three places, while `SEED_IDS` (`lib/launch-seed.ts`) seeds seven products and only the two MikroTik ids also receive seeded price history (`lib/sample-data.ts`). Corrected all three, and added a guard in `tests/launch-seed.test.ts` that AGENTS.md names `SEED_IDS`/`lib/launch-seed.ts` as the source of truth. Non-vacuous (reverting AGENTS.md fails it).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2337 passed`; desktop `tsc 0`, `249 passed`; `cargo test` 34.

## Phase 569: Device QA round 314 (desktop HTTP fetch had no retry and treated blocks as content)

- [x] **Compared `fetch_html` with the shared fetch path.** The Rust set a real Chrome User-Agent, `Accept` and timeouts, but (a) had **no retry/backoff** where the shared `resilientFetch` makes three attempts with 1s/2s linear backoff, and (b) had **no block detection**: an anti-bot interstitial (Cloudflare "Just a moment", `cf-browser-verification`, a 403/429) was handed to the parser as content, so a blocked distributor only looked like "no price found" — and the request was retried against the block.
- [x] Ported the shared classifier (`BLOCKED_MARKERS`, `classify_fetch_status`, `FetchClassification`) and gave `fetch_html` the same retry policy: up to three attempts with 1s/2s backoff for transient failures (HTTP or transport), returning straight away with a clear "blocked" error on a block. The error type is now `String`; all 50 call sites already mapped through `map_err`.
- [x] Tests: the Rust carries the shared `classifyFetchStatus` corpus (12 cases; `cargo test` 35); `tests/desktop-scraper-parity.test.ts` (now 9) asserts the Rust `BLOCKED_MARKERS` list is identical to the shared one. Non-vacuous: dropping a marker fails the guard, dropping the 403/429 branch fails the corpus test. The retry loop itself is not unit-tested (no HTTP test server); the classifier policy it depends on is.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2338 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged.

## Phase 570: Device QA round 315 (desktop had no circuit breaker)

- [x] **Implemented the shared circuit breaker for the desktop's scrape path** (`scrapers/breaker.rs`, wired into `scrape_distributor`): a blocked distributor (anti-bot interstitial, from the plain or the browser path) is skipped for a 30-minute cooldown growing 1.5x per consecutive block up to two hours; hard errors cool down for a flat 15 minutes once three have accumulated; any success resets the entry. Previously the desktop re-scraped a blocking or down distributor on every refresh, compounding the block and burning a 15s timeout each time. `fetch_with_browser` now classifies what it loaded too (an interstitial is a failure, not content), matching the shared browser path.
- [x] Tests: six Rust unit tests pin the transition policy (blocked → 30 min; growth → 45 min → 2 h cap; errors cool down only at the threshold; success resets; blocked-message classification; cooldown expiry) — `cargo test` 41. `tests/desktop-scraper-parity.test.ts` (now 10) asserts the Rust constants and the 1.5x growth match the shared defaults. Non-vacuous: a drifted constant fails the guard, removing the threshold branch fails a Rust test.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2339 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged.

## Phase 571: Device QA round 316 (desktop browser context used US signals, localizing prices)

- [x] **Ported the shared region-aware browser context.** `createStealthContext` sets locale/timezone/geolocation from the distributor's region because — per the shared comment — hardcoded US signals made non-US stores localize currency/language, so the parser's static currency label no longer matched the rendered price. The Rust's `fetch_with_browser_inner` created a plain default context (host/browser defaults, effectively en-US/UTC), so the desktop could label a USD-rendered price as EUR/GBP on the browser-escalation path used by 17 distributors.
- [x] Added `RegionSignals` (the five shared presets), a `HOST_REGIONS` host→region table covering all 25 Rust distributors (generated from `shared/src/distributors.ts`), `host_of`/`region_signals_for`, and wired them into `new_context_with_options` (locale, timezone, geolocation + geolocation permission).
- [x] Tests: Rust unit tests for host parsing (scheme/www/port/userinfo/path) and the region lookup including the North-America fallback (`cargo test` 43). `tests/desktop-scraper-parity.test.ts` (now 11) asserts every Rust host maps to the shared distributor's region and that the five presets match `lib/scrapers/browser.ts`. Non-vacuous: flipping one Rust region fails it.
- [x] Not ported yet (still queued): per-domain cookie persistence/reuse, the anti-detection init scripts, and retrying the browser method. Root `tsc 0`, lint 0 errors (157 warnings), `2340 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged.

## Phase 572: Device QA round 317 (desktop browser path: no stealth script, no Accept-Language, no retry)

- [x] **Closed the rest of the browser/plain fetch parity gaps:** (a) the shared browser context installs an anti-detection init script (a default context reports `navigator.webdriver = true`, the first thing Cloudflare/DataDome check) and the Rust installed none, so it was challenged where the shared path was not; (b) the shared plain fetch sends `Accept-Language: en-US,en;q=0.9` and the Rust sent none, so a store could render a different language/currency; (c) the shared attempt loop retries the browser method up to twice with 1s/2s backoff, while the Rust made a single attempt before falling back to plain.
- [x] Ported all three: `STEALTH_INIT_SCRIPT` applied with `context.add_init_script`, the `Accept-Language` header in `fetch_html`, and a retry loop in `fetch_with_browser` that stops on a block (never retries one) and never retries a pool-acquire failure.
- [x] Tests: a new guard in `tests/desktop-scraper-parity.test.ts` (now 12) asserts every anti-detection override the shared script installs exists in the Rust script, that the Accept-Language values match, and that the retry constant/block short-circuit are present. Non-vacuous: removing the plugins override or the header fails it. Root `tsc 0`, lint 0 errors (157 warnings), `2341 passed`; desktop `tsc 0`, `249 passed`; `cargo test` 43; `cargo clippy` unchanged.

## Phase 573: Device QA round 318 (desktop browser path dropped cookies between fetches)

- [x] **Ported the shared cookie jar.** The shared browser path loads `$HOME/.cache/product-stock-finder/cookies/<hashDomain>.json` into each context before loading the page and saves `context.cookies()` afterwards, so a Cloudflare clearance (or cart/session cookie) is reused instead of being re-challenged on every fetch. The Rust created a fresh context per fetch and never saved or replayed anything.
- [x] Added `cookie_dir`/`cookie_file`/`load_cookies`/`save_cookies` and wired them into `fetch_with_browser_inner` (replay before, save after a successful page load). Ported `hashDomain` exactly — a 31x rolling hash over UTF-16 units as a signed 32-bit int in base 36 — so the Rust and TypeScript browser paths share one jar on the same machine.
- [x] Tests: Rust unit tests pin the ported hash against reference values computed from the shared `hashDomain` (a hash bug now fails cross-language) and the per-domain file path (`cargo test` 45). `tests/desktop-scraper-parity.test.ts` (now 13) asserts both sides replay and save cookies and use the same jar directory. Non-vacuous: changing the hash multiplier fails the Rust test, removing the save fails the guard.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2342 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged.

## Phase 574: Device QA round 319 (blocked scrapes reported "error" in the health probe; a third marker list)

- [x] **Fixed a regression from round 314 and de-duplicated the blocked-marker list.** `check_distributor_health` calls `scrape_distributor` and classifies a failure from its *message* with a local marker scan, which used to see the original `error_for_status()` text ("… (403 Forbidden) …."). Round 314's rewrite returned "Blocked by the site (HTTP 403)" instead, so a blocked distributor was reported as **"error"**, not "blocked", in the desktop health dashboard. On top of that, `lib.rs` kept a third, already-drifted copy of the list (a bare `challenge-platform` instead of the full CDN path).
- [x] `fetch_html`'s block error now keeps the HTTP reason phrase ("Blocked by the site (HTTP 403 Forbidden)"), extracted as `blocked_error_message(status)`; the plain error path reports "HTTP 500 Internal Server Error" rather than a bare number. `lib.rs`'s `is_blocked_error` now delegates to `scrapers::is_blocked_error` / `scrapers::BLOCKED_MARKERS`, and its duplicate list is gone.
- [x] Tests: `cargo test` 47 — the block message carries the phrase the shared marker list matches, and the health classifier returns "blocked" for it (and "error" for a network failure). The parity suite (now 14) asserts only one marker list exists in the Rust. Non-vacuous: restoring a local list fails the guard, dropping the reason phrase fails the Rust test.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2343 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged.

## Phase 575: Device QA round 320 (desktop watchlist dereferenced missing listings; feature-parity audit)

- [x] **Desktop↔mobile feature-parity audit** (settings sections, pages, tags, stats cards, alert actions, storage surface, legal links): everything is present on both sides — the desktop settings expose the same sections, tags are fully supported inline in `Watchlist.tsx`, the Stats page computes all seven cards, the alert actions match (snooze/edit/re-arm/delete), and the desktop reuses the shared `lib/storage`, `lib/watchlist-org` and `lib/currency`, so those surfaces cannot drift. One real gap surfaced.
- [x] **The desktop Watchlist dereferenced `product.listings` unguarded** in the price sort (`getBestPrice(a.listings, …)`) and the row render (`getBestPrice(product.listings, …)`), while the shared `sortWatchlist` and the mobile product card use `listings ?? []` (as does the desktop's own `getTrend`). `getBestPrice` calls `listings.filter(…)`, so a single product restored without `listings` (a partial backup or sync payload) threw and blanked the whole table. Guarded all three call sites.
- [x] Tests: a source guard in `tests/desktop-chart-guard.test.ts` (now 186) — in the style of the existing round-131 sort guard — asserts the guarded call shape and the absence of the unguarded ones. Non-vacuous (reverting the fix fails it). A behaviour test was written first but removed: rows are virtualized and React keeps the last committed tree in jsdom, so it could not discriminate.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2344 passed`; desktop `tsc 0`, `249 passed`; `cargo test` 47.

## Phase 576: Device QA round 322 (missing priceHistory aborted the refresh/backfill)

- [x] **Malformed-runtime-data sweep**: a probe over 25 shared display/aggregation calls with products missing `listings`/`name`/`addedAt` and listings missing `priceHistory` showed the whole display surface is safe — sort, filter, group, status, region, price-drop %, summary, price-change, deal score, rank, insights, drop calendar, share text. Three real gaps surfaced in the background paths.
- [x] `mergePriceHistory` spread its arguments, so a listing restored without `priceHistory` (partial backup/sync payload — the field is required by the type, so TS cannot catch it) threw; the throw escaped `refreshListingsWithinBudget` and aborted the whole price-check run. Guarded the helper and the call site's `.length`/`.slice` uses.
- [x] The mobile's `lib/history-sync.ts` read `listing.priceHistory.length` directly, while the desktop's copy had guarded it since Phase 241 — so one history-less listing aborted the mobile backfill. Mirrored the desktop's guard (an intra-platform parity fix).
- [x] Tests: `mergePriceHistory` tolerates a missing array on either side; `refreshListing` refreshes a listing whose `priceHistory` is missing; `backfillLocalHistory` skips a history-less listing and still uploads the next. Each is non-vacuous (reverting its guard fails it). Root `tsc 0`, lint 0 errors (157 warnings), `2347 passed`; desktop `tsc 0`, `249 passed`.

## Phase 577: Device QA round 326 (desktop accepted a snapshot exactly at the TTL)

- [x] **Audited the snapshot-freshness boundary** (Rust `fetch_server_price` vs the shared `isFreshPriceSnapshot`). The Rust rejected only `now - fetchedAt > TTL`, so a snapshot **exactly at the TTL** was accepted — while the shared parser (and its own test, "returns false exactly at the TTL boundary") rejects it — letting the desktop stamp an up-to-an-hour-old price as just-checked and append a fake history point. It also read `fetchedAt` with `as_i64()`, dropping any fractional stamp the JS client accepts through `Number.isFinite`.
- [x] Extracted `is_fresh_snapshot(fetched_at, now_ms)` comparing in **f64** with the strict `<` the shared parser uses (non-finite → stale) and switched the call site to `as_f64()`.
- [x] Tests: a Rust unit test mirroring the shared corpus (fresh / exactly at TTL / over / 2x / clock skew / NaN / ±Infinity / fractional) — `cargo test` 48 — plus a parity guard in `tests/desktop-scraper-parity.test.ts` (now 15) pinning both boundaries and the shared corpus line. Non-vacuous: widening the comparison to `<=` fails the Rust test **and** the guard.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2348 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged.

## Phase 578: Device QA round 327 (desktop poller converted with static FX rates)

- [x] **The Rust poller evaluated price alerts with the static rate table while the UI and mobile apply the live overlay.** `lib/currency.ts` merges `EXCHANGE_RATES` with the live rates loaded from `fx_rates` (`effectiveRates`), and the desktop renderer loads them too (App.tsx `loadFxRates`) — but `lib.rs`'s `convert_price` read only its own static copy, so the same alert could fire on one platform and not the other (and the notification body showed a differently-converted price). The static tables themselves match `shared/src/currency.ts` exactly.
- [x] Mirrored `fx_rates` to the Rust file store (renderer `TAURI_MIRRORED_KEYS` + the Rust `is_allowed_storage_key`, enforced by the round-304 guard), added a `LIVE_RATES` overlay refreshed at the start of every check, and made `convert_price` use `rate_for` (live else static) — the same merge semantics, dropping non-finite/non-positive entries like `setExchangeRates`.
- [x] Tests: a Rust unit test proves the overlay overrides the static table, an absent currency falls back, an unknown currency returns None, and clearing restores static (`cargo test` 49); the mirrored-keys guard now also requires the mirror entry and the overlay functions. Non-vacuous: ignoring the overlay fails the Rust test, dropping the allowlist entry fails the guard.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2348 passed`; desktop `tsc 0`, `249 passed`; `cargo clippy` unchanged.

## Phase 579: Device QA round 329 (desktop never ran a launch price check)

- [x] **Compared the two launch sequences** (mobile `app/_layout.tsx` vs desktop `launch.ts` + App.tsx). The desktop covers seed, poller, FX, sync, device cleanup, history backfill, a 60-second server-notification pull and the due health probe — but the mobile also runs **`checkPriceDropsNow()` on every launch**, and the desktop had no equivalent. Since `checkInterval` defaults to `"manual"`, a default desktop **never evaluated price alerts, restock watches, the basket alert or the digest** — they only ran after a manual Watchlist refresh or when the user enabled polling.
- [x] Added `checkPricesOnce` to `runLaunchSequence` (called after the FX warm-up so the conversion uses live rates; best-effort) and wired it in App.tsx to the same Tauri command the manual refresh uses (`run_full_price_check`, skipped when the watchlist is empty or outside Tauri).
- [x] Tests: `desktop/tests/app-launch.test.ts` gained "runs a launch price check like the mobile app" and "keeps launching when the launch price check fails" (7 tests); a parity guard in `tests/desktop-scraper-parity.test.ts` (now 16) ties the mobile's launch check to the desktop's. Non-vacuous: removing the call fails both.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2349 passed`; desktop `tsc 0`, `251 passed`; `cargo test` 49.

## Phase 580: Device QA round 330 (desktop never retried a failed sync on focus)

- [x] **Compared the mobile's foreground handler with the desktop's window-focus handlers.** The shared sync engine has no retry timer, and the mobile retries a failed sync when it returns to the foreground (`app/_layout.tsx`: retry when `getSyncMeta().lastSyncError`, debounced to once a second). The desktop's only focus hooks refreshed a queued-edit count / connection state — so a sync that failed while offline stayed failed until the next storage change or a manual "Sync now".
- [x] Added `desktop/src/lib/sync-retry.ts` (`createForegroundSyncRetry`: signed-in plus last-error gate, 1s debounce, swallows storage failures) and wired it into App.tsx on `focus` and `visibilitychange`.
- [x] Tests: `desktop/tests/sync-retry.test.ts` (6 cases — retry on failure, none when clean, none while signed out, debounce, retry after the window, metadata failure) and a parity guard in `tests/desktop-scraper-parity.test.ts` (now 17) tying the mobile handler to the desktop's. Non-vacuous: dropping the error gate fails a case; removing the focus wiring fails the guard.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2350 passed`; desktop `tsc 0`, `52 files / 257 passed`.

## Phase 581: Device QA round 331 (desktop kept the web-push subscription after sign-out)

- [x] **Compared the push registration lifecycles.** The mobile's web sign-out (`unregisterPushToken`'s web branch) unsubscribes the local browser subscription *and* prunes the server token; the desktop's logout only pruned the server token. The browser kept its `PushSubscription`, so `getPushStatus()` reported "on" with no server token — web push stayed silently broken after the next sign-in until a manual off/on.
- [x] Extracted `unsubscribeLocalWebPush()` from `disablePush()` and called it from the desktop logout (dynamic import, matching the existing trpc-cycle workaround), best-effort.
- [x] Tests: a new case in `desktop/tests/use-auth.test.tsx` asserts the local unsubscribe on logout (10 tests), and a parity guard in `tests/desktop-scraper-parity.test.ts` (now 18) ties mobile's web unregister to the desktop's. Non-vacuous: removing the call fails both.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2351 passed`; desktop `tsc 0`, `52 files / 258 passed`.

## Phase 582: Device QA round 332 (desktop never fired health alerts in manual mode)

- [x] **Found while comparing the digest implementations** — the server's "digest" turned out to be quiet-hours batching rather than the client price digest, so that pair is not a drift (a useful negative result). The real gap: mobile evaluates **health** inside `runPriceCheckCore` (`healthCollector.flush()`), so health alerts fire from every price check, while the desktop's health alerts came only from `runHealthProbeIfDue`, which returns early when `checkInterval === "manual"` — the default. A default desktop therefore never fired a distributor down/blocked alert.
- [x] Extracted `evaluateHealthAlerts` from the probe and added `recordHealthFromPriceCheck(results)`: records each Rust sweep outcome as a health sample (working / blocked via the shared `BLOCKED_MARKERS`, else error) and evaluates the alerts, with the same notifications/healthAlerts/quiet-hours gates. Wired into the `prices-checked` handler in App.tsx.
- [x] Tests: four cases in `desktop/tests/health-probe.test.tsx` (sample mapping incl. block classification, alert emission from the resulting history, disabled setting, empty sweep) and a parity guard in `tests/desktop-scraper-parity.test.ts` (now 19). Non-vacuous: removing the App wiring fails the guard; breaking the status mapping fails a case.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2352 passed`; desktop `tsc 0`, `52 files / 262 passed`; `cargo test` 49.

## Phase 583: Device QA round 333 (web-push notifications opened the app root)

- [x] **Traced the push deep-link chain** (server payload → service worker → click → route). The server sends `eventId`, `type` and `productId` ("Routing data for the service worker / client deep-link", `server/web-push.ts`) and `public/sw.js` has routing logic — but **both** service workers' push handler stored only `data: { eventId }` in the shown notification, so the click handler never saw the routing fields: the mobile's deep-link code was dead and `desktop/public/sw.js` always opened the app root. Every web push opened Home instead of the alert's product / the digest / health.
- [x] Both SWs now carry `{ eventId, type, productId }` in the notification data, and the desktop's click handler mirrors the mobile's routing (`productId → /product/{id}`, `digest → /stats`, `health* → /health`, else `/`), including `client.navigate(route)` for an already-open window.
- [x] Tests: `tests/sw-notificationclick.test.ts` gained routing cases plus a "carries the routing fields" case; `tests/desktop-sw-guard.test.ts` gained a sandboxed-SW behaviour suite (deep-link, digest, health, root fallback, routing fields). Non-vacuous: removing the desktop routing fails its cases; dropping the fields fails the data case.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2356 passed`; desktop `tsc 0`, `262 passed`; `cargo test` 49.

## Phase 584: Device QA round 334 (desktop external links dead in the packaged app)

- [x] **Route parity verified** — every desktop route exists (`/w/:token`, `/health/:id`, `/restock-watches`, …), the public share route is not auth-gated, and generated links target the SPA — then a real integration gap surfaced: the Tauri webview has **no host-side opener** (capabilities are core/notification/dialog/fs only), so `window.open` and `target="_blank"` never reach the browser. The evidence is in the repo: `start_oauth` already had to shell out through `open_system_browser`. In the packaged app the desktop's "Buy Now"/"View at distributor" links, the share link and the privacy/support links did nothing.
- [x] Added the `open_external` Tauri command (reusing `open_system_browser`, with an http/https/mailto scheme allowlist) and `desktop/src/lib/open-external.ts` (`openExternal` — Rust under Tauri, `window.open` in a plain browser — plus `externalLinkHandler`). Wired both RN/expo `Linking` stubs (covering every shared component) and the six desktop anchors in ProductDetail/Settings.
- [x] Tests: `desktop/tests/open-external.test.ts` (Rust path, browser fallback, preventDefault), a Rust unit test for the scheme allowlist (`cargo test` 50), and a guard in `tests/desktop-chart-guard.test.ts` (now 187). Non-vacuous: unregistering the command fails the guard (and independently the round-304 invoke-name guard); removing the stub routing fails it.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2357 passed`; desktop `tsc 0`, `53 files / 265 passed`; `cargo clippy` unchanged.

## Phase 585: Device QA round 338 (verified-email flag stayed stale on both clients)

- [x] **Auth-token invariant verified** (the round's entry point): `purgeExpiredAuthTokens` deletes only **expired or used** rows, so a valid link is never purged; `consumePasswordResetToken`/`consumeEmailVerificationToken` check both `usedAt` and `expiresAt` inside a `FOR UPDATE` transaction (race-safe one-shot); and the 1-hour TTL has a rate-limited resend reachable from both clients. No defect there.
- [x] **Real bug found on the way:** both clients cache the user and refresh it only at sign-in, while verification completes *outside* the app (an emailed link opened in a browser) — so `emailVerified` stayed false and the Settings "check your email" banner (with its resend button) survived until a re-login.
- [x] Added `lib/auth-refresh.ts` (`fetchCurrentUser` → `/api/auth/me`, validating the payload), made the mobile verify screen refresh + `publishAuthUser` after success, and gave the desktop `refreshCurrentUser()` called on Settings mount and window focus.
- [x] Tests: `tests/auth-refresh.test.ts` (mapping/coercion, unauthenticated, malformed, thrown, missing base), a desktop case asserting the republished flag, and a parity guard in `tests/desktop-scraper-parity.test.ts` (now 20). Non-vacuous: removing the mobile's refresh call fails the guard.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2361 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 50.

## Phase 586: Device QA round 339 (credential changes left old sessions valid)

- [x] **Security gap confirmed:** sessions are stateless 30-day JWTs with no epoch (`SignJWT({ openId, appId, name, deviceId? })`), and neither `resetPasswordWithToken` nor `POST /api/auth/change-password` invalidated anything — so after a password **reset** (the recovery path for a compromised account) an attacker's stolen session kept working until its token expired.
- [x] Fixed by reusing the app's existing per-device revocation (already enforced per request via `_core/context.ts` and already handled by both clients): added `revokeAllDevicesForUser(userId, exceptDeviceId?)`, called with **all** devices from the reset route and with **all but the current session's device** from change-password (`user.sessionDeviceId`). `resetPasswordWithToken` now returns the userId so the route can act on it. Also made `GET /api/auth/me` honour `assertDeviceAllowed`, so a revoked device can't keep refreshing its identity while the tRPC APIs already reject it.
- [x] Tests: a unit test for `revokeAllDevicesForUser` (all-but-kept, then everyone; verified via `isDeviceRevoked`), route-level assertions that a reset revokes with the token's userId and that change-password keeps the current device — run against the real route handlers. Non-vacuous: removing either call fails its test; ignoring the `exceptDeviceId` fails the unit test.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2363 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 50.

## Phase 587: Device QA round 343 (consolidation: dead autostart plugin, polish, session summary)

- [x] **Removed the dead autostart plugin** (found in round 337): it was installed and initialized with a `--autostart` argument nothing read, enabled by nothing, promised by no UI/docs, and not granted in `capabilities/default.json` — a Cargo dependency and init call doing nothing. Dropped both; `cargo check`/`cargo test` clean.
- [x] **Two polish items** from the audit notes: dropped the pass-through `checkNotificationPermission` wrapper in `ProductDetail.tsx` (importing the real helper directly) and gave the inline share-link Copy button the same failure toast the other copy paths have (it swallowed a clipboard failure silently). A new guard in `tests/desktop-chart-guard.test.ts` (now 188) asserts no clipboard write silently swallows its error — non-vacuous.
- [x] **Session summary — phases 579–586 each fixed a real bug the audit loop found:**
  - 579: the desktop never ran a launch price check, so with the default `checkInterval: "manual"` price alerts, restock watches, the basket alert and the digest were dormant.
  - 580: no focus-driven sync retry (the engine has no retry timer).
  - 581: the web-push subscription survived sign-out, leaving the toggle reporting "on" with no server token.
  - 582: health alerts never fired in manual mode (the interval-gated probe was the only path).
  - 583: web-push notifications opened the app root — both service workers stored only `eventId`, so the routing data never reached the click handler.
  - 584: desktop external links were dead in the packaged app (the Tauri webview has no host-side opener).
  - 585: the cached `emailVerified` stayed false after verifying via an emailed link in a browser.
  - 586: credential changes left old sessions valid (stateless 30-day JWTs); now other devices are revoked on reset, and all but the current one on password change.
- [x] Final verification: root `tsc 0`, lint 0 errors (157 warnings), `2364 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 50; `cargo clippy` and `cargo fmt` deltas unchanged.

## Phase 588: Full-codebase audit (eight scope-bounded subsystem reviews)

Method: eight parallel reviews (shared lib, storage+sync, server data/price, server notifications, mobile screens, mobile components, desktop renderer, Rust backend) reporting only evidence-backed defects; every claim was re-verified by reading the code and, where possible, reproducing it before any fix.

### Fixed (23 defects, commits 356b7745 / 15b7ae71 / 50616bd6 / 211b8081 / 4167c9c5)
- **Rust**: the same-day price-point merge overwrote a newer local point with an older server one; `start_oauth` bypassed the URL-scheme allowlist and the Windows `cmd /C start` argument was unquoted; the file store's fixed temp name let the renderer mirror and the poller clobber each other's atomic rename; export emitted `null` for never-written collections, so the app could not import its own export on a fresh profile; an unparseable `snoozedUntil` fired on the desktop where mobile suppresses it.
- **Sync engine**: after a push, the item's meta stamp (server push time) always exceeded the pull cursor, so `collectDirty` re-pushed it on every sync and each re-push inflated the stamp until a peer device's genuine edit looked stale forever; `persistSyncMeta` overlaid a stale per-item snapshot and downgraded a concurrent writer's newer stamp (silent lost update).
- **Shared lib**: `appendPricePoint` threw on a missing history (and the device-scrape branch then discarded its result); `priceDropPercent` and `suggestAlertPrices` used out-of-stock history (fake drops / unreachable alert targets); the `best_price` sort built a NaN comparator from a malformed `addedAt`.
- **Server**: `sharedWatchlists.join` bypassed `membersOnly`; the price-cache rotation map held the oldest rows, so the freshest pairs were re-warmed and stale ones skipped; the DB consume paths for password-reset and verification tokens did not fall back to the in-memory store (a token created during a transient DB error was permanently unusable).
- **Mobile UI**: Settings' "re-enable distributor" rebuilt the listings array from a mount-time snapshot, reverting every price/status/history change; alert and reminder creation set their in-flight guard after `await ensureNotificationPermission()`, so a double-tap created duplicates; the Alerts banner counted paused alerts; search reported a false "Added"; a failed settings read persisted fallbacks over saved filters; Compare latched "selection initialised" with no eligible series; BYO-LLM fields used placeholder accessibility labels; device rows had the separator flag inverted; empty drop-calendar days were buttons announcing drops.
- **Robustness**: FX history validated only the outer shape (a non-array series threw in the Rates useMemo); `readList` treated a valid non-array as empty without quarantining (the next write destroyed it); `dedupKeyFor` rendered digest keys as `reminder:undefined`.

### Verified, deliberately not fixed
- A session that never carried a device id survives a credential-change revocation (`revokeAllDevicesForUser` enumerates configured devices only). `tests/device-revoked.test.ts` explicitly pins the current model ("passes when no device header is present"), so closing it is an auth-model change: derive a server-side device id at login when the header is absent and bind it.
- In DB mode the notification dedup unique index plus `onDuplicateKeyUpdate id=id` silently drops a legitimate re-fire after the cooldown/grace (the in-memory path re-fires as intended). Needs a DB (`RUN_DB_TESTS`) to fix and test.
- Products added from the search results get `listings: []` and nothing discovers listings for them (`lib/listing-discovery.ts` is wired only into the manual-add sheet), so non-seed catalog products never show prices.
- `prices.uploadHistory` accepts dates up to +24h despite its "must not be in the future" message — accepted: the endpoint already trusts client-scraped data, and the tolerance protects a skewed client's backfill.
- In-memory notification maps (`memoryDeliveries`, `digestBuffers`) grow for the process lifetime in the DB-less fallback (test/dev path only).

### Verification
Root `tsc 0`, lint 0 errors (157 warnings), `2375 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 55; `cargo clippy` unchanged.

## Phase 589: Search-added products now discover listings

- [x] **Gap** (from the Phase 588 audit): `app/search.tsx`'s add stored `listings: []`, and the catalog carries no listings — so nothing ever fetched prices for a product added from search results. `lib/listing-discovery.ts` was wired only into the manual-add sheet, leaving every non-seed catalog product with "No distributor data available yet" on Watchlist/Detail/Compare, permanently.
- [x] Fixed by reusing the already-tested shared helper: after a successful `addToWatchlist`, `handleAdd` awaits `rediscoverProduct` (pumped by `discoverListings`, which searches every distributor server-first and updates the listing array). It runs *before* the tag sheet can open so the two writers cannot race, and its own failure is caught separately — the product stays added and the toast reports either the hit count or "no prices yet".
- [x] Tests: `tests/desktop-chart-guard.test.ts` guards that the search path wires `discoverListings`/`rediscoverProduct`/`updateProductListings` (non-vacuous — deleting the call fails it); the helper itself is already behaviour-tested by `tests/manual-add.test.ts` and `tests/listing-discovery.test.ts`.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2376 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 55.

## Phase 590: Upload-date tolerance and in-memory notification hygiene

- [x] **`prices.uploadHistory` accepted dates a full day in the future** despite rejecting them with a "must not be in the future" message: a point dated "tomorrow" (or later today) wins that day's LWW merge and, since `purgeOldHistory` only removes past days, outlives the retention. Tightened to a one-hour tolerance for client clock skew and corrected the message. Test: `tests/prices-router.test.ts` rejects +2 h and accepts +10 min.
- [x] **In-memory notification store leaks** (DB-less fallback): `purgeOldNotificationEvents` deleted `memoryEvents` rows but never dropped the ids from `memoryDeliveries`, so every device's delivered set grew for the process lifetime; `removeMemoryDevice` also left a held quiet-hours buffer in `digestBuffers` (`d:<deviceId>`), which a re-registered device would flush as stale held events. Both now cleaned. Test: `tests/notification-dedup-grace.test.ts`.
- [x] **Verified in the same pass**: the desktop's single-add search flow already discovers listings (`manualAddSheet`/`SearchModal` use `manualAddProduct`/`rediscoverProduct`), so Phase 589 restored mobile↔desktop parity rather than diverging.
- [ ] **Open (needs a budget decision, not fixed):** the **bulk** import flows on both platforms (`SearchModal.handleBulkImport`, `components/search/bulk-import-modal.tsx`) still add `listings: []` with no discovery, so bulk-imported products show no prices and there is no repair CTA on mobile. A fix needs a bulk-discovery policy (cap/queue) — reusing `discoverListings` per item would be 25 requests × N models.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2379 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 55.

## Phase 591: Products with no listings are repaired in bounded background batches

- [x] **Gap** (Phase 590's open item): both platforms' **bulk** imports (`SearchModal.handleBulkImport`, `components/search/bulk-import-modal.tsx`) stored `listings: []`, and nothing discovered them — so bulk-imported products showed no prices and mobile had no repair path. The same is true of any product whose listings were lost.
- [x] Added `rediscoverMissingListings({ storage, discover, limit })` to `lib/manual-add.ts`: finds watched products with an empty `listings` array (and a model number), then runs the existing `rediscoverProduct` for `MISSING_LISTINGS_PER_RUN` (2) of them, summing hits and swallowing a single product's failure so the next run retries it. Bounded because each discovery searches every distributor — a 20-item import drains over successive runs instead of firing 500 requests at once.
- [x] Wired on both platforms at their price-check seams: mobile in `app/_layout.tsx` right after the launch price check (Phase 579's), desktop in App.tsx's `prices-checked` handler alongside the health recording (Phase 582's). It deliberately does **not** go in `lib/background-tasks/price-check.ts`: a static import of `listing-discovery` pulls the scraper/expo graph into that module and breaks three otherwise-hermetic suites (verified, then moved).
- [x] Tests: three cases in `tests/manual-add.test.ts` (only empty-listing products, limit respected, a failing product doesn't stop the batch, default batch size) and a cross-platform wiring guard in `tests/desktop-scraper-parity.test.ts`. Non-vacuous: dropping the limit fails the helper cases; removing either call site fails the guard.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2383 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 55.

## Phase 592: Device-less sessions no longer survive a credential change

- [x] **Gap** (Phase 588's open security item): `revokeAllDevicesForUser` enumerates only devices with a notification config or push token, and the request paths only checked a device when the session carried one — so an attacker who signed in with a client that omits `x-device-id` kept access after the victim reset their password, and the session was invisible in the device list (unrevocable).
- [x] Fixed with a **user-scoped wildcard revocation**: `revokeAllDevicesForUser` now also writes `{deviceId: "*", userId}` (and the memory equivalent), and both request paths (`_core/context.ts`, `assertDeviceAllowed`) check `deviceId ?? "*"` — so a credential change kills device-less sessions without changing how ordinary sessions are checked. `unrevokeDevice` (called on a successful sign-in) also lifts the wildcard: proving the current password is exactly the evidence that the pre-change sessions must die and a fresh one may live, so it cannot lock anyone out.
- [x] Rejected an alternative: binding a generated device id to the user is impossible without a schema change — `device_labels` is keyed by `deviceId` alone (no `userId`), so label-only devices cannot be enumerated per user.
- [x] Tests: `tests/device-revoked.test.ts`'s pinned "no device header" case now asserts the wildcard check (`isDeviceRevoked(7, "*")`) and a new case proves a revoked device-less session is rejected; `tests/devices.test.ts` covers the wildcard being written and cleared by sign-in. Non-vacuous: reverting each of the three changes fails one test. Three route suites needed `getDb` added to their `db` mocks (memory path).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2385 passed`; desktop `tsc 0`, `266 passed`; `cargo test` 55.

## Phase 593: DB-mode notification re-fires were dropped (last audit item)

- [x] **Gap** (Phase 588's last open item, previously blocked for lack of a database): in DB mode a released dedup key never notified again. `isEventBlocking` releases a key after the cooldown (or the delivery grace when undelivered), but the insert was `onDuplicateKeyUpdate({ set: { id: sql`id` } })` — a no-op — so the row's `createdAt` stayed stale and the pre-check's "any existing key means already notified" rule suppressed every re-fire. The in-memory path re-keys by unique event id, which is why its tests passed and the DB path was untested.
- [x] **Unblocked the environment:** a MySQL 8.4 container was already running (`127.0.0.1:3307`) and the `mysql:8.0` image is present. Created a dedicated schema (`psf_audit_test`), applied the existing migrations with `drizzle-kit migrate`, and ran the DB-gated suites for the first time this session — **all 2403 tests pass** with `RUN_DB_TESTS=1 TEST_DATABASE_URL=…` (so the earlier batches are DB-clean too).
- [x] **Fix:** when a draft is past its window (the `blocked` filter only keeps unblocked keys), delete the stale row and re-insert, giving the re-fire a fresh event id — which the client's in-app history needs, since it dedupes by id — and re-arming the cooldown from now. Applied to both `evaluateConfigDb` and `evaluateUserDb`.
- [x] **Tests:** new DB-gated `tests/notification-refire-db.test.ts` — one event initially, quiet inside the cooldown and inside the grace, then past the grace exactly one event with a different id and `createdAt` at that tick, and quiet again in the re-armed window. Non-vacuous: restoring the no-op upsert reproduces the stale id. Three `tests/notifications.test.ts` db stubs needed a `delete` chain, and the now-unused `sql` import was dropped (the desktop build's `noUnusedLocals` caught it).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2385 passed` (18 skipped without a DB) / `2403 passed` (DB enabled); desktop `tsc 0`, `266 passed`; `cargo test` 55.

## Phase 594: Database-only branch audit (five parallel reviews, real MySQL)

- [x] **Method:** with a working MySQL available (`127.0.0.1:3307`, schema `psf_audit_test`), five scope-bounded reviews targeted the DB branches that had no real-DB coverage (price history/cache, insights/images, the notification store, the routers, devices/push/users) for the memory-vs-DB divergence class that Phase 593 proved real. Every claim was reproduced against the live DB before fixing.
- [x] **Fixed:**
  - `isDuplicateKeyError` never matched: Drizzle wraps driver errors in `DrizzleQueryError` (`code`/`errno` live on `.cause`, verified). Every duplicate insert rethrew — `notifications.uploadConfig` 500'd in a permanent client retry loop, and a duplicate event aborted a whole warmer tick. New `server/db-errors.ts` unwraps the cause chain (`isDuplicateKeyError`/`isForeignKeyError`), used by the notification store, the evaluator and `sharedWatchlists.create`.
  - **Security regression from Phase 589's fallback:** the token consume paths fell back to the in-memory store whenever the DB transaction returned null — including when the row existed but was used/expired — so a dual-stored token could be consumed twice and overwrite the victim's new password. The fallback now runs only when the DB has no row for that token.
  - `trending.refresh` deleted every trending row when the model returned zero usable rows, emptying the list for all users until the next refresh.
  - Quiet hours could never be cleared in DB mode (an absent field preserved the old setting). The clients now send an explicit `null` to clear, the schema accepts it, and the upsert stores NULL.
  - The client dropped each health event's `kind`, so a recovery deduped against its alert in the same hour bucket and was silently lost (`dedupKeyForHealth` documents exactly that collision).
  - Inviting an unknown user returned a 500; it now reports NOT_FOUND like the email path.
  - `upsertDeviceConfig`'s DB branch passed the raw `userId` to the health-event path instead of the preserved binding.
- [x] **Tests:** `tests/db-errors.test.ts` (the wrapped shape, non-vacuous), DB-gated `tests/token-double-consume-db.test.ts` (a dual-stored token's second reset is rejected) and `tests/server-db-branches.test.ts` (quiet hours cleared via the route incl. the schema's nullability, the invite FK → NOT_FOUND, a zero-row refresh keeps rows), plus the client `kind` fixture/assertion. All non-vacuous (each reverted fix fails its test).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2388 passed` (23 skipped without a DB) / **`2411 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55; `cargo clippy` unchanged.
- [ ] **Open (design decisions, reported):** credential-change revocation still misses sessions whose device id never registered a config/token (needs a session `iat`/epoch check rather than an enumeration); quiet-hours held digest drafts live only in process memory even in DB mode (a restart drops the batch, and `unbindDevice`'s DB branch doesn't clear the buffer); `deleteUserById` can leave a device label behind when the token was pruned earlier (the next account inherits it); `price-insights`/`product-images` lack the memory fallback on a DB error (a paid result can be discarded) and their test clears don't touch the DB. Low/cosmetic: case-insensitive collation collapses key case variants vs the exact-match memory store, and `decimal(12,4)` rounds prices the memory path keeps exact.

## Phase 595: DB-branch audit follow-ups (memory/DB divergence, resilience)

- [x] **Fixed:**
  - Held quiet-hours digest drafts live only in process memory even in DB mode, so `unbindDevice`'s DB branch (which deletes every DB row) left the buffer behind — a re-bound device would flush the previous owner's held events. New `clearDeviceDigestBuffer` in the notification memory store clears `d:<deviceId>`; `removeMemoryDevice` shares it and `unbindDevice` calls it in both branches.
  - `unbindDevice`'s memory branch did not delete `memoryLabels`, so a device label survived a direct unbind and leaked to whichever account bound that device id next (the DB branch already deleted the label). The two branches now match.
  - `price-insights`/`product-images` DB reads and writes had no `try`/`catch`: a DB blip turned a cache read into a 500, and a failed write **discarded an already-paid-for** LLM insight / generated image instead of keeping the memory copy. Both now fall back to memory on read and on write. Their orphan purges (called late in the warmer tick) are also guarded so a blip no longer aborts the remaining purge steps.
  - `clearInsightsForTests`/`clearImagesForTests` were synchronous and memory-only, so a DB-backed test run shared one schema with no reset (a row from an earlier test could serve a later one). Both are now `async` and clear their table when a DB is configured; call sites awaited.
- [x] **Tests:** two new DB-resilience cases each for insights and images (read falls back to memory; a failed write keeps the result) and two device cases (the label is dropped on unbind; the digest buffer is dropped on a DB-mode unbind), plus the async-clear call sites. All four behaviours proven non-vacuous by reverting each fix and watching the matching test fail.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2394 passed` (23 skipped without a DB) / **`2417 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.
- [ ] **Still open (needs a design decision, reported):** credential-change revocation misses sessions whose device id was never registered (needs a session-issued-at epoch rather than enumerating bound devices); low/cosmetic `case-insensitive collation` vs exact-match memory keys and `decimal(12,4)` rounding vs float.

## Phase 596: Credential-change epoch (sessions that can't be enumerated are now revoked)

- [x] **Problem:** `revokeAllDevicesForUser` invalidates sessions by *enumerating bound devices* (plus a `"*"` wildcard for device-less ones). A session whose device id was never registered — no config, no push token — matches neither, so it survived a password change until its JWT expired. Enumeration can never be complete, so this needed an epoch rather than a better list.
- [x] **Fix:** a per-user `users.credentialsChangedAt` (migration `0028`). A session token records the value it was minted under (`cca`); `authenticateRequest` rejects a token whose `cca` is below the stored value. Password **change** bumps it (inside `updateUserPasswordHashById`) and **reset** bumps it inside the existing consume-and-apply transaction; every mint site (register, login, both OAuth paths) stamps the current value. Legacy tokens with no `cca` are treated as epoch 0, so they are invalidated once an account changes credentials.
- [x] **Kept the current device signed in:** `/change-password` re-mints the caller's own session under the new epoch and returns it (plus a fresh cookie); the mobile and desktop clients persist a returned `sessionToken`, so only *other* sessions die. A reset leaves the user to sign in again.
- [x] **Tests:** `tests/credential-epoch.test.ts` (stale token rejected, current epoch accepted, legacy token rejected once the epoch advances, never-changed account unaffected), the change-password handler asserts the re-minted token carries the new epoch, and a DB-gated case in `tests/server-db-branches.test.ts` proves the column actually advances on a password change. All proven non-vacuous by reverting the check / the re-mint / the column write.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2398 passed` (24 skipped without a DB) / **`2422 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.
- [ ] Remaining low/cosmetic: case-insensitive collation collapses case variants vs the exact-match memory store; `decimal(12,4)` rounds prices the memory path keeps exact.

## Phase 597: In-memory price stores now match the DB's collation and precision

- [x] **Problem:** `price_cache`/`price_history` are keyed on `(distributorId, modelNumber)` under MySQL's default case-insensitive collation, and store `DECIMAL(12,4)`. The in-memory fallback used a case-sensitive `Map` key and kept the raw float, so the two backends disagreed: the DB collapsed `CRS804`/`crs804` into one row (later write wins) while memory kept two, and the same snapshot could round-trip with different precision depending on which store answered.
- [x] **Fix:** new `server/store-keys.ts` — `storeKey` folds case for the memory keys, `storagePrice` rounds to the DECIMAL(12,4) scale on the memory write path of both stores.
- [x] **Trap avoided:** `getAllFetchedAt`/`listNearExpiry` used to reverse-parse the memory key, so a naively folded key would have handed the warmer lower-cased identifiers and stopped it matching the catalog (it would re-warm the same first pairs forever). The memory cache now stores the original `distributorId`/`modelNumber` alongside the snapshot, so the fold never leaks out.
- [x] **Tests:** `tests/store-parity.test.ts` (8) covers case-folded lookups, a differently-cased write overwriting like the DB primary key, DECIMAL rounding for cache and history, and — as the guard for the trap above — that `getAllFetchedAt`/`listNearExpiry` return the original case. All proven non-vacuous by reverting the fold / the rounding / reintroducing the key reverse-parse.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2406 passed` (24 skipped without a DB) / **`2430 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.

## Phase 598: Client-path audit, batch 1 (sync push caps, browser block retry, notification routing)

Five parallel reviews covered the client sync engine, scrapers, and notifications. Fixes in this batch (each verified non-vacuous by reverting it):

- [x] **Sync push ignored the server's byte caps (HIGH).** `sync.push` rejects an item over 100 KB (`syncItemSchema` refine) or a payload over 5 MB, but the client only batched by `SYNC_PUSH_MAX_ITEMS`, and no byte cap existed in `shared/const.ts` — the exact "client ignores a server cap" class AGENTS.md warns about. A watchlist item carries up to 500 price-history points, so a full batch could exceed 5 MB and a single heavy product could exceed 100 KB; the rejected push was retried unchanged forever, silently wedging sync. Added `SYNC_PUSH_MAX_BYTES`/`SYNC_PUSH_ITEM_MAX_BYTES`, batched by the same `JSON.stringify(item.data)` metric the server uses, and trimmed an over-cap item's *pushed* history (never the local copy).
- [x] **Browser escalation retried a definitive block (HIGH).** `fetchWithBrowser` threw a generic `Error` for a 403 / unresolvable challenge, and `attemptMethod` only stopped on `BrowserUnavailableError`, so a blocking page was navigated up to 3× and the breaker took the transient-error path instead of the blocked cooldown. New `BrowserBlockedError`, handled as `blocked` + break.
- [x] **Web price-drop consumed the alert without showing anything.** The web branch dropped `displayWebNotification`'s result after the alert was already claimed (restock and basket paths guard this). It now throws so the existing catch re-arms the alert.
- [x] **Pulled health/digest notifications couldn't route on tap.** The pull passed only `productId` to `scheduleServerEventNotification`, so the locally-shown copy was tagged `server_event` and `notificationRouteFor` never mapped `digest`→`/stats` or `health`→`/health` (pushes carried the real type). It now forwards `event.type`.
- [x] **Web "Test Notification" always reported Permission Required** (`sendTestNotification` returned `false` unconditionally on web). It now uses the web notification path and reports its result.
- [x] **Browser context forced `navigator.languages` to `en-US`** for every region while `locale` followed the distributor's region, so a store that keys its currency off `navigator.languages` could render USD and yield a wrong-currency price. Derived from the region locale.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2408 passed` (24 skipped without a DB) / **`2432 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.
- [ ] **Reported, not yet fixed** (from the same reviews): tag removals never propagate because `applyLocalItem` unions tags (needs a per-product tag timestamp/tombstone); a full-resync drop can delete a local item that was never successfully pushed; `clearAccountData` doesn't stop an in-flight sync (logout race → cross-account residue); health alerts whose edge transition lands in quiet hours are lost rather than deferred; the tab badge is bound to the `(tabs)` route so it doesn't refresh on in-place mutations; a pulled `restock` event isn't suppressed for a watch the client already removed; `parsePriceFromText` takes the first digit run (latent); `.item` in `CARD_SELECTORS` can collapse a multi-product list; `.item`-list parsers; `scrapeMikrotikStore` passes relative hrefs to fetch; the resilient single-flight key omits the breaker store.

## Phase 599: Client-path audit, batch 2 (logout race, full-resync data loss, duplicate restock)

- [x] **A sign-out wipe could be undone by an in-flight sync (cross-account leak).** `clearAccountData` drained the storage queue but did not stop an in-flight `syncNow`, which could apply the pulled rows and recreate `sync_meta` (cursor + item stamps) after the wipe — so the next account's first sync would be incremental and skip rows. New `lib/sync-gate.ts` holds a session generation; `clearAccountData` bumps it and `doSync` re-checks it before applying and before persisting meta, aborting if it changed. (The `isSignedIn` ref is stale during the wipe, so it alone could not catch this.)
- [x] **A full resync could delete never-pushed local work.** The drop deleted any local item absent from the pull whose meta stamp predated the tombstone cutoff — but `markDirty` writes a meta entry for every signed-in edit, so an item that had never been successfully pushed (pushes failing for >30 days) was indistinguishable from a synced one and was deleted with no server tombstone. The drop now also requires the stamp to be at or before the last successful cursor, i.e. the item was actually confirmed once.
- [x] **A restock could notify twice.** The pull suppressed a stale `price_*` event for an alert the client had already fired/removed, but had no equivalent check for a `restock` event whose watch the client had already removed. It now skips a restock whose `watchId` is no longer held (a present watch still renders).
- [x] **Undo restored a reminder with a cascade-cancelled notification id.** When the undo re-schedule failed, the row kept the old id, so it looked armed but could never fire. It now stores `undefined`.
- [x] Tests: `tests/sync-logout-race.test.ts` (new), a never-pushed-item case in `tests/sync-engine.test.ts` (existing drop test made realistic by setting the cursor), restock suppression + the still-rendered control in `tests/sync-server-notifications.test.ts`, and a source guard for the undo fix in `tests/mobile-criticals.test.ts`. First three proven non-vacuous by reverting.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2412 passed` (24 skipped without a DB) / **`2436 passed`** with the DB; desktop `tsc 0`, `266 passed`.
- [ ] Remaining from the reviews: health alerts whose edge transition lands in quiet hours are lost rather than deferred; the tab badge is bound to the `(tabs)` route so it doesn't refresh on in-place mutations; `parsePriceFromText` first-digit-run (latent); `.item` in `CARD_SELECTORS` can collapse a multi-product list; `scrapeMikrotikStore` relative hrefs; the resilient single-flight key omits the breaker store; tag removals don't propagate (`applyLocalItem` unions tags).

## Phase 600: Client-path audit, batch 3 (quiet-hours health alerts, relative hrefs)

- [x] **Health alerts whose transition landed in quiet hours were lost forever.** `checkHealthAlerts` returned before detection when in quiet hours, but the working→down edge is observable for only one run — after `threshold` more probes the "before" sample is no longer working, so the outage was never alerted. It now detects and uploads regardless (the server holds the event and flushes it after the window — `scheduleHealthAlert` still suppresses the local OS notification inside its own quiet-hours gate, so quiet hours are respected). Test drives a transition with the window offset so "now" is inside it and asserts the health event is still uploaded; non-vacuous.
- [x] **`scrapeMikrotikStore` fed raw relative hrefs to `fetch`.** Link extraction returns relative paths; `fetch` throws on native and resolves against the app origin on web, so the function never fetched the product page (unlike `fetchAndParse`, which resolves via `new URL(resolved, searchUrl)`). Each hop is now resolved against the search URL; the test expectation was updated to the absolute URL and is non-vacuous.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2413 passed` (24 skipped without a DB) / **`2437 passed`** with the DB; desktop `tsc 0`, `266 passed`.
- [ ] Remaining from the reviews: the tab badge is bound to the `(tabs)` route so it does not refresh on in-place mutations (needs a multi-listener storage subscription — `setOnChange` is a single handler the sync engine owns); `parsePriceFromText` takes the first digit run (latent); `.item` in `CARD_SELECTORS` can collapse a multi-product list; the resilient single-flight key omits the breaker store; tag removals do not propagate (`applyLocalItem` unions tags — needs a per-product tag timestamp).

## Phase 601: Client-path audit, batch 4 (tab badge reacts to in-place mutations)

- [x] **The Alerts tab badge was stale after in-place mutations.** `useAlertBadge` runs from the `(tabs)` layout, whose `useFocusEffect` only fires when the parent route is entered — deleting/toggling/snoozing an alert on the Alerts tab, or adding a reminder, never re-ran it (unlike the Home stat card, whose effect is on a real tab screen). The count corrected only after navigating to a pushed screen and back.
- [x] **Fix:** `lib/storage/context.ts` now keeps a `Set` of change observers in addition to the single `setOnChange` handler the sync engine owns; `notify`/the suppression replay deliver to both, and `notify` no longer bails when only observers are registered. `createStorage` exposes `subscribeToStorageChanges(fn) => unsubscribe`, and the badge hook subscribes (plus keeps the focus refresh). The single-handler semantics of `setOnChange` are unchanged.
- [x] Tests: `tests/storage-change-listeners.test.ts` (2) — observers fire alongside `setOnChange`, unsubscribe works, and observers fire with no `setOnChange` registered (the case the old early-return dropped). Non-vacuous.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2415 passed` (24 skipped without a DB) / **`2439 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.
- [ ] Remaining, reported with recommendations (not changed — broad blast radius or need a data-model decision): `parsePriceFromText` takes the first digit run in an element (prefer numeric-only price nodes, or strip the model token); `.item` in `CARD_SELECTORS` can collapse a multi-product list into one card (drop the bare `.item` alternative or require it to be nearer than a `tr`/`li`); the `resilientFetch` single-flight key omits the breaker store (include a store identity so a deduped caller's breaker still records); tag removals don't propagate across devices (`applyLocalItem` unions tags — needs a per-product `tagsUpdatedAt`).

## Phase 602: Client-path audit, batch 5 (the four reported items)

- [x] **Tag removals never propagated across devices.** `applyLocalItem` unioned incoming and local tags, so a removal on one device was silently re-added by any other device's copy (and later re-pushed, resurrecting it everywhere). Tags now carry their own `tagsUpdatedAt` (set by `setProductTags`/`addTagsToProducts`), and the merge uses last-write-wins on it — falling back to the union only when neither side has a stamp (legacy data), so old local additions still survive. `tests/sync-tags-lww.test.ts` (4, non-vacuous).
- [x] **`.item` in `CARD_SELECTORS` collapsed a multi-product list.** It is a generic list/grid wrapper on many shops, so `closest` returned the wrapper (which names every product) instead of the per-product card, letting `modelMismatch` validate a decoy price. Removed the bare `.item` alternative; losing a parser that only marks its cards `.item` now yields a miss rather than a wrong price. All 324 scraper tests still pass; `tests/scrapers/utils.test.ts` pins the decoy case (non-vacuous).
- [x] **`findPriceElement` could select a cell whose own text embeds the model**, so `parsePriceFromText` read the model's digits (e.g. "CRS804-4DDQ-hRM $480.00" → 804). It now prefers a model-proximate candidate whose first digit run is not part of the model, falling back to the model-bearing one when it is the only match. Guarded in `tests/scrapers/utils.test.ts` (non-vacuous); the 324-test scraper suite is unchanged.
- [x] **The `resilientFetch` single-flight key omitted the breaker store**, so concurrent callers sharing a parser+URL but using different stores shared one outcome while only the first store recorded it (a store could miss a block it should have seen). Stores are now identified weakly and included in the key; same-store dedup is unchanged. `tests/resilient-fetch.test.ts` (+2: cross-store isolation, same-store dedup; non-vacuous).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2424 passed` (24 skipped without a DB) / **`2448 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.
- [x] **The client-path audit is now fully closed** — every finding from the five-agent review has been fixed or deliberately rejected with a reason.

## Phase 603: Server + client audit, batch 1 (push routing, digest, warmer, currency)

Three parallel reviews covered the server notification scheduler, the server services, and the client domain/UI helpers. Fixes (each verified non-vacuous by reverting):

- [x] **DB-mode background pushes lost their deep-link target.** The DB evaluator pushed raw `EventDraft`s (routing lives under `payload`) into `sendPushForDevice`/`sendPushForUser`, which read flat `productId`/`distributorId` — so a backgrounded price alert landed on Home instead of the product (the memory path flattened via `draftToEvent`). Both push sites now flatten; assertions strengthened.
- [x] **Quiet-hours digests repeated and duplicated conditions.** Buffering happened before the dedup check (an already-delivered alert reappeared in the morning digest), and `[...held, ...drafts]` was not deduped (the same condition was listed twice). Held drafts are now filtered by the blocked/pending set, and the merged list is deduped by dedupKey.
- [x] **Digest id could exceed `notification_events.id` varchar(128).** A long device id made `digest:<scopeKey>:<day>` overflow; the "Data too long" error is not a duplicate-key error, so it aborted the flush after the drafts were already consumed. The id is now a bounded hash of the scope (the readable dedupKey stays under its own 255 cap).
- [x] **`signOutDevice` wrote the revocation row before checking ownership.** Any signed-in caller could create a `(self, arbitrary deviceId)` row and lock themselves out if they later bound that id. Ownership is verified first (both branches).
- [x] **A failing warmer step skipped every later one.** One shared catch meant a transient error in, e.g., `purgeOldHistory` starved the remaining purges for that tick. Each step now has its own boundary.
- [x] **Warm rotation starved on pairs/products that never resolve.** `price_cache` gets no row for a failed scrape, so those pairs sorted first every tick and permanently occupied the slots. Both the catalog and image warmers now rank by `max(fetchedAt, lastAttempt)`, rotating past permanent misses.
- [x] **Orphaned device label + user-scoped held drafts.** Pruning a push token now drops a label that has no config binding left; unbinding a user's last device drops their `u:<userId>` held-digest buffer.
- [x] **Best Price card used a hardcoded USD conversion** while the rate line targeted the display currency (desktop already used displayCurrency), and "Lowest Price Ever" compared against unsorted, all-status history. Now uses the display currency and the sorted in-stock series.
- [x] **Movers and the Drop Calendar counted out-of-stock drops**, unlike every sibling analysis (price-change, insights, alert-suggestions). Both now filter to in-stock history.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2435 passed` (24 skipped without a DB) / **`2459 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.
- [ ] Reported, not changed: after a digest flush the constituent conditions can still re-deliver individually on a later tick (an existing test pins "resumes individual delivery on later ticks" — arguably intended, but it is a second notification for the same condition); the digest day bucket falls back to UTC while quiet-hours falls back to server-local time (differs only for a legacy client with no offset); `insights.get`'s single-flight map ignores the caller's BYO-LLM config (UX-only); the Alerts-tab "N alerts" count excludes paused/snoozed alerts that still render as cards.

## Phase 604: Client/server contract-parity sweep

Systematic pass over every server-side constraint (caps, enums, nullables, date windows in `server/routers.ts`, `server/routers/*`, `shared/const.ts`) checking each client sender against it. Two real drifts found and fixed, plus an anti-drift guard.

- [x] **`prices.uploadHistory` payloads were unsanitized.** Both clients trimmed to `MAX_UPLOAD_HISTORY_POINTS` but sent every point as-is, and the server's schema is strict: an exact ISO-UTC instant (regex), `price ∈ (0, 99_999_999]`, `currency ≤ 8`, a known `stockStatus`, and not more than an hour in the future. A single legacy date-only or corrupt point made the server reject the **whole listing's** history — silently, since the uploader swallows errors. New `shared/src/history-upload.ts` (`sanitizeHistoryPoints`) filters to conforming points then keeps the newest 200; used by mobile and desktop backfill. Tests: `tests/history-upload-sanitize.test.ts` + a cap-file case (both non-vacuous).
- [x] **The AI-discovery query was sent unbounded.** `discovery.discover` caps `query` at 200, but `discoverProduct` forwarded the raw input (the search fields have no maxLength), so a long paste failed with an opaque validation error. New shared `MAX_DISCOVERY_QUERY` used by the server and sliced client-side. Test added (non-vacuous).
- [x] **Anti-drift guard:** `tests/contract-parity.test.ts` pins the *wiring* — every shared cap must be referenced (outside comments) by both the server and each client that sends it, so replacing a constant with a literal or dropping a trim fails the suite. Proven non-vacuous.
- [x] **Verified already-parity (no change needed):** device label length (both UIs `maxLength={64}`), `notifications.uploadConfig` caps + `utcOffsetMinutes` range + health `createdAt` skew, `sync.push` item/byte caps, `registerPushToken` platform enum, `SYNC_PULL_MAX_ITEMS` (server-only by design — the client pages on `hasMore`), shared-watchlist token/email bounds.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2445 passed` (24 skipped without a DB) / **`2469 passed`** with the DB; desktop `tsc 0`, `266 passed`; `cargo test` 55.

## Phase 605: Desktop app audit (UI/state, Rust backend, lib wiring)

Three parallel reviews of the desktop client (the one surface this session had not touched). Fixes, each verified non-vacuous:

- [x] **Rust export wrote the BYO-LLM API key in plaintext (security).** `export_watchlist` serialized `app_settings.json` verbatim, including `llmApiKey`, into the shareable export/CSV file — the exact leak `lib/backup.ts` prevents with `stripDeviceLocalSettings`. New `strip_device_local_settings` removes it on export *and* import; unit-tested.
- [x] **Price alerts were consumed even when the notification failed.** The check discarded `show_notification`'s result and deactivated every triggered alert; on macOS/Windows (and Linux, where the routed path returned `Ok` unconditionally) a failed toast lost the alert permanently. The Linux path now propagates `show()`'s error and only delivered alerts are deactivated (new `deactivate_after_notify` helper, unit-tested).
- [x] **Desktop health recoveries were dropped by the server.** The desktop never sent `kind`, so a recovery deduped onto its alert (`health:<id>:<status>:<kind>:<bucket>`) and was skipped — the Phase-240 mobile fix never reached desktop. `health-probe.ts` and the desktop uploader now carry `kind` (tests assert both).
- [x] **Desktop web-push showed every event twice.** `desktop/public/sw.js` posts `web-push-shown` but nothing listened, so the 60s pull re-displayed each pushed event. `setupWebNotifications()` is now wired during init (guard test).
- [x] **Stale restock double-notification.** The desktop's pull lacked mobile's restock suppression for a watch the client already removed. Added.
- [x] **Re-enabling a distributor clobbered fresh data.** `handleReenableDistributor` rebuilt `listings` from the mount-time `products` snapshot and `updateProductListings` replaces the whole array, reverting every price/status/history change recorded since Settings opened (mobile reads fresh). Now reads `storage.getWatchlist()` (guard test).
- [x] **Dialogs stole focus on every keystroke.** `DialogOverlay`'s focus/scroll-lock effect depended on the inline `onClose`, so each parent re-render re-ran it and refocused the first element — a later field accepted one character before focus jumped (also churning the dialog stack). The handler now lives in a ref with the effect keyed on `open` (RTL test).
- [x] **Desktop `/api/auth/me` was unauthenticated.** `refreshCurrentUser` sent no `Authorization: Bearer`, and desktop sessions have no cookie, so the email-verification banner never cleared. It now sends the header (test asserts it).
- [x] Guards: `poller_interval_secs` saturates instead of overflowing the interval multiply (unit-tested); `Alerts.editDistributors` tolerates a product without `listings`; `Health.runTest` has a synchronous in-flight guard.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2445 passed` (24 skipped); desktop `tsc 0`, `270 passed`; `cargo test` 58, `cargo clippy` unchanged.
- [ ] Reported, not changed: the renderer mirror and the Rust poller both do whole-array read-modify-write on the same files with no shared lock (lost update on a concurrent add/tag/snooze during a long sweep) — needs a real concurrency design; Rust import is non-atomic across its 4–5 files; the Rust export/import wire shape (`exported_at`/`stock_watches`, no `format`) is incompatible with the shared backup schema (mobile↔desktop files do not interchange); desktop discovered products persist via IndexedDB while the UI reads localStorage; `useWatchlist`/`useAlerts` blank the page with a spinner on every background refresh; spawned `xdg-open`/`open` children are not reaped; the distributor cookie jar is written world-readable.

## Phase 606: Desktop audit follow-ups (backup interop, discovery store, refresh blanking, process/cookie hygiene)

- [x] **Desktop backups did not interchange with the shared format.** The Rust `ExportData` used `exported_at`/`stock_watches` and emitted no `format`, while `lib/backup.ts` requires `format: "product-stock-finder-backup"` + camelCase — so a mobile backup could not be imported on desktop (serde: missing `exported_at`) and a desktop export could not be parsed by the shared parser. The struct is now `rename_all = "camelCase"` with `format` (defaulted) and snake_case aliases for legacy desktop files, and `validate_import_schema` rejects a foreign `format`. Rust round-trip + legacy-acceptance unit tests; a TS test pins that `parseBackup` accepts the desktop shape.
- [x] **Desktop discoveries were written where its own UI could not read them.** `discoverProduct` persisted through the shared default store (IndexedDB-preferred) while the desktop reads its localStorage-backed store, so discovered products never appeared. `discoverProduct` now takes an injectable `DiscoveryStore` (defaulting to the shared one); the desktop passes its own `storage` (mobile unchanged). Test asserts the injected store receives the product.
- [x] **The desktop blanked the page on every background refresh.** `useWatchlist`/`useAlerts` reset `loading` on each `refresh()`, and the Rust poller emits `listing-updated` once per scraped listing — so the page flashed a spinner N times per sweep (resetting scroll/selection) and on every alert action. `loading` is now first-load only and later refreshes raise a new `refreshing` flag, matching mobile. RTL test.
- [x] **Spawned browser openers were never reaped** (`xdg-open`/`open`/`cmd`), leaking zombies for the app's lifetime; `spawn_and_reap` now waits on a detached thread.
- [x] **The distributor cookie jar was world-readable** (`~/.cache/.../cookies`, umask default 0644) despite replaying session/clearance cookies. Written 0600 with a 0700 dir on Unix; mode test.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2446 passed` (24 skipped); desktop `tsc 0`, `274 passed`; `cargo test` 61, `cargo clippy` unchanged.
- [ ] Reported, not changed (need design): the renderer mirror and the Rust poller both do whole-array read-modify-write on the same files with no shared lock; Rust import is non-atomic across its 4–5 files.

## Phase 607: Desktop audit — the two remaining items

- [x] **Rust import was non-atomic across its files.** `import_watchlist` wrote each collection's final file in turn, so a failure part-way (disk full, permissions) replaced some collections and not others while the UI still showed pre-import state. It now stages every collection to a sibling temp and only renames them into place once all writes succeeded (temps cleaned up on failure). Tests: an aborted staging leaves the existing file byte-identical with no leftovers, and the success path writes every file. Non-vacuous (writing finals directly fails both).
- [x] **The price check could revert a concurrent alert change.** `check_price_drops_inner` read `price_alerts` when the (minutes-long) check began and wrote that snapshot back at the end, so adding/snoozing/deleting an alert meanwhile was silently lost. Triggered alerts are now collected by **id** and the flags are applied to a copy re-read immediately before the write (new `deactivate_alerts_by_id`, unit-tested; `deactivate_after_notify` now pairs ids). The remaining window is the write itself rather than the whole check.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2446 passed`; desktop `274 passed`; `cargo test` 64, `cargo clippy` unchanged (4).
- [ ] Noted for a future pass: the renderer mirror still saves whole collections from React state, so a UI write built from a stale snapshot can overwrite a poller update between the JS read and the write — eliminating that needs per-item upsert commands rather than whole-array saves.

## Phase 608: Desktop watchlist writes merge instead of overwriting (lost-update fix)

- [x] **The last desktop concurrency item.** The renderer mirrored `watchlist_products` as a whole-array overwrite built from React state, so a UI save (add/remove product, edit tags/notes) that predated a poller price update reverted prices, stock status and history for every listing. New Rust `merge_watchlist` command + `merge_watchlist_products`/`merge_listings`:
  - the renderer owns the product set (a product absent is a deliberate removal and stays removed) and product-level fields;
  - the poller owns listing data — a listing whose on-disk `lastChecked` is newer is kept, and listings only the poller knows about survive.
  The renderer now mirrors the watchlist through `merge_watchlist` and writes the merged array back into localStorage so both stores agree. Other mirrored keys still use the plain setter.
- [x] Tests: 3 Rust merge cases (poller price wins + disk-only listing survives + UI tags kept, no resurrection of a removed product, an incoming-only listing kept; non-vacuous) and 3 desktop cases (watchlist uses `merge_watchlist`, other keys unchanged, merged result written back to localStorage; non-vacuous).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2446 passed`; desktop `277 passed`; `cargo test` 67, `cargo clippy` unchanged (4).

## Phase 609: Screen/component audit (effects, guards, races)

Four parallel reviews of the route screens and shared components (the largest surface not yet covered). Fixes:

- [x] **Duplicate alerts on a double-tap.** In `handleSetBestAlert`/`handleSetAlert` (product detail) and `handleCrossAlert` (compare) the `creatingAlert` flag was set *after* `await ensureNotificationPermission()`, so a second tap during the permission round-trip created a second alert + notification. The guard is now claimed before the await (finally clears it), and the existing source guards assert the ordering.
- [x] **Trending tag picker cleared the user's checks mid-edit.** The picker passed an inline product object, so its reset effect fired on every parent render (a `useToast` context update or a `useQuery` flip). The sheet now resyncs only when the product id changes (and on reopen).
- [x] **AI discovery claimed success for an already-tracked product.** `handleDiscover` ignored `addToWatchlist`'s `false`; it now reports "Already tracked" (matching `handleAdd`).
- [x] **A new toast could be swallowed.** The exit callback hid the toast unconditionally; starting a new toast during the 200 ms exit stops that animation (`finished === false`) and the stale hide dropped it. It now checks `finished`.
- [x] **`RouteErrorBoundary.getDerivedStateFromError` could itself throw** (unguarded `Intl.Segmenter`), crashing the boundary instead of rendering the fallback; guarded like the sibling `AppErrorBoundary`.
- [x] **`useLiveProduct` could persist the previous product's listings under the new id** on a same-instance id change (loaded never reset). `loaded` is now cleared at the start of each seed load.
- [x] **Compare re-seeded the chart after the user cleared it.** The one-time selection seed latched only when history was already present, so a deep-link-param selection cleared to empty later re-triggered the top-3 seed. Manual/param selections now latch.
- [x] **A failed settings write reverted unrelated changes.** `updateSetting` restored the whole render-time snapshot on failure, undoing a second change that had already committed; it now re-reads the store (falling back to reverting just the key).
- [x] **The device list blanked on every rename/sign-out** (loading flag reset per refresh); it now spins only on first load (new `devicesRefreshing`).
- [x] **The Alerts list and Notification Center never observed storage changes**, so a price check firing / a server event reconciling updated the badge but left the visible list stale. Both now subscribe (as the badge does); the Notification Center load also gained a generation guard against overlapping loads.
- [x] Guards: `tests/screen-fixes-source-guards.test.ts` (9, each reverted-fix-failing — spot-checked 3 mutations) plus the strengthened alert-ordering assertions in `tests/mobile-criticals.test.ts`.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2455 passed` (24 skipped); desktop `277 passed`; `cargo test` 67.
- [ ] Reported, not changed: the Alerts tab count excludes snoozed/disabled alerts that still render as cards; region *filter* uses "any listing in region" while region *group/sort* uses the first listing's region (semantics call).

## Phase 610: Guard-quality (mutation) pass — sampled the pre-existing suite

Method: for a sample of critical helpers, apply a semantic mutation that a good
guard should catch, run that module's tests, and report whether the suite fails
(caught) or stays green (a false-confidence gap). Every mutation was restored.

- [x] **Caught (guards discriminate):** quiet-hours window inversion (`isInQuietHours`); `isAlertActive` snooze branch removed; `convertPrice` multiply/divide swapped; `getTaxRate` own-property lookup replaced with `true`; `dedupKeyForHealth` `kind` dropped (caught by `tests/round10-guards.test.ts` — the bounds file alone does not cover it); `isDeviceRevoked`'s legacy-NULL global block dropped; resilient breaker error-threshold disabled; `syncNow` LWW comparison inverted. All produced failures in their existing tests.
- [x] **Rejected as not-a-gap:** disabling `modelMismatch`'s nearest-row gate left the parser suite green, but that is correct — the walk-up fallback behind it also rejects a page-level model match, so the behaviour is still guarded (defence in depth).
- [x] **Real gap found and closed:** `mergePriceHistory` (the merge used by `lib/sync.ts` to fold server history into local listings) had its own same-day last-write-wins logic but only a missing-array test — inverting its comparison (`p.date > existing.date` → `<`) left the whole suite green. Added three cases (server-later, local-later, invalid-date/window pruning) in `tests/price-history.test.ts`; each fails under the inverted comparison.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2458 passed`; desktop `277 passed`.

## Phase 611: Guard-quality (mutation) pass — second batch

Same method as Phase 610: semantic mutation per module, then its tests.

- [x] **Caught (guards discriminate):** `findBestDeal`/`findBestInStockListing` in-stock + positive-price gates dropped; `suggestAlertPrices` out-of-stock history filter dropped (`ignores out-of-stock history for near_low`); `tryConsumeBudget` never rejecting and its rolling window never expiring (both variants); `checkRestocks`'s `prevStatus !== "in_stock"` transition gate weakened; `DELIVERY_GRACE_MS` zeroed (dedup released early / blocked forever). Every mutation failed its module's tests.
- [x] **No new gaps:** all sampled areas were already protected; no production or test change was needed.
- [x] Tree unchanged from Phase 610 (`tsc 0`, lint 0 errors / 157 warnings, `2458 passed`; desktop `277 passed`).
- [x] **Cumulative sample: 14 areas, 1 real gap** (the `mergePriceHistory` same-day LWW, closed in Phase 610). Note the recurring nuance: a guard may live in a *different* file than the one you'd guess (`dedupKeyForHealth`'s `kind` separation is asserted in `round10-guards.test.ts`, not `dedup-key-bounds.test.ts`), so a green run of one file is not evidence of coverage.

## Phase 612: Web build / service-worker / startup audit

- [x] **Bundle verified clean (empirical).** Ran `pnpm build:web` and inspected `dist-web`: the web stub is a 755-byte `browser-*.js` chunk and the entry bundle contains **no** `playwright`, `drizzle-orm`, `mysql2`, `express`, or server-secret markers (`DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `cookieSecret`) — the only `express` hits are "regular expression"/"Super expression". So server-only code and secrets do not reach the public bundle. (`dist-web/` is gitignored and was removed.)
- [x] **Service worker kept a stale offline shell.** The navigation handler cached each response under the *navigated* URL (`/product/abc`) while the offline fallback reads `/index.html`, so the fallback always served the install-time copy (stale after a deploy unless `sw.js` itself changed) and the cache grew with entries nothing ever read. It now refreshes `/index.html` on every navigation. Guarded in `tests/sw-precache.test.ts` (non-vacuous).
- [x] **Verified the desktop SW has no fetch handler** (push/click only), so the caching concern is mobile-web only.
- [x] **Startup has no serial waterfall:** every launch effect in `app/_layout.tsx` is fire-and-forget (`void …`), so fx, price check, history backfill, push token, notification pull, device cleanup and listing discovery run concurrently.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2459 passed` (24 skipped).
- [ ] Reported, not changed: `/api/*` responses carry **no** `Cache-Control` (the SPA's `cacheControlFor` only covers the static shell), so a browser may heuristically cache a tRPC GET; the correct fix is a `no-store` middleware for `/api`, which means touching `server/_core/index.ts`. Observation only: the entry bundle is ~4.1 MB (minified, mostly react-native-web + charts), and launch fires ~7 concurrent requests.

## Phase 613: /api responses are never cached

- [x] **`/api/*` carried no `Cache-Control`.** The SPA's `cacheControlFor` only covers the static shell (`registerSpa` is mounted *after* the API routes), so a tRPC query — which is a GET — could be heuristically cached by the browser and a refresh could serve a stale price/alert. New app-level `server/api-cache.ts` (`registerApiNoStore` + a testable `apiNoStore` middleware) sets `Cache-Control: no-store` on `/api`, wired into `server/_core/index.ts` next to the other app-level registration hooks (like `registerSpa`).
- [x] Tests: `tests/api-cache-headers.test.ts` — a real express server over a socket asserts `no-store` on `/api/thing` and *no* header on a non-api route, plus a source assertion that the entry wires the hook. Both proven non-vacuous (dropping the header, and dropping the wiring, each fail).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2461 passed` (24 skipped); desktop `277 passed`; `cargo test` 67.

## Phase 614: Cross-parser model-gate conformance

- [x] **New area: the AGENTS.md parser rule applied to all 25 parsers at once.** "Every parser MUST thread the requested model through `parsePrice(html, model?)` and gate on `modelMismatch`" was only spot-checked per parser (4 parser tests had no wrong-model case at all: balticnetworks, flytec, interprojekt, mbsiwav). New `tests/scrapers/model-gate-conformance.test.ts` drives every registered parser against its real fixture with an impossible model (`__NO_SUCH_MODEL__`) and asserts `null`, and asserts the fixture set matches the parser set exactly (so a new parser without a fixture fails the sweep instead of silently escaping it).
- [x] **Result: all 25 parsers conform** — no parser reports another product's price when asked for a model that cannot be on the page.
- [x] **Non-vacuity is layered, which the sweep made explicit.** Disabling only `modelMismatch` (or only `findPriceElement`'s model filtering) leaves the suite green because each parser has *two* independent gates; disabling **both** shared layers fails 4 parsers (linitx, balticnetworks, flytec, neobits) while the other 21 still reject via their own checks. So the guard discriminates against a real removal of the contract, and the defence-in-depth is documented.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2488 passed` (24 skipped).

## Phase 615: Platform / app-config audit

- [x] **New area.** Audited `app.config.ts`, its referenced assets, the custom `plugins/`, and the server's association documents together — the pieces that must agree for deep links, push and background tasks to work on a release build.
- [x] **New guard: universal-link paths must match the router.** `server/spa.ts`'s `UNIVERSAL_LINK_PATHS` carries a "keep in sync with the router" comment but nothing enforced it: renaming a route keeps its OS association and the link silently opens the browser instead of the app. `tests/universal-link-paths.test.ts` derives the real route patterns from `app/` (dynamic segments, `(group)` dirs, `_` partials, directory wildcards) and asserts every associated path has a matching route. Non-vacuous (a bogus `/no-such-route` entry fails it).
- [x] **Verified correct (no change needed):** all six referenced image assets exist; `expo-build-properties` `android.buildArchs` is a real option; the AASA shape is the modern `appIDs` + `components` form and `assetlinks.json` uses `relation`/`namespace`/`package_name`/`sha256_cert_fingerprints`; the reset/verify emails link to `/reset-password` and `/verify-email`, both of which are associated; `app/reset.tsx` aliases `reset-password`; `lib/push-token.ts` skips gracefully without a project id; `web.output` is still `"single"` (the SPA invariant); both custom plugins exist; the background-task plugin is present for iOS `UIBackgroundModes`.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2489 passed` (24 skipped).
- [ ] Recommendation, not changed (build-config change that needs a prebuild/EAS to verify): `expo-notifications` is absent from `plugins`, so Android notifications have no small icon/colour configured — on Android 8+ a full-colour app icon renders as a white square (the adaptive-icon monochrome asset is a different thing and is not used for this). Adding `["expo-notifications", { icon, color }]` is the fix, but it should be done alongside a real device build.

## Phase 616: Desktop Tauri config / capabilities audit

- [x] **New area.** Audited `desktop/src-tauri/tauri.conf.json`, the capability grants, `Cargo.toml` and the CSP together — the webview's trust boundary (one XSS away from the whole command surface).
- [x] **New guard: the capability/CSP boundary is now pinned.** `desktop/tests/tauri-capabilities.test.ts` asserts (a) no capability grants a shell/process/execute/spawn/http/unrestricted permission, (b) every capability is scoped to `main` only, and (c) the CSP keeps its hardening invariants (`script-src 'self'`, `object-src 'none'`, `frame-src 'none'`, no `unsafe-eval`, non-empty). Non-vacuous: adding `shell:allow-execute` and stripping `script-src 'self'` each fail their assertion.
- [x] **Verified correct (no change needed):** `Cargo.toml` pulls only `notification`/`dialog`/`fs` plugins (no shell/process/http) and no `devtools` feature; the capability targets `main` only; the CSP already blocks inline/remote scripts and eval; **no `dangerouslySetInnerHTML` anywhere in the desktop, mobile or web renderers** — and the `fs` default scope is app-dirs-only, but the dialog plugin extends it for the picked path (`allow_file`/`allow_directory` in `tauri-plugin-dialog`), so import/export to a user-chosen file works on a release build.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2489 passed`; desktop `280 passed`; `cargo test` 67.
- [ ] Reported, not changed (hardening; needs a desktop build to verify the runtime change): `app.withGlobalTauri: true` exposes `window.__TAURI__` to any script in the webview, and the renderer only needs it for the `window.__TAURI__` presence check in `desktop/src/storage.ts`. Switching to `isTauri()` from `@tauri-apps/api/core` and setting `withGlobalTauri: false` removes that surface; likewise `connect-src` allows any `http(s):` origin (deliberate — the API/BYO-LLM host is build-configurable — but narrower per-env values would be stronger). No updater plugin is configured, so the app has no auto-update path.

## Phase 617: Server auth-flow deep-dive, batch 1 (account takeover + signing key + throttle)

Three parallel reviews of the auth routes, the session/middleware layer, and the transport/abuse-control layer. Batch 1 covers the account-security findings:

- [x] **OAuth account pre-hijack (High).** `linkUserOpenIdByEmail` rebound a verified provider identity onto an existing row while leaving its `passwordHash` intact — so an attacker who pre-registered the victim's address kept a parallel password login on the victim's account after the victim used "Sign in with Google". Linking now clears `passwordHash` and bumps `credentialsChangedAt` (provider-verified email proves mailbox control; the epoch also kills sessions minted with that password). DB-gated test at both ends (password evicted + epoch bumped; an OAuth-only account is untouched) — non-vacuous.
- [x] **Predictable signing key outside exactly-`production` (High impact).** Both `ENV.cookieSecret` and the OAuth `stateSecret()` fell back to the constant `dev-secret-change-in-production` unless `NODE_ENV === "production"` exactly, so a built server started without `NODE_ENV` (or as `staging`/`prod`) signed sessions with a publicly-known key — forgeable session tokens. They now derive a per-process ephemeral 32-byte secret (dev keeps working; sessions just do not survive a restart), and the constant is gone from both modules. Guarded (ephemeral secret is 64 hex chars ≠ the constant; a source assertion forbids the literal).
- [x] **Login had no per-account throttle (Medium).** Only `login:<ip>` existed, so a distributed spray under the per-IP limit had unlimited guesses; added `login:acct:<email>` exactly as `forgot`/`change-password` do. Guarded (11 attempts from distinct IPs on one account → 429; non-vacuous).
- [x] **Login timing oracle (Low).** An unknown email returned before any hashing, measuring faster than a wrong password; it now compares against a lazily-built dummy bcrypt hash first.
- [x] **OAuth sign-in did not lift the user's wildcard revocation (Medium, regression from Phase 592).** The callback/consume minted a fresh session but never called `unrevokeDevice`, so after a password change a web OAuth session passed the epoch check yet `/api/auth/me` (device-less) 403'd — the app looked signed out while tRPC kept working. Both OAuth paths now lift the wildcard like `/api/auth/login` (test mocks updated to provide `getDb`).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2492 passed` (26 skipped without a DB) / **`2518 passed`** with the DB.
- [ ] Batch 2 (transport, next) + reported-not-changed: registration reveals whether an email is taken (`tests/auth-error-leak.test.ts` currently enshrines it — a product call); the OAuth `state` is signed/single-use but not bound to the initiating browser, so a captured callback URL is login-CSRF (needs a state cookie/PKCE); `trust proxy` is hard-coded to 1.

## Phase 618: Server auth-flow deep-dive, batch 2 (transport / abuse control)

- [x] **Unauthenticated 10 MB body buffering (Medium DoS).** `app.use("/api/trpc/sync.push", json({limit:"10mb"}))` is a *prefix* match, so `/api/trpc/sync.pushX` (and anything else starting with that string) got the large parser before any auth — the memory-amplification hole the 256 kb default exists to close. The parsers/CORS moved to `server/http-middleware.ts` and the large limit now matches only the procedure (`sync.push` or the batched `sync.push,other`). Guarded over real sockets (large body → 200 on the procedure, 413 on `/sync.pushX` and on `/api/auth/login`; non-vacuous).
- [x] **Unbounded auth rate-limit buckets (Medium).** `authBuckets` was a local `Map` with no cap: a burst of unique keys (an attacker-supplied email on `/forgot`) grew it without bound and, past 500 entries, every request scanned the whole map (O(n²) in a window). It now delegates to the shared capped+LRU limiter (`checkRateLimitByKey`). Guarded by a source assertion.
- [x] **CORS blocked BYO-LLM cross-origin (Low feature break).** `Access-Control-Allow-Headers` omitted `X-LLM-*`, so the preflight rejected every discovery/insight/`llm.test` call from a cross-origin client. Added (and pinned in the middleware test; non-vacuous).
- [x] **Bare `/api` and `/storage` served the HTML shell (Low).** Only `/api/…` matched the fallback's 404 rule; `/api` fell through to `index.html` with 200. Fixed + test extended (non-vacuous).
- [x] **Oversized `x-device-id` became a session claim (Low).** The request path clamped the header to 128 chars but `deviceIdFromReq` (which feeds the JWT claim every later request trusts) did not, so a long value overflowed the `varchar(128)` device columns. Clamped at the source; guarded via the login route (non-vacuous).
- [x] **Apple `id_token` algorithm not pinned (Low).** Added `algorithms: ["RS256"]` (source-guarded).
- [x] **Login timing oracle** now guarded by a source assertion (the dummy-hash compare).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2498 passed` (26 skipped without a DB) / **`2524 passed`** with the DB; desktop `280 passed`; `cargo test` 67.
- [ ] Reported, not changed: registration reveals whether an email is taken (`tests/auth-error-leak.test.ts` enshrines it — a product call); the OAuth `state` is signed/single-use but not bound to the initiating browser, so a captured callback URL is login-CSRF (needs a state cookie or PKCE); `trust proxy` is hard-coded to 1 (IP limiters are spoofable if the app is ever reached without exactly one trusted hop).

## Phase 619: OAuth login-CSRF (state bound to the initiating browser)

- [x] **The gap.** The OAuth `state` was HMAC-signed, expiring and single-use — replay-safe, but not bound to the browser that started the flow. An attacker could start the flow with their own account, capture the `/api/oauth/callback?code=…&state=…` URL before it was followed, and lure the victim into opening it; the callback then set the **attacker's** session cookie in the victim's browser (login CSRF / session fixation).
- [x] **Fix.** `/api/auth/oauth/start` now also sets a 10-minute httpOnly cookie holding the state nonce (reusing `getSessionCookieOptions` for path/secure/domain), and the callback requires the request to echo it (constant-time compare, cleared afterwards). The signed single-use nonce still gates replay; the cookie gates *which browser* may complete.
- [x] **Platform details that would otherwise break logins:** native flows skip the check (their protection is the device-scoped ticket, and the app's `/start` request cannot set a cookie in the system browser), and Apple — which posts the callback cross-site via `response_mode=form_post` — gets `SameSite=None; Secure` (a Lax cookie is not sent on a cross-site POST at all).
- [x] Tests: the web callback rejects a request without the cookie (no session cookie set, `error=invalid_state`); `/start` sets the nonce cookie (so removing it would break every web login); the Apple flavor is `SameSite=None; Secure`. All three non-vacuous.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2501 passed` (26 skipped without a DB) / **`2527 passed`** with the DB; desktop `280 passed`; `cargo test` 67.
- [ ] Still reported, not changed: registration reveals whether an email is taken (a test enshrines it — a product call); `trust proxy` is hard-coded to 1.

## Phase 620: `trust proxy` is configurable instead of hard-coded

- [x] **The gap.** `app.set("trust proxy", 1)` was hard-coded, so if the app is ever reached directly (no proxy) — or behind a longer chain (CDN + nginx) — `req.ip`/`req.protocol` become client- or intermediate-controlled: a client sending `X-Forwarded-For` rotates every rate-limit bucket at will, and `X-Forwarded-Proto` can influence the `Secure` cookie decision.
- [x] **Fix.** New `resolveTrustProxy(raw)` in `server/http-middleware.ts`, wired as `app.set("trust proxy", resolveTrustProxy(process.env.TRUST_PROXY))`. Default stays 1 (one trusted hop — the current, correct-for-one-gateway assumption); `TRUST_PROXY` accepts a hop count, `false`/`0` (direct exposure — never believe a client header), `true`, or a comma-separated IP/CIDR list (the safest).
- [x] Tests: each override parses as expected plus a source assertion that the entry actually uses the helper. Non-vacuous (making the resolver return a constant fails it).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2503 passed` (26 skipped).
- [ ] Still reported, not changed: registration reveals whether an email is taken (a product call — `tests/auth-error-leak.test.ts` enshrines it).

## Phase 621: BYO-LLM deep-dive (credential lifetime, SSRF, budget, cache, persistence)

Three parallel reviews of the BYO-LLM path (client key handling, server provider handling, secret/data flow). Two agents independently found the top item.

- [x] **The API key survived sign-out and was handed to the next account (Medium/High).** `clearAccountData` deliberately keeps `app_settings` for device preferences — but that object carries `llmApiKey`, so on a shared device the next user could reveal it in Settings *and* every request they made auto-sent it (`x-llm-key`), billing the previous user's provider. Sign-out now strips the device-local secret and resets the device-scoped LLM config (`llmProvider → "forge"`, model/url dropped) while keeping theme/currency/etc. Guarded in `tests/clear-account-data.test.ts` (non-vacuous).
- [x] **Loopback SSRF via `ollama-local` (Medium).** The host check allowed any loopback *port*, and `fetch` followed redirects, so a caller (no account needed — `llm.test`/`insights.get` are public) could aim the server's POST at an arbitrary local service or have a `3xx` escape to an internal host. The port is now pinned to Ollama's 11434 and redirects are refused (`redirect: "error"`). Guarded (non-default port rejected; `redirect: "error"` asserted).
- [x] **Spend-budget bypass for `ollama-local` (Medium).** Any BYO config skipped the process-wide cap as "user-funded", but `ollama-local` drives the *host's* Ollama — no global ceiling. New `isServerFundedLlm` (forge/ollama-local) used at every budget site; a `llm.test` budget was added. Guarded (an `ollama-local` discovery consumes the budget; non-vacuous).
- [x] **BYO provider output was published to the shared insight cache (Low/Medium).** The cache is keyed by `productId` alone, so one user's (possibly untrusted) provider text was served to every other user for the TTL, and a concurrent non-BYO request could be served by a BYO provider. Only the operator's own output is cached now; BYO results are returned to the caller only. Guarded (a BYO insight is not served to a non-BYO caller; non-vacuous).
- [x] **The server stored a client-supplied `llmApiKey`.** The "never persisted server-side" contract lived only in the client; `sync.push` now strips the field before upsert. DB-gated test (non-vacuous).
- [x] **Provider value is clamped client-side** to the server's accepted set (it comes from persisted/imported settings, not guaranteed to be the union) — both tRPC clients.
- [x] **Response hardening:** the outbound provider deadline now covers the body read and the response size is capped (a slow/unbounded body could outlive the timeout and buffer in memory).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2508 passed` (27 skipped without a DB) / **`2535 passed`** with the DB; desktop `280 passed`.
- [x] **Verified-clean by the reviews (no change):** key never in backups (mobile/web/Rust), never in sync pushes, never in a URL/log/error/analytics; no provider host is attacker-chosen for keyed providers; CORS gates exposure; insights render as text (no XSS); `product-parse`'s URL path already had the full SSRF guard the BYO path now matches.

## Phase 622: Data-ingestion paths (bulk import, discovery, URL parse)

Three parallel reviews of the paths that pull product data in (backup/bulk import, listing discovery, URL→product parsing).

- [x] **Backup import erased fresher prices (High data loss).** `applyBackup` replaced each watchlist product wholesale, so importing a days-old backup reverted every price/status/history the device had recorded since — then stamped it dirty and pushed the regression everywhere. The watchlist is now merged per listing by `lastChecked` (union of device-only listings), like the sync engine; alerts/reminders keep their intended wholesale merge. Two tests (non-vacuous).
- [x] **Empty-listing discovery was starved (High).** `rediscoverMissingListings` always took the first N missing products and the watchlist is newest-first, so two obscure seeds were re-scraped across 25 distributors on every launch while the rest of the backlog (and every bulk-imported product) was never reached. A per-product 6-hour attempt cooldown rotates the queue. Test (non-vacuous).
- [x] **Mobile never showed AI-discovered products (Medium-High).** `refreshDiscovered` filtered `getAllCatalog()` (static-only) by its own ids, so the result was always empty; the discovered store was written but never read. Mobile now merges `getDiscoveredProducts()`. Guarded.
- [x] **AI discovery added a product with no listings (Medium).** Unlike the catalog-add path it never ran discovery, so the product opened with zero distributor rows and no price; it now discovers first and reports the hit count. Guarded.
- [x] **`manualAddProduct` ignored the dedup boolean (Low).** A stale `trackedIds` meant discovery ran and replaced the existing product's listings/history with a fresh single-point array; it now returns `duplicate` when storage reports the add was a no-op. (Test mocks updated to the real boolean contract.)
- [x] **URL parse buffered unbounded bodies (Medium DoS).** The size check ran after `res.text()`, so one huge or endless response could exhaust the process inside the abort window; the body is now streamed through a capped reader. **NAT64/6to4/Teredo literals** (`[64:ff9b::a9fe:a9fe]` → 169.254.169.254) are decoded and re-checked (the earlier NAT64 decode used the wrong 32 bits, caught by the new test). The free scrape branch also consumes a process-wide `products.parseUrl` budget.
- [x] **Bulk-import summaries overcounted.** `addToWatchlist` *resolves* `false` for a duplicate, so counting fulfilled promises reported more imports than landed; the mobile modal and both desktop paths now count only `value === true` and report failures. Guarded.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2517 passed` (27 skipped without a DB) / **`2544 passed`** with the DB; desktop `280 passed`.
- [ ] **Reported, not changed** (need a design/deeper change): the URL fetch still re-resolves DNS between the private-range gate and the connection (a rebinding window; the fix is an undici dispatcher with a pinned `lookup`); `parseBulkImportCsv` silently truncates at 500 rows; backup import writes from a pre-confirmation snapshot and is non-atomic across collections; `parseBackup` doesn't validate per-item ids; the paste-import path has no row cap / O(N²) whole-list writes; `resolvePrice` prefers a stale server snapshot over a device scrape.

## Phase 623: Ingestion follow-ups (the five reported items)

- [x] **CSV import silently dropped rows past 500.** `parseBulkImportCsv` now returns `{ rows, truncated }`; both import UIs surface "only the first N rows were imported" instead of implying a complete import. Test (non-vacuous).
- [x] **Backup import wrote from a pre-confirmation snapshot and was non-atomic.** The snapshot was read before the confirm dialog, so a price check or sync pull during the dialog was reverted; and the four saves + meta stamps ran in sequence, so a mid-way failure left imported data that never synced. Both the mobile data section and desktop Settings now re-read and merge at save time and stamp each collection's sync meta immediately after its save. Guarded (source assertion; non-vacuous).
- [x] **`parseBackup` accepted id-less items.** A malformed row collided on one `undefined` map key, wrote a bogus `"undefined"` sync-meta entry, and retried forever as a server validation rejection. Items without a non-empty string id are dropped. Test (non-vacuous).
- [x] **Paste import was uncapped and O(N²).** `parseModelInput` now caps at `BULK_MAX_ROWS` (new `parseModelInputDetailed` reports truncation, surfaced in the modal), and the modal writes in 50-row chunks with yields like the CSV path.
- [x] **`resolvePrice` preferred a stale server snapshot over a device scrape.** A stale snapshot was returned as-is, so discovery rejected it and the distributor was silently missed even though a scrape would succeed (the server only *triggers* a background refresh). It now falls through to the device scrape when the snapshot is stale, keeping the server's history, and only falls back to the stale snapshot if the scrape fails. Test (non-vacuous).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2521 passed` (27 skipped without a DB) / **`2548 passed`** with the DB; desktop `280 passed`.
- [ ] Still open (needs a deliberate change): the URL fetch re-resolves DNS between the private-range gate and the connection (rebinding window; fix = an undici dispatcher with a pinned `lookup`).

## Phase 624: URL fetch pins the vetted address (DNS-rebinding window closed)

- [x] **The gap.** `products.parse` resolved the hostname to check for private ranges, then let `fetch` resolve it *again* to connect — a TOCTOU window where a rebinding name answers public for the check and `127.0.0.1`/`169.254.169.254` for the connection (blind SSRF; the parsed `<title>`/`og:*` came back in the response).
- [x] **Fix.** The gate now returns the vetted address list (`resolvePublicAddresses`) and the connection is pinned to it: `fetchPinned` builds an `undici` `Agent` whose `lookup` ignores the hostname and answers only with those addresses (both the single-address and `all` forms undici uses), so the connection cannot re-resolve. Literal-IP URLs (already validated by `isBlockedUrl`) connect normally. Verified empirically that Node's global `fetch` honours an undici `Agent` dispatcher before relying on it.
- [x] **Dependency:** added `undici@7.29.0` explicitly (it was only transitive; the fix depends on its `Agent` API). Install verified clean — lockfile +3 lines, full suite green.
- [x] Tests: `pinnedLookup` answers with the vetted addresses regardless of hostname (both callback forms), and `fetchPinned` reaches a local server through a hostname that does not resolve at all — proving the pin, not DNS, made the connection. Non-vacuous (disabling the pin fails it).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2523 passed` (27 skipped without a DB) / **`2550 passed`** with the DB; desktop `280 passed`; `cargo test` 67.

## Phase 625: Storage-layer audit (context/adapters, collections, meta/aggregate)

Three parallel reviews of `lib/storage/*` — the local source of truth.

- [x] **IDB read failures were reported as "missing key" (High data loss).** `getItem`'s bare `catch` swallowed *real* read failures (aborted transaction, closing connection) and returned localStorage — normally null, since it is cleared once IDB commits. `readList`'s anti-empty guard therefore never fired, so the next read-modify-write persisted an **empty** collection (destroying it and syncing the wipe). It now rethrows non-`IdbUnavailableError` failures, mirroring `setItem`/`removeItem`. Test with a fake IDB whose read errors (non-vacuous).
- [x] **`indexedDB` present but unable to open → every write rejected.** Only a missing global produced `IdbUnavailableError`; a failed `open` (private mode, blocked storage, policy) rethrew, so writes failed and reads silently resolved null — the app appeared to lose all data each launch. A failed open is now marked unavailable so the localStorage fallback engages. Test (non-vacuous).
- [x] **Background-task interval marker race.** `saveBackgroundTaskInterval` was the only read-modify-write store not serialized through `enqueue`, and the two launch registrations run unawaited — both read `{}` and the second dropped the first task's marker, making that task re-register on every launch (resetting the OS scheduling window on iOS). Now enqueued. Test (non-vacuous).
- [x] **A stale pulled event was still recorded to history.** `recordNotificationEvent` ran outside the stale guard, so a locally-fired price drop/restock (different id) plus the server's copy produced two unread entries and a doubled badge. Now only recorded when not stale. Test (non-vacuous).
- [x] **Health events arriving during the upload were discarded.** `clearPendingHealthEvents` wiped the whole key after the network round-trip; it now keeps events that arrived after the snapshot. Test (non-vacuous).
- [x] **`deleteTag` didn't stamp `tagsUpdatedAt`**, so the tag-LWW merge re-added the deleted tag on another device (every other tag mutation stamps). Test (non-vacuous, backdated stamp).
- [x] **`getSettings` returned the shared `DEFAULT_SETTINGS` object** — a caller mutating what it read corrupted the module constant process-wide. Now a copy. Test (non-vacuous).
- [x] **Quarantine blobs survived every wipe.** The cap was module-memory only (invisible after reload) and neither wipe removed `*.corrupt-*` keys, so raw user payloads (up to 100 KB × 3 per key) outlived sign-out on a shared device. A persisted index is written and both wipes remove the blobs. Test (non-vacuous).
- [x] **A throwing change listener broke the others and rejected the write** (notify runs inside the queued fn). Each listener/handler is now isolated. Test (non-vacuous).
- [x] **A write enqueued during a wipe could land after it.** Both clear paths now set a `clearing` flag (writes enqueued while clearing are dropped — their data is being wiped anyway) around the drain + remove. 
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2531 passed` (27 skipped without a DB) / **`2558 passed`** with the DB; desktop `280 passed`.
- [ ] Reported, not changed: the discovery store dedups on the server's time-based `discovered-<ms>` id, so re-discovering the same product appends a duplicate (and the 200 cap can evict distinct entries) — a stable identity (brand+model) would fix it; `saveDiscoveredProducts` bypasses the cap but has no production caller.

## Phase 626: Desktop command surface + discovery dedup

- [x] **The renderer consumed alerts whose notification failed (Medium).** Rust emitted `price-drops-triggered` with *every* triggered event while only the delivered ones were written to the alert file — and the renderer deactivates every event it receives, so an alert whose toast failed was consumed in localStorage (and pushed to the server) even though the user saw nothing, undoing the file-store fix. It now emits only the delivered subset (new `delivered_events` helper). Test (non-vacuous).
- [x] **`deactivate_after_notify` could pair the wrong alert.** `notifications` was pushed for every hit but `triggered` only for non-empty ids, so `results[i]` was read for a different alert and a failed toast could consume a different alert than the one that succeeded. Both are now pushed in lockstep.
- [x] **`merge_listings` compared `lastChecked` as strings** (two spellings of the same instant compare unequal, so the stale disk price won) and treated a missing `distributorId` as `""` (two id-less listings collided and one was dropped). It now compares parsed epoch-millis and keeps id-less listings. Two tests (non-vacuous).
- [x] **Discovery store deduped on the server's time-based id.** `discovered-<ms>` differs on every discovery of the same product, so a repeat appended a duplicate and, at the 200 cap, evicted genuinely distinct entries. It now dedups on `brand|modelNumber` and refreshes in place, keeping the original id so existing links work. Test (non-vacuous).
- [x] **Refuted:** the tray badge already excludes `reminderType === "back_in_stock"` from the reminders count (the reviewer misread); `set_value_for_key`/`read_value_for_key` are key-allowlisted (no traversal); the Rust HTTP calls all have timeouts and fixed hosts.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2532 passed` (27 skipped without a DB) / **`2559 passed`** with the DB; desktop `280 passed`; `cargo test` 70, `cargo clippy` unchanged (4).

## Phase 627: Stats/analysis UI audit (clean)

- [x] Reviewed `app/stats.tsx`, `app/distributor-analysis.tsx`, `app/health.tsx`, `app/health/[id].tsx` and every `components/stats/*` card (basket, freshness, stock-health, movers, digest, insights, drop-calendar) for the component-level classes: wrong data slice, divide-by-zero/over-100 ratios, prop-array mutation, memo dep errors, single-point/all-equal chart scales, count-vs-list disagreement, timezone buckets, misleading zero states, index keys.
- [x] **Result: clean — no changes needed.** The screens delegate to the already-audited helpers and the memos carry correct deps. The two divide-by-zero candidates are guarded: `HealthSparkline` returns early for `data.length < 2`, and `workingPct` divides by `groupSamplesByDay`'s samples, which only ever contains groups built from existing samples. The two `key={i}` uses are a static weekday header and positional timeline bars (order is the identity), so neither is a reorder bug. No prop-array mutation found.
- [x] No code change; tree unchanged from Phase 626 (`tsc 0`, lint 0 errors / 157 warnings, `2532 passed`; desktop `280`; `cargo test` 70).

## Phase 628: Guard-quality (mutation) pass — third batch

Same method as Phases 610/611: a semantic mutation per module, then its tests.

- [x] **Caught (guards discriminate):** `computeDealScore`'s range formula and trend band; `sync-db`'s stale-write detection (only when run with the DB — the guard is DB-gated, so the no-DB run is green by design); `region-filter`'s region match; `rate-limit`'s limit rejection; `alert-scope`'s scope filter.
- [x] **Real gap found and closed:** `productStatus`'s precedence (in_stock before back_order) was untested — every existing case had only one of the two statuses, so swapping the order went unnoticed and would show a purchasable product as merely back-ordered. Added the both-present case; it fails under the swap.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2533 passed` (27 skipped without a DB) / **`2560 passed`** with the DB.
- [x] Cumulative mutation sample: 25 areas, 2 real gaps (the `mergePriceHistory` same-day LWW in Phase 610, `productStatus` precedence here). Note again: a green no-DB run is not evidence for a DB-gated guard — the `sync-db` mutation only failed once `RUN_DB_TESTS` was set.

## Phase 629: Guard-quality (mutation) pass — fourth batch

- [x] **Caught (guards discriminate):** `findNearestIndex`/`indexForLocationX` rounding; `notificationRouteFor`'s productId precedence; `dropStreak`'s direction; `computeWatchlistSummary`'s stock buckets.
- [x] **Real gap found and closed:** `analyzeDistributors`'s "cheapest in-stock listing" reduce was untested — every existing case had a single listing per (product, distributor), so the reduce never had to choose and inverting the comparison (totalling the most expensive listing) went unnoticed. Added a two-listing case; it fails under the inversion.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2534 passed` (27 skipped without a DB) / **`2561 passed`** with the DB.
- [x] Cumulative mutation sample: 30 areas, 3 real gaps (`mergePriceHistory` LWW, `productStatus` precedence, `analyzeDistributors` cheapest-selection). The recurring shape: a helper whose tests only ever exercise the single-item/one-branch case, so the comparison or precedence that matters is never forced.

## Phase 630: Guard-quality (mutation) pass — fifth batch (comparison/precedence helpers)

Targeted the heuristic from the last three gaps: helpers whose tests may only exercise the single-item/one-branch case.

- [x] **Caught (guards discriminate):** `getBestPrice`'s cheapest reduce; `sortWatchlist`'s "recent" direction; `computePriceChange`'s percent sign; `checkRestocks`'s transition gate; `findBestDeal`/`findBestInStockListing`'s in-stock + positive-price gates; `suggestAlertPrices`' out-of-stock history filter; `computeDropCalendar`'s in-stock filter.
- [x] **No new gaps:** every sampled comparison/precedence helper already had a case that forced the choice (the earlier phases' fixes are well covered).
- [x] No code change; tree unchanged from Phase 629 (`tsc 0`, lint 0 errors / 157 warnings, `2534 passed`).
- [x] Cumulative mutation sample: 37 areas, 3 real gaps.

## Phase 631: End-to-end smoke of the built server (found a production startup crash)

Ran the documented production path (`pnpm build` → `node dist/index.js`) and smoked the endpoints that previously had only unit tests of the extracted middleware.

- [x] **The production server crashed on startup (High).** `lib/scrapers/resilient.ts` imported the storage **barrel** (`../storage` → `index.ts`) for one constant and one type; the barrel imports `@react-native-async-storage/async-storage` and react-native-backed modules, so the esbuild server bundle contained `react-native` and Node died with `SyntaxError: Unexpected token 'typeof'` (Flow syntax) before listening. It now imports the leaf module `../storage/adapter`. The bundle went from containing react-native to **0** references.
- [x] **Smoke results on the built artifact (all as designed):** `/api/*` → `Cache-Control: no-store`; bare `/api` → 404 JSON (not the HTML shell); `/product/abc` → 200 HTML (SPA deep link); CORS preflight → the `X-LLM-*` headers allowed; `/api/trpc/sync.push` with a 300 KB body → 401 (body accepted, auth rejected — not 413); the look-alike `/api/trpc/sync.pushX` → 413; `/api/auth/login` → 413; `/.well-known/apple-app-site-association` → 404 when unconfigured; `/sw.js` → 200.
- [x] **New guard:** `tests/server-bundle-purity.test.ts` asserts the server-reachable lib modules import leaf storage modules (not the barrel) and that `resilient.ts` does not. Non-vacuous (reverting the import fails it). `breaker-clear.ts` also imports the barrel but is client-only, so it is deliberately out of scope.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2536 passed` (27 skipped without a DB); desktop `280 passed`.

## Phase 632: Web export smoke in a real browser (clean)

Ran the built web export through the production server and drove it in headless Chromium (Playwright is already a dependency).

- [x] **Boots clean:** the SPA loads, `#root` renders (4.6 KB of HTML), title is "Product Stock Finder", and there are **0 page errors and 0 console errors** (excluding the expected `ERR_CONNECTION_REFUSED`/`ERR_FAILED` from the dev `.env`'s `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`, which is a local dev value baked into this build — not a bug).
- [x] **Onboarding → Skip → Home** renders real seeded data (7 tracked, 6 in stock, recent activity) — the launch seeding and sample history work in the browser.
- [x] **Deep link** `/product/mikrotik-crs804-4ddq-hrm` boots the app and renders the full product detail (name, brand, category, region, stock status, description) — the SPA fallback + typed routes work.
- [x] **0 errors across navigations**; the tab-bar clicks in my harness didn't register (a selector limitation of the smoke script, not an app fault).
- [x] No code change; tree unchanged from Phase 631 (`tsc 0`, lint 0 errors / 157 warnings, `2536 passed`; desktop `280`).

## Phase 633: Server API smoke against a real database (clean)

Ran the built server against MySQL and drove the full API surface with curl — the integration layer the unit tests mock.

- [x] **Auth lifecycle:** register → cookie session → `/api/auth/me` → login → wrong password 401 → unauthenticated 401. All correct.
- [x] **Sync lifecycle:** `sync.pull` (empty) → `sync.push` (1 item accepted, stamped) → `sync.pull` returns the item and advances `lastSyncedAt`. Correct.
- [x] **Credential epoch (Phase 596) end-to-end:** a token works, `change-password` succeeds, then the **old token is rejected (401)**, the old password fails, the new one works. Correct.
- [x] **Device revocation (Phase 592) end-to-end:** register a native push token → `devices.list` shows it → `devices.signOut` → the same session is rejected (403). Also verified the ownership guard: signing out a device with no binding returns `signedOut: false` and leaves the session valid.
- [x] **OAuth login-CSRF guard (Phase 619) end-to-end:** `/api/auth/oauth/start` sets the `psf_oauth_state` httpOnly cookie, and a callback without it redirects with `error=invalid_state`.
- [x] **Rate limiting:** rapid logins return 429.
- [x] **BYO-LLM SSRF port pin (Phase 621):** `products.parse` with `http://localhost:8080/admin` returns `product: null` (blocked, no fetch); a public URL returns null without crashing.
- [x] No code change; tree unchanged from Phase 632 (`tsc 0`, lint 0 errors / 157 warnings, `2536 passed`; desktop `280`).

## Phase 634: Desktop build smoke (found a boot crash in the built renderer)

Built the desktop renderer (`pnpm build` in `desktop/`) and drove the built output in headless Chromium — the desktop analogue of Phase 631.

- [x] **The built desktop app crashed on boot (High).** `vite.config.ts` set `define: { __DEV__: "import.meta.env.DEV" }`. `define` is a *verbatim text substitution*, so the emitted chunks contained `import.meta.env.DEV` in modules Vite does not transform, where `import.meta.env` is undefined — `#root` stayed empty and the page threw `TypeError: Cannot read properties of undefined (reading 'DEV')`. It now substitutes a literal (`JSON.stringify(mode !== "production")`), matching Metro's `__DEV__` semantics. After the fix the bundle has **0** `import.meta.env.DEV` occurrences and the app renders (23 KB of `#root` HTML, full nav, 0 page errors).
- [x] **Bundle verified clean:** no `playwright`, `express`, `drizzle-orm`, `mysql2`, or server-secret markers; `browser.web` is the stub chunk (playwright stays out of the desktop bundle, as designed).
- [x] **New guard:** `desktop/tests/vite-dev-define.test.ts` asserts the `__DEV__` define is a literal and not an `import.meta` expression. Non-vacuous (reverting fails it).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2536 passed` (27 skipped without a DB); desktop `tsc 0`, `281 passed`; `cargo test` 70.

## Phase 635: Tauri release-build smoke (clean, with a deployment note)

Built the desktop app in **release** mode (different codegen from the debug/test builds) and launched the binary under a virtual display.

- [x] **Release build compiles and runs clean.** `cargo build --release` succeeds; the binary launches under `xvfb-run` and stays up (killed by my timeout, exit 124) with **0 panics and 0 errors** — only GPU/EGL warnings from the headless display (no DRI3/hardware acceleration), which are environmental. It creates its WebKit data dirs. The `windows_subsystem = "windows"` release-only attribute (main.rs) is the only `debug_assertions`-gated code and is Windows-only.
- [x] **Deployment hazard recorded (not a code bug):** `frontendDist: "../dist"` is embedded at *compile* time, and `beforeBuildCommand: "pnpm build"` is what builds it. Running `cargo build --release` directly (bypassing the Tauri CLI) embeds whatever is in `desktop/dist` — nothing, if the frontend was not built first — producing a blank-window app with no error. The Tauri CLI is not installed in this environment, so the documented `tauri build` path could not be exercised here; the correct sequence is `pnpm build` (frontend) then `cargo build --release`, which I verified produces a working binary.
- [x] No code change; tree unchanged from Phase 634 (`tsc 0`, lint 0 errors / 157 warnings, `2536 passed`; desktop `281`; `cargo test` 70).

## Phase 636: Coverage-driven audit (untested security helpers)

Built a dependency-free coverage map (source modules vs. test imports/exports — the `@vitest/coverage-v8` provider is not installable offline) and audited the highest-value modules with no direct test.

- [x] **`lib/settings-privacy.ts` had no test** despite being the mechanism the BYO-LLM key's device-locality depends on (used by sync push, backup/export, and the sign-out wipe). Added 6 tests: `stripDeviceLocalSettings` removes only the key, keeps the rest, does not mutate its input, and is a no-op without a key; `applyLocalLlmKey` keeps the local key on an inbound merge, never adopts a remote one, and drops a remote key when the device removed its own. Non-vacuous (both a strip no-op and an adopt-remote mutation fail).
- [x] **`lib/sync-gate.ts` had no test** despite being what stops an in-flight sync from resurrecting the previous account's rows after a logout wipe. Added 2 tests (monotonic, stable between bumps). Non-vacuous.
- [x] **Audited and found correct (no test needed):** `lib/background-fetch.ts` (the native-timeout XHR — settled-guard on all four terminal paths, `send()` throw handled); `lib/background-tasks/tasks.ts` (the `checkInterval` → minutes mapping is exhaustive over the union, and the per-task interval marker is correct); `hooks/use-server-config.ts`; `lib/sync-gate.ts`'s consumers.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2544 passed` (27 skipped without a DB).
- [ ] Note: the coverage map is a heuristic (a module can be covered indirectly via a component test), so it ranks candidates rather than proving absence of coverage. `@vitest/coverage-v8` could not be installed offline; adding it would give exact line/branch numbers.

## Phase 637: Shared-watchlist flow audit (clean)

Audited the one user-facing, security-relevant surface not yet covered: a token from a URL drives a public server fetch, with membership/ownership rules.

- [x] **Server router (`sharedWatchlists`) is comprehensively hardened — no changes needed.** Verified: token is a `randomUUID` with duplicate-key retry; `create`/`revoke`/`update`/`members`/`invite`/`inviteByEmail`/`join`/`leave` all enforce expiry (not just `get`); every owner-only action checks `ownerId === ctx.user.id`; `get` is rate-limited per-IP **and** per-token (so a leaked token can't be scraped from rotating IPs); the members-only gate is enforced on `get` **and** `join`; the public payload is capped (`SHARED_WATCHLIST_MAX_ITEMS + 1`, tombstones filtered in SQL, `truncated` reported); `inviteByEmail` matches the normalised email exactly (no prefix search → no account enumeration) and rejects self-invite; invites are viewer-only (no implied `editor` powers); the FK error maps to NOT_FOUND.
- [x] **Client (`app/w/[token].tsx`) is thorough:** missing-token state, an actionable error fallback (not the server's verbatim "Share not found"), the truncation flag surfaced, dedup-aware bulk add (reports "already tracked" rather than claiming adds), and join/leave wired to the membership endpoints.
- [x] **Untrusted shared data is sanitised before it enters the local store:** `normalizeSharedWatchlistProduct` validates id/name, coerces stock status to the union, drops malformed listings/price points, and is already tested. A shared product whose id collides with a local one cannot overwrite it — `addToWatchlist` dedups by id and returns false.
- [x] No code change; tree unchanged from Phase 636 (`tsc 0`, lint 0 errors / 157 warnings, `2544 passed`).

## Phase 638: Desktop bundle split (recharts out of the initial chunk)

- [x] **Measured the cost first.** The desktop bundle was a single 1,661 KB chunk (473 KB gzip). Stubbing `recharts` showed it accounts for **397 KB (110 KB gzip)** — 24% of the bundle — for just two chart components, while the mobile app deliberately hand-rolls SVG charts to avoid exactly this dependency.
- [x] **Fix: lazy-load the two chart components** (`PriceHistoryChart`, `MultiLineChart`) at their three call sites, each wrapped in `<Suspense fallback={null}>`. recharts now builds to its own `LineChart-*.js` chunk fetched only when a chart actually renders.
- [x] **Result: the initial chunk dropped 1,661 KB → 1,260 KB (gzip 473 KB → 363 KB)** — a **110 KB gzip reduction on every route**, with no change to what the charts render.
- [x] **Verified in a real browser:** on Home the chart chunks are not requested (0); navigating to a product fetches `PriceHistoryChart-*.js` + `LineChart-*.js` on demand, the recharts SVG renders, and there are 0 page errors. (The desktop router is state-based, so a `/product/...` URL does not deep-link — a harness detail, not a bug.)
- [x] Fixed the two consequences of the change: the `lazy(...)` consts sat between imports (12 `import/first` lint warnings → back to 157/0), and the modal test asserted the chart synchronously (now awaits the chunk).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2544 passed`; desktop `tsc 0`, `281 passed`.
- [ ] Not done (larger, riskier): replacing recharts with the mobile app's hand-rolled SVG chart would remove the dependency entirely (~110 KB gzip) but means rewriting two chart components; the lazy split captures most of the win without that risk.

## Phase 639: Dependency security audit

- [x] **Upgraded four direct dependencies with known advisories** (`pnpm audit --prod`): `@trpc/server` 11.7.2 → 11.19.0 (prototype pollution, patched ≥11.8.0); `axios` ^1.13.2 → ^1.20.0 (NO_PROXY/SSRF bypasses + prototype-pollution gadgets, patched ≥1.15.2 — relevant because the server fetches user-supplied URLs); `drizzle-orm` ^0.44.7 → ^0.45.3 (SQL injection via unescaped identifiers, patched ≥0.45.2); `mysql2` ^3.16.0 → ^3.24.4 (patched ≥3.22.0). Audit count dropped **147 → 113**.
- [x] **Verified the upgrades are safe:** root `tsc 0`, `2544 passed` (27 skipped) / **`2571 passed` with the DB** (the mysql2/drizzle bumps exercise the real SQL paths), desktop `281 passed`, lint 0 errors (157 warnings).
- [x] **`undici` 7.29.0 (added in Phase 624) is already patched** — every undici advisory targets `<6.28.0`; the audit's remaining undici hits are transitive 6.x copies nested inside other packages.
- [x] **The 2 remaining criticals are dev-tooling only:** `shell-quote` and `tar` are pulled in by `@expo/cli` (Expo's build/dev CLI) via `react-devtools-core`/`expo-router` — never shipped to users and never run in production. Not upgradeable without an Expo SDK bump.
- [ ] Remaining advisories (113) are transitive build/dev dependencies (Expo/Metro/RN tooling); clearing them needs upstream releases, not local pins.

## Phase 640: Accessibility pass

Scanned every `app/` and `components/` interactive element, image, and text input (plus the desktop's `<button>`s) for missing accessible names.

- [x] **Icon-only buttons were already fully labelled** (0 gaps) — the earlier phases' a11y work holds.
- [x] **Fixed 4 real gaps:** three product `<Image>`s had no accessible name (Home list, product info card, trending card) — each now carries `accessibilityLabel={`${product.name} image`}`; and the tag-rename `TextInput` in `tag-manage-sheet.tsx` had neither a label nor a placeholder — now `accessibilityLabel="Tag name"`.
- [x] **Verified as false positives (no change needed):** `components/watchlist/product-card.tsx` (has a composed `accessibilityLabel`), `components/tag-picker-sheet.tsx` (the match was a `useRef<TextInput>` type, and the input has a placeholder), and the three desktop `<button>`s (each has both an `aria-label` and visible text).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2544 passed`; desktop `281 passed`.

## Phase 641: Trending/discovery internals audit

- [x] **Found and fixed: unbounded response bodies in `server/routers/trending.ts`.** The RSS feeds were read whole via `res.text()` and the OpenAI reply via `res.json()`, with no size cap — a hostile or looping feed could buffer the process out of memory inside the 8 s abort window (the same class fixed in `server/product-parse.ts`). Both now go through a capped streaming reader (`MAX_FEED_CHARS` 2 MB, `MAX_AI_CHARS` 200 KB), and an over-cap LLM reply returns `{count: 0}` without touching the table. Test (`tests/trending-response-cap.test.ts`, non-vacuous).
- [x] **Verified correct (no change):** `trending.refresh` is admin-only, rate-limited, budget-capped, has fetch + LLM timeouts, sanitizes every field to its column limit (price clamped to `decimal(10,2)`), guards the zero-row case, and replaces the table in a transaction; `trending.get` does `LIMIT`/`ORDER BY` in SQL. `discovery.discover` validates the LLM reply (length caps, URL scheme check, retailer slice, `maxTokens: 500`), maps a rejected BYO key to `PRECONDITION_FAILED`, and consumes the budget only for server-funded configs. The client `fetchTrending` falls back to the static list on any failure.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2546 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 642: Exact coverage numbers + client-device tests

- [x] **Installed `@vitest/coverage-v8`** (the registry was reachable) for exact line/branch numbers instead of the earlier import-based heuristic.
- [x] **Baseline measured:** server+lib is **79.5% statements / 80.7% branches** with the DB (77.0%/80.7% without — the delta is the DB-gated paths). The lowest app modules (excluding `_core` framework code) are `lib/devices.ts` (0%), `lib/trpc.ts` (0%), `server/storage.ts` (2%), `lib/background-fetch.ts` (7%), `lib/shared-watchlist.ts` (40%), `lib/push-token.ts` (44%).
- [x] **Wrote tests for `lib/devices.ts`** (0% → covered): the client device API's five calls, asserting each returns its value on success and the documented fallback (`null`/`false`/`0`) on failure — the fallbacks are what the UI relies on, so a regression to throwing or to `[]` would surface. Non-vacuous (a `null`→`[]` mutation fails it).
- [x] **Found a real break from Phase 641:** my trending response-cap change made `trending.refresh` read the body via `text()`, but `tests/server-db-branches.test.ts`'s OpenAI mock only provided `json()` — so a **DB-gated** test failed. The no-DB run was green, which is exactly the "a green no-DB run is not evidence for a DB-gated guard" lesson from Phase 628. Fixed the mock (and its return-type annotation).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2549 passed` (27 skipped without a DB) / **`2576 passed`** with the DB; desktop `281 passed`.
- [ ] Remaining low-coverage app modules worth a future pass: `lib/trpc.ts` (0%, header building), `server/storage.ts` (2%, S3 helpers), `lib/background-fetch.ts` (7%, the XHR path needs a DOM/XHR harness), `lib/shared-watchlist.ts` (40%), `lib/push-token.ts` (44%).

## Phase 643: tRPC header building tests (the 0%-covered transport layer)

- [x] **`lib/trpc.ts` was 0% covered** despite every API call going through it. Added 8 tests for the two header builders:
  - `byoLlmHeaders`: sends nothing for the built-in Forge provider; sends nothing for an **unrecognized** provider value (it comes from persisted/imported settings, so it is not guaranteed to be one of the union); forwards provider/key/model; forwards the `ollama-local` URL; returns nothing when settings are unreadable.
  - `trpcHeaders`: carries the session token + device id; omits the token when signed out and **survives a device-id failure** (a rejection there would break header construction for every request); merges the BYO-LLM headers.
- [x] **Non-vacuous:** removing the provider clamp and removing the `getDeviceId().catch()` each fail their test.
- [x] **Audited the rest of the module and found it correct:** `getSessionToken` already catches internally (so the un-guarded call is safe), the background path swaps in the native-timeout XHR fetch, the foreground path has an `AbortController` deadline, and the `revokedDeviceLink` clears the session on the device-revoked error.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2557 passed` (27 skipped without a DB); desktop `281 passed`.
- [ ] Remaining low-coverage app modules: `server/storage.ts` (2%, S3 helpers), `lib/background-fetch.ts` (7%, needs an XHR harness), `lib/shared-watchlist.ts` (40%), `lib/push-token.ts` (44%).

## Phase 644: Shared-watchlist normalization tests (untrusted-input branches)

- [x] **`lib/shared-watchlist.ts` was 40% statements / 17.6% branches** — only the reject path was tested, while the module's whole job is sanitising untrusted data from a public share link before it enters the local store. Added 6 tests for the branches that matter: an unknown stock status coerces to `unknown`; listings without a `distributorId` or with a non-finite price are dropped; malformed price points are dropped and a point without a currency defaults to USD; `modelNumber` defaults to the id and non-string brand/description coerce to `""`; only string tags survive; the product is always `isWatched` with a listings array.
- [x] **Non-vacuous:** dropping the finite-price check and dropping the stock-status coercion each fail their test.
- [x] **One cosmetic inconsistency noted, not changed:** `tags: []` yields `[]` rather than `undefined` (the code checks `Array.isArray`). Harmless — the tag rendering ignores an empty array and `addToWatchlist` treats it as absent — so the test documents the actual behaviour instead.
- [x] **Audited `lib/push-token.ts` (44%) and found it correct:** every path is best-effort with the right guards (web early-return, `Device.isDevice`, missing project id, timeouts), and `unregisterPushToken` handles the web subscription + server prune separately.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2563 passed` (27 skipped without a DB); desktop `281 passed`.
- [ ] Remaining low-coverage app modules: `server/storage.ts` (2%, S3 helpers), `lib/background-fetch.ts` (7%, needs an XHR harness).

## Phase 645: background-fetch tests; coverage sweep closed

- [x] **`lib/background-fetch.ts` was 7% covered** despite being the fetch path for every tRPC call made while the app is backgrounded (where JS timers freeze, so the native XHR timeout is the only deadline). Added 6 tests with an `XMLHttpRequest` double covering all five terminal paths: load (body + status), a platform-rejected header being skipped, the typed `BackgroundFetchTimeoutError`, network error, abort, and a synchronous `send()` throw.
- [x] **Non-vacuous where it can be:** changing the timeout error type fails its test. The `settled` guard is **not externally observable** (rejecting an already-resolved promise is a no-op in JS), so that test was rewritten to pin the outcome rather than pretend to prove the guard — noted in the test.
- [x] **`server/storage.ts` (2%) deliberately left untested:** it is Forge/S3 infrastructure used only by `_core/imageGeneration.ts`, and the coverage config excludes `_core` for exactly this reason. Its two helpers are private and its protocol needs a Forge presign mock — low value.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2569 passed` (27 skipped without a DB); desktop `281 passed`.
- [x] **Coverage sweep closed:** every app module flagged below 75% has now either been tested (devices, trpc headers, shared-watchlist, background-fetch) or audited and found correct (push-token) or out of scope (server/storage).

## Phase 646: Dead-code audit

- [x] **Dependencies: clean.** `dependency-analyzer` reports 0 unused, 0 outdated, 0 vulnerable across the 83 declared packages.
- [x] **Dead framework files found (reported, not deleted):** `server/_core/heartbeat.ts` (215 lines) and `server/_core/dataApi.ts` (69 lines) are referenced nowhere — no static import, dynamic import, `require`, or config reference — so they are tree-shaken out of the built bundle. They are `_core/` (hands-off per AGENTS.md), so this is a note for the framework owner rather than a change.
- [x] **Six unused exports in app code, left in place:** `getExchangeRate` (×2), `ONE_YEAR_MS`, `AXIOS_TIMEOUT_MS`, `getAllDistributors`, `CURRENCIES`. Each is a few lines of public-API surface (`shared/` is cross-platform API; `getAllDistributors` mirrors the used `getAllRegions`), so removing them is churn with no behavioural benefit — and a future feature would just re-add them.
- [x] **False positives verified:** the 12 modules my reference scan flagged are all live — Expo Router file routes (`app/_layout.tsx`, `(tabs)/_layout.tsx`, `app/dev/theme-lab.tsx`), platform-suffixed files (`icon-symbol.ios.tsx`, `use-color-scheme.web.ts`), vite-aliased desktop stubs (`*-stub.ts`), and `best-distributor-card.tsx` (imported as `BestDistributorCard`).
- [x] No code change; tree unchanged from Phase 645 (`tsc 0`, lint 0 errors / 157 warnings, `2569 passed`; desktop `281`).

## Phase 647: notifications.ts audit — web health alerts consumed on a failed display

- [x] **Found and fixed a real bug in `lib/notifications.ts`.** On the web path, `scheduleHealthAlert` and `scheduleHealthRecovery` called `displayWebNotification(title, body)` and **discarded its boolean**, then unconditionally recorded the event as delivered and returned its id. So when the notification could not be shown (permission revoked since the gate, or the Notification API unavailable), the alert was consumed: the local history recorded a delivery the user never saw, and the server dedups on that id so it was never re-sent. Both now bail out (returning `null`) when nothing was shown — the same class fixed in the price-check path in Phase 598, and the two sibling call sites in this same file (`sendTestNotification`, `scheduleServerEventNotification`) already used the result.
- [x] **Tests:** three new cases in `tests/health-notifications.test.ts` — a failed web display records nothing and returns null (alert + recovery), and a shown one records normally. The two pre-existing web success tests needed the mock to report a shown notification (they previously passed because the discarded result was never checked). Non-vacuous (removing the guard fails the new test).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2572 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 648: notifications.ts + digest callers audit (clean)

Continued the audit of the module that hid the Phase 647 bug, plus every caller of its boolean-returning functions.

- [x] **Audited the remaining scheduling functions and found them correct:** `schedulePriceAlert`, `scheduleStockAlert`, `scheduleStockWatchConfirmation`, `scheduleBackOrderReminder`, `cancelNotification`, `cancelAllNotifications`, `sendTestNotification` (web path uses `ensureNotificationPermission` + the display result), `scheduleServerEventNotification` (returns the display result on both platforms), and `setupPushEventTracking` (records received/tapped event ids, best-effort with a documented gap for an untapped background push).
- [x] **Verified every caller of a boolean-returning notification function uses the result:** `lib/server-notifications.ts` (`const shown = …`), `lib/price-digest.ts` (`return sendPriceDigestNotification(...)`), `app/(tabs)/settings.tsx` (`const sent = …` → "Permission Required" alert). No remaining discarded-result sites — the pattern that caused the Phase 647 bug is gone from this module.
- [x] **Verified the digest's subtle logic is tested:** the weekly interval compares *calendar days* rather than elapsed 24 h (a DST week is 167/169 h), and `tests/price-digest.test.ts` has an explicit "fires weekly across a DST transition (167h week)" case. The snapshot only advances when `send` reports delivery.
- [x] No code change; tree unchanged from Phase 647 (`tsc 0`, lint 0 errors / 157 warnings, `2572 passed`; desktop `281`).

## Phase 649: AGENTS.md claim verification (documentation drift)

Verified the concrete, checkable claims in AGENTS.md against the code — doc drift causes systematic errors for future work.

- [x] **Accurate:** 25 registered parsers (`registry.ts`) and 20 Drizzle tables (`schema.ts`); 7 `SEED_IDS`; `web.output: "single"`; the three `_core/` directories exist; `MAX_UPLOAD_*`/`SYNC_PUSH_*` caps live in `shared/const.ts`; `browser.web.ts` and `browser.ts` export the same 3 symbols; `playwright` is imported only by `browser.ts`; `dist/` and `dist-web/` are separate build outputs.
- [x] **Clarified (not drift):** the distributor catalog has **30** entries but only **25** have parsers (`allasch-uk`, `apple-us`, `newegg-us`, `pimoroni-uk`, `valve-us` are catalog-only). AGENTS.md's "25 registered parsers" is correct, and the health service iterates `PARSERS` (25), so the dashboard is consistent. Every parser-less distributor degrades gracefully — `scrapePriceOnDevice` and `refreshListing` both `return null`/the listing unchanged when `getParserByDistributorId` misses.
- [x] **Clarified (not a violation):** AGENTS.md says `lib/price-source.ts` is the sole *foreground* price entry point. `lib/background-tasks/refresh-listing.ts` does call `fetchServerPrice` directly, but it is the background path with a different contract (prefers the server snapshot, records health, uploads history) — the documented rule is scoped to foreground, so this is correct.
- [x] **Stale but harmless:** AGENTS.md says "~277 test files"; there are now 361. A soft "~" claim, not a correctness issue.
- [x] No code change; tree unchanged from Phase 648 (`tsc 0`, lint 0 errors / 157 warnings, `2572 passed`; desktop `281`).

## Phase 650: Upgrade/migration robustness (older stored payloads)

New axis: what happens when the store holds data written by an older build — a class that only manifests on app update and that no existing test covered.

- [x] **No storage schema versioning exists** (no `SCHEMA_VERSION` key); the protection is defensive reads plus the quarantine path. Verified the codebase consistently defaults newer fields (`?? {}`, `?? ""`, truthiness guards) rather than assuming they exist — including `tagDefinitions`, `snoozedUntil`, `reminderType`, `lastKnownStatus`, `tagsUpdatedAt`.
- [x] **Added `tests/storage-old-payloads.test.ts`** (5 cases) simulating an upgrade: a pre-`tags` product with a listing that has no `priceHistory`; a pre-snooze alert; pre-`tagDefinitions`/`llmProvider` settings (with the old display currency still applying); a pre-`reminderType` reminder; and a payload of the **wrong JSON type** (an object where an array is expected) — which must be quarantined, not silently replaced.
- [x] **Non-vacuous:** removing the quarantine call fails the wrong-type test (the original payload would be lost on the next write).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2577 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 651: Re-entrancy guard on the price check

- [x] **Found: `runPriceCheckCore` had no in-flight guard.** It can be invoked from three places that fire close together — the launch effect (`checkPriceDropsNow`), the background task, and a foreground refresh — so overlapping runs scraped every listing twice (wasted requests and needless rate-limit/breaker pressure). The notification path was already idempotent (`deactivateAlert` returns false for an already-triggered alert and the caller checks it before notifying), so this was wasted work rather than duplicate alerts.
- [x] **Fix:** the exported `runPriceCheckCore` now returns the in-flight run when one exists (`runPriceCheckCoreInner` holds the body), clearing it in a `finally`. A second caller joins instead of starting another run.
- [x] **Test:** a gated `getWatchlist` holds the first run inside its initial read so the second call is guaranteed to arrive mid-flight; the read count proves only one run proceeded. Non-vacuous (removing the guard raises the count and fails it).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2578 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 652: Re-entrancy guard on the health probe

- [x] **Found: `testAllDistributors` had no in-flight guard.** It is called by the background probe task **and** the manual "Test All" button (`app/health.tsx`), so a manual test during a background pass fired all 25 parser requests twice — doubling load on the distributors and the breaker store.
- [x] **Fix:** the exported `testAllDistributors` returns the in-flight run when one exists (`testAllDistributorsInner` holds the body), cleared in a `finally`. The second caller's `onProgress` is dropped, which is correct — the running pass reports its own progress.
- [x] **Test:** two overlapping calls issue exactly `PARSERS.length` `fetchAndParse` calls, not twice that. Non-vacuous (removing the guard doubles the count).
- [x] **Swept the other async entry points and found them already safe:** `syncNow` has a per-storage `WeakMap` in-flight guard; `syncServerNotifications` has `syncInFlight`; `runPriceCheckCore` was fixed in Phase 651. `backfillLocalHistory` and `rediscoverMissingListings` are launch-only (the launch effect has `[]` deps and the app has no `StrictMode`), so concurrency is not reachable there.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2579 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 653: Silent-catch (swallowed error) sweep (clean)

Enumerated all 55 comment-only/empty `catch` blocks in app code (`lib/`, `server/`, `app/`, `components/`, `hooks/`, excluding `_core`) and judged each: does the swallow make a caller believe work succeeded?

- [x] **Result: no new bugs.** Every silent catch is either documented as intentional (with a comment explaining why the failure is non-fatal) or correctly scoped so the caller cannot mistake a failure for success. Highlights verified:
  - `lib/restock.ts` gates on `notified` and **keeps the watch** when the notification fails (permission revoked, web display false, or a throw) — the alert is retried next cycle rather than consumed silently.
  - `server/db.ts`'s token-consume catches fall through to the in-memory store **only when the DB transaction returned no row** — a row that exists but is used/expired stays rejected, so a dual-stored token cannot be consumed twice (the Phase-594 fix, with the hazard documented in place).
  - `lib/background-tasks/tasks.ts` swallows registration failures deliberately (background tasks are unavailable on simulator/web) and the interval marker is written only after a successful register.
  - `lib/storage/context.ts` / `lib/scrapers/health.ts` / `lib/scrapers/browser.ts` swallow best-effort persistence (quarantine index, health samples, cookie jar) where the primary operation already succeeded.
- [x] No code change; tree unchanged from Phase 652 (`tsc 0`, lint 0 errors / 157 warnings, `2579 passed`; desktop `281`).

## Phase 654: formatPrice edge cases (negative sign, absurd magnitude)

- [x] **Found two real formatting bugs in `shared/src/currency.ts`'s `formatPrice`** (the single formatter used by the mobile app, the desktop, CSV export, and the digest):
  - A negative amount rendered as **`$-5.00`** — the minus landed after the symbol, reading as a malformed price. New prices are rejected by the plausibility guards, but a legacy/corrupt stored value reaches the formatter.
  - A huge magnitude rendered as a **21-digit wall of text** (`$1,000,000,000,000,000,000,000.00`) because `toLocaleString` never uses exponential notation.
- [x] **Fix:** the sign is emitted before the symbol, and a magnitude ≥ 1e15 uses `toExponential(2)` (`$1.00e+21`). Verified `0`, `0.005`, `1234567.891`, and `NaN`/`Infinity` (→ `N/A`) are unchanged.
- [x] **Tests:** three new cases (minus before the symbol, exponential for an absurd magnitude, `N/A` for non-finite). Non-vacuous (removing the sign handling fails two).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2582 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 655: Divide-by-zero sweep in percentage math (no changes needed)

Audited every `... / x * 100` percentage computation in app code for an unguarded zero divisor.

- [x] **All already guarded — two candidate sites were false alarms, verified empirically:**
  - `lib/alert-scope.ts`'s `alertDeltaPct` already returns null for `alert.targetPrice <= 0` at the top of the function (my added guard was redundant dead code, and the test passed via the existing guard — reverted).
  - `lib/drop-calendar.ts` cannot divide by a zero prior price: a rise from 0 is filtered by `curr.v >= prev.v` (a "drop" requires `curr < prev`), so the zero-prior branch is unreachable. I confirmed this by running the computation with the guard removed — `totalDrops` was still 0. Reverted the guard and the non-discriminating test.
  - `lib/price-change.ts` guards `oldest <= 0`; `lib/deal-score.ts`, `lib/fx-history.ts` (×2), and `lib/price-digest.ts` each guard their divisor; `lib/price-average.ts` divides by an average that is only computed from a non-empty series.
- [x] **Method note:** both candidates looked like real bugs from the grep, but writing the test first showed the guard was either already present or unreachable. Reverted rather than shipping dead code plus a test that passes for the wrong reason.
- [x] No net code change; tree unchanged from Phase 654 (`tsc 0`, lint 0 errors / 157 warnings, `2582 passed`; desktop `281`).

## Phase 656: Timer/listener leak audit (clean)

- [x] **Scanned every `useEffect` in `app/`, `components/`, and `hooks/`** for a block that registers a listener/timer/observer without a cleanup: **0 findings**. Every registration has a matching `return () => …` / `removeEventListener` / `clearInterval` / `clearTimeout` / `unsubscribe`.
- [x] **Module-level timers are all bounded or cleared:** `lib/health.ts` and `lib/llm-discovery.ts` abort timers clear in `catch` *and* `finally`; `lib/background-safe-timers.ts` and `lib/server-prices.ts` clear their timers; `lib/device-revoked.ts`'s bare `setTimeout(…, 0)` is a deliberate one-shot coalescing reset, not a leak.
- [x] **Module-level listeners are idempotent with matching teardown:** `lib/web-notifications.ts`'s `startPushDedupListener`/`stopPushDedupListener` and `startPolling`/`stopPolling` guard against double-registration and remove on stop; `lib/notifications.ts`'s `setupPushEventTracking` returns a disposer that removes both subscriptions; `app/_layout.tsx` and `desktop/src/App.tsx` call each setup inside an effect and return its disposer.
- [x] No code change; tree unchanged from Phase 655 (`tsc 0`, lint 0 errors / 157 warnings, `2582 passed`; desktop `281`).

## Phase 657: Boundary/off-by-one audit (clean)

- [x] **Sync pagination is correct.** The server's composite cursor (stamp + collection + id) re-includes rows *at* the cursor so a page boundary cannot skip an item, and `hasMore` comes from `sorted.length > SYNC_PULL_MAX_ITEMS` with the page sliced to exactly the max. The client's drain loop caps at 50 pages and — critically — when the drain is incomplete it keeps the **old** cursor instead of advancing to `lastSyncedAt`, so the remaining pages are re-pulled rather than permanently skipped.
- [x] **Date windows are consistent.** Every cutoff is day-granular and inclusive on the keep side (`p.date.slice(0,10) >= cutoffDay`, `dayOf(p.date) >= cutoffDay`), so the boundary day is retained; the retention purges use a strict `< cutoff` for deletion, keeping items exactly at the boundary.
- [x] **Caps keep exactly the maximum, newest-first.** `trimHistory` uses `> MAX_HISTORY_PER_LISTING` with `slice(-MAX)`; the shared-watchlist payload fetches `MAX + 1` so a share with exactly MAX items is not misreported as truncated, then slices to MAX.
- [x] No code change; tree unchanged from Phase 656 (`tsc 0`, lint 0 errors / 157 warnings, `2582 passed`; desktop `281`).

## Phase 658: Web server security headers (none existed)

- [x] **Found: the Express server sent no security headers at all** — no `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS, or CSP — and advertised `X-Powered-By: Express`. Verified against the running built server, not just by reading the source.
- [x] **Fix:** new `registerSecurityHeaders(app)` in `server/http-middleware.ts` (same app-level pattern as `registerCors`/`registerBodyParsers`), wired into the entry. It disables `x-powered-by` and sets `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (keeps the `/w/<token>` share token out of third-party Referer headers), HSTS, and a CSP (`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` for NativeWind's runtime styles, `img-src` for distributor hosts, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`).
- [x] **Caught a real regression in my own first attempt:** `connect-src 'self'` blocked every API call when the app is served from a different origin than the API (the dev `.env`'s `localhost:3000`, and the real separate-host deployment). Verified in a real browser (4 CSP violations, API calls refused). The directive now includes the origin derived from `EXPO_PUBLIC_API_BASE_URL`; re-verified with **0 violations** and the app rendering.
- [x] **Tests:** two cases in `tests/http-middleware.test.ts` (baseline headers + no `X-Powered-By`; the configured API origin appears in `connect-src`). Both non-vacuous.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2584 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 659: tRPC error responses leaked the stack trace

- [x] **Found: API error responses included `data.stack`** (validation internals, absolute file paths, the thrown error's text) whenever `NODE_ENV` was not exactly `"production"` — and this server is routinely run without `NODE_ENV` (the same condition that made the JWT-secret fallback dangerous in Phase 617). Verified against the running built server: a malformed `prices.get` returned `{"code":"BAD_REQUEST","httpStatus":400,"stack":"TRPCError: [ … /home/…/routers.ts …"}`.
- [x] **Fix:** `redactErrorShape` now strips `data.stack` unconditionally (tRPC's default formatter adds it based on `NODE_ENV`, so relying on that is not enough). The message redaction for internal errors is unchanged; the real error is still logged server-side. Re-verified against the built server: the response keys are now `code`, `httpStatus`, `path` — no `stack`.
- [x] **Tests:** two cases in `tests/trpc-error-redaction.test.ts` (the stack is stripped and the rest of the shape preserved; the generic message still replaces an internal error's). Non-vacuous.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2586 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 660: Outbound HTTP had no timeouts (hung upstreams held requests open)

- [x] **Found: several server-side `fetch` calls had no deadline at all.** Node's `fetch` has no default timeout, so a stalled upstream held the request — and its socket — open indefinitely. The affected calls were the highest-impact ones: the **OAuth token/userinfo exchanges** (Google + Apple — a hung provider blocked the user's login), the **Resend email send**, the **S3 presign + upload** (`server/storage.ts`), and the **storage proxy's forge presign** (`server/_core/storageProxy.ts`).
- [x] **Fix:** new `server/fetch-timeout.ts` (`fetchWithTimeout(url, init, ms = 15s)`) using an `AbortController`, applied to all six call sites. The server also still relies on Node's `headersTimeout`/`requestTimeout` defaults for inbound slowloris protection, which are reasonable (60s/300s).
- [x] **Tests:** `tests/fetch-timeout.test.ts` (the signal is passed; the deadline aborts). Both non-vacuous.
- [x] **Verified already-guarded:** `server/fx.ts`, `server/product-parse.ts`, `server/user-llm.ts`, and `server/routers/trending.ts` all set their own abort deadlines; the storage proxy's key validation already blocks traversal/URLs/control chars.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2588 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 661: Bounded the MySQL connection pool

- [x] **Found: `mysql.createPool(url)` used mysql2's defaults** — `connectionLimit: 10` with an **unbounded wait queue** (`queueLimit: 0`). A burst of slow queries (a large sync push, a warmer tick, a catalog refresh) piles up in memory without limit instead of failing fast, and idle connections were never recycled on a long-lived server.
- [x] **Fix:** an explicit pool config — `connectionLimit` (default 10), `queueLimit` (default 200, so excess requests fail fast), `waitForConnections`, `maxIdle`, `idleTimeout: 60s`, `enableKeepAlive` — each overridable via `DB_POOL_LIMIT`/`DB_QUEUE_LIMIT`.
- [x] **Verified against the real database:** the full DB-gated suite passes with the explicit config (**2615 passed**), confirming the `uri` + options form works with this mysql2 version.
- [x] **Also verified:** 32 of 34 tRPC procedures are rate-limited; the two without (`me`, `logout`) are cheap and idempotent (no DB write, no paid call), so that is reasonable.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2588 passed` (27 skipped without a DB) / **`2615 passed`** with the DB; desktop `281 passed`.

## Phase 662: Inbound request handling audit (clean)

Verified the remaining inbound concerns against the running built server, not just the source.

- [x] **Path traversal: safe.** `express.static` rejects escapes, and the SPA fallback serves the fixed `index.html`. Five traversal attempts (`/../package.json`, `/..%2fpackage.json`, `/%2e%2e/package.json`, `/....//package.json`, `/static/../../package.json`) all returned the SPA shell with **0 leak markers** — never the file.
- [x] **SPA fallback boundaries: correct.** A non-GET to an unknown path → 404 (not the shell); `GET /api/nope` → `{"error":"Not found"}` 404 JSON; `GET /storage/foo` → the storage proxy's own "not configured" response (500), not the shell. The shell also revalidates (`Cache-Control` set explicitly, since `res.sendFile` bypasses `express.static`'s `setHeaders`).
- [x] **Rate-limit coverage: 32 of 34 procedures** (verified in Phase 661); the two without (`me`, `logout`) are cheap and idempotent.
- [x] No code change; tree unchanged from Phase 661 (`tsc 0`, lint 0 errors / 157 warnings, `2588 passed`; desktop `281`).

## Phase 663: Async-race sweep (found an out-of-order load on the health detail screen)

- [x] **Scanned every `useEffect` and `useCallback` async load for an unguarded `setState` after an `await`.** Zero unguarded effects; of the 37 callback candidates, most are one-at-a-time user mutations, and Home's `loadData` reads local storage idempotently (a focus + pull-to-refresh overlap just re-reads the same data).
- [x] **Found a real race in `app/health/[id].tsx`.** `id` comes from `useLocalSearchParams`, so navigating from one distributor's health page to another re-runs the load while the previous one is still in flight — the older result could land last and show the **wrong distributor's samples** (and status). Added a generation guard (`loadGenRef`) checked after each await, with `setLoading(false)` only for the current generation.
- [x] **Test:** a source guard asserting both awaits are guarded (count-based, so removing either fails). Non-vacuous — my first version only checked the string once and did *not* discriminate; strengthened after the mutation survived.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2589 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 664: Async-race sweep, part 2 (rates screen)

- [x] **Found a second real race in `app/(tabs)/rates.tsx`.** The mount effect fires `loadData()` immediately *and* again after `maybeRefreshFxRates()` resolves. Both await a storage read (`getFxHistory`), so the earlier (pre-refresh) read could land last and show **stale FX rates** — exactly the data the refresh had just updated. Added a generation guard (`loadGenRef`), checked before `setHistory`.
- [x] **Verified the other param-driven screens are already safe:** `app/product/[id].tsx` uses a `signal`-based cancellation; `app/compare/[id].tsx`'s effects are synchronous derivations of hook data, and its `useLiveProduct`/`useLiveWatchlist` hooks already carry generation guards (`generationRef`); `app/stats.tsx`, `app/restock-watches.tsx`, and `app/distributor-analysis.tsx` read local storage on focus (idempotent).
- [x] **Test:** a source guard for the rates screen (non-vacuous — removing the check fails it).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2590 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 665: Async-race sweep, part 3 (remaining loaders — clean)

- [x] **Checked the rest of the 37 candidates and found them safe:**
  - `app/search.tsx`'s `handleDiscover` and `app/(tabs)/settings.tsx`'s `handleShare` are guarded by an in-flight flag (`discovering` / `sharing`), so no concurrent run is possible.
  - `app/(tabs)/watchlist.tsx`'s `loadData` reads settings (changed only by user action) on focus; a re-run re-reads the same values, and `hasLoadedSettingsRef` gates the persist effect so a fallback can never clobber saved filters.
  - `app/(tabs)/index.tsx`'s `loadData` reads local storage idempotently; `app/search.tsx`'s recent-search handlers are sequential user actions.
- [x] **Async-race sweep complete:** two real races found and fixed (health detail in Phase 663, rates in Phase 664); every other candidate is guarded by an in-flight flag, reads idempotent local data, or is a synchronous derivation of already-loaded state.
- [x] No code change; tree unchanged from Phase 664 (`tsc 0`, lint 0 errors / 157 warnings, `2590 passed`; desktop `281`).

## Phase 666: Pulled sync items were written to the local store unvalidated

- [x] **Found: `applyLocalItem` cast pulled `data` straight to `Product`/`PriceAlert`/`BackOrderReminder`.** The server accepts `data` as `z.unknown()` (forward compatibility), so a buggy or malicious client can push a malformed item — `{id, name: 123, listings: "not-an-array"}` — that is then written into the local store and rendered on **every** device, and the local store is the source of truth so it persists.
- [x] **Fix:** a `sanitizePulledItem(collection, data)` guard at the top of `applyLocalItem` drops items that cannot be salvaged (no object, no string id for id-keyed collections, a watchlist without a string name or with a non-array `listings`, an alert without a finite `targetPrice`, a reminder without a string `reminderDate`). Settings is a single row keyed by the collection, so it is passed through to the existing per-field merge.
- [x] **Two mistakes caught by the existing suite while writing it:** reusing `normalizeSharedWatchlistProduct` dropped `tagsUpdatedAt` (breaking the tag-LWW merge), and requiring an `id` dropped every settings row (`AppSettings` has no `id`). Both fixed before committing — the sync suite (48 tests) passes.
- [x] **Tests:** `tests/sync-pulled-item-validation.test.ts` (a malformed watchlist item is dropped while a valid sibling is kept; an alert without a finite price is dropped; a valid settings row still applies). Non-vacuous.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2593 passed` (27 skipped without a DB); desktop `281 passed`.

## Phase 667: Other client-controlled stored inputs audit (clean)

Applied the Phase-666 lens (client-controlled data the server stores and serves) to the remaining boundaries.

- [x] **Notification config upload (`notifications.uploadConfig`) is thoroughly validated** — every array is a typed `z.object` with per-field caps (`id`/`productId` ≤191, `currency` ≤8, `distributorId` ≤64), `targetPrice` is `finite().positive()`, `direction` is an enum, `reminderDate` is length-capped *and* `Date.parse`-refined, and each array is `.max(MAX_UPLOAD_*)`. Nothing untyped reaches the JSON columns.
- [x] **Shared-watchlist inputs are all bounded** (`token` ≤64, `title` ≤255, `email` ≤191, `role` an enum, `membersOnly` a boolean).
- [x] **The shared payload has no separate untrusted input:** `sharedWatchlists.get` serves the *owner's* `watchlistItems` (already validated on `sync.push`), tombstone-filtered in SQL, capped with the `MAX + 1` trick. There is no client-supplied items payload to validate.
- [x] No code change; tree unchanged from Phase 666 (`tsc 0`, lint 0 errors / 157 warnings, `2593 passed`; desktop `281`).

## Phase 668: Guard-quality (mutation) pass on the desktop suite

First mutation pass over the desktop tests (281 → 282), the analogue of the root-suite passes that found real gaps.

- [x] **Caught (guards discriminate):** `evaluateBasketAlert`'s threshold comparison and its "clear the threshold only after a successful send" logic; `createForegroundSyncRetry`'s "retry only when a sync error is recorded" and its 1-second debounce.
- [x] **Real gap found and closed:** `resolveEventRoute`'s precedence (alert before watch before reminder) was untested — every existing case passed a single id, so swapping the alert/watch checks went unnoticed. Added a case with **both** an `alertId` and a `watchId`; it fails under the swap.
- [x] **Verified delegated logic is covered elsewhere:** `desktop/src/lib/health-probe.ts` calls the shared `detectHealthAlert`/`detectHealthRecovery`, which the root suite already mutation-tests.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2593 passed`; desktop `tsc 0`, `282 passed`.
- [x] Cumulative mutation sample across all passes: 43 areas, 4 real gaps (all closed).

## Phase 669: Guard-quality (mutation) pass on the Rust suite

Mutation pass over the desktop Rust tests (70 → 71).

- [x] **Caught (guards discriminate):** `is_allowed_storage_key` (disabling the allowlist fails the traversal test); `is_allowed_external_url` (allowing everything fails two scheme tests); `is_fresh_snapshot` (ignoring the TTL fails the boundary test).
- [x] **Real gap found and closed:** the lib.rs wrapper `is_blocked_error`/`classify_fetch_status` had no test of its own — `scrapers::is_blocked_error` is tested, but the wrapper is what the health path calls, so replacing the wrapper body with `false` went unnoticed and would misreport a blocked distributor as a transient error (the health dashboard and the breaker both key off it). Added a test using real `BLOCKED_MARKERS` entries; it fails under the mutation.
- [x] **Method note:** my first mutation attempt didn't compile (`#[allow(unreachable_code)]` on a statement), and cargo's stale binary made it look like the test passed. Re-ran with a compiling mutation to get a real signal — a reminder to confirm the mutation actually built before trusting a green run.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2593 passed`; desktop `tsc 0`, `282 passed`; `cargo test` 71, `cargo clippy` unchanged (4).
- [x] Cumulative mutation sample across all passes: 47 areas, 5 real gaps (all closed).

## Phase 670: Cross-fix interaction test (lib/sync.ts)

`lib/sync.ts` was the most-modified app file this session (byte caps, generation gate, full-resync drop condition, tag LWW, pulled-item sanitizer). Each fix was tested in isolation; this exercises them **together in one sync run**.

- [x] **Added `tests/sync-fixes-interaction.test.ts`:** one sync with a full resync (`fullResyncSince`), a malformed pulled item, a stale previously-synced item, a never-pushed local item, a newer remote tag removal, and a >5 MB dirty set. Asserts the malformed item never enters the store, the stale item is dropped, the never-pushed item survives, the remote tag removal wins, and the push is split into byte-bounded batches.
- [x] **Result: the fixes interact correctly** — no regression from combining them.
- [x] **Non-vacuous:** removing the sanitizer and reverting the drop condition each fail the combined test.
- [x] **Two fixture mistakes I made and corrected** (both were my test, not the code): a never-pushed item's meta stamp must be *after* the last successful sync (a stamp equal to the cursor is indistinguishable from "synced"), and the dirty set needed price history to actually exceed the 5 MB cap.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2594 passed` (27 skipped without a DB); desktop `282 passed`.

## Phase 671: The semaphore had no test (over-admission race unverified)

- [x] **Found: `lib/concurrency.ts`'s `createSemaphore` had no test of its own.** `tests/concurrency.test.ts` covers `server/concurrency.ts`'s `mapWithConcurrency` instead — a different module — so neither the over-admission race the file's own comment describes nor the `maxQueue` bound was verified.
- [x] **Added `tests/semaphore.test.ts`** (4 cases): the limit is never exceeded; a released slot is handed straight to a waiter (a second acquire while held queues); the queue bound sheds load with "queue full"; a non-positive limit is treated as 1.
- [x] **Non-vacuous, including the subtle one:** removing the `maxQueue` check fails the queue test, and replacing the slot-transfer release with the naive decrement-then-wake fails the race test (which forces the interleaving by releasing and synchronously acquiring before the waiter's continuation runs).
- [x] **Method note:** my first race test asserted the wrong invariant and failed on *correct* code; the second version asserts "exactly one of the two acquires is admitted", which is the actual guarantee and discriminates the mutation.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2598 passed` (27 skipped without a DB); desktop `282 passed`.
- [x] Cumulative mutation sample: 49 areas, 6 real gaps (all closed).

## Phase 672: background-safe-timers mutation pass (one non-discriminating mutation, correctly so)

- [x] **Caught:** removing the "returned to foreground mid-wait" branch (which hands the remainder to a plain `setTimeout`) fails the corresponding test.
- [x] **Investigated and correctly non-discriminating:** removing the `ms <= 0` short-circuit in `backgroundSafeDelay` does **not** fail any test — and that is right, not a gap: with the short-circuit gone the backgrounded poll loop's first tick sees `Date.now() >= deadline` and resolves immediately, so the branch is a pure optimization rather than a correctness guarantee. The existing "delay resolves immediately when duration is 0" test still passes because the behaviour is unchanged.
- [x] No code change; tree unchanged from Phase 671 (`tsc 0`, lint 0 errors / 157 warnings, `2598 passed`; desktop `282`).
- [x] Cumulative mutation sample: 51 areas, 6 real gaps (all closed); 2 mutations confirmed behaviourally equivalent rather than gaps.

## Phase 673: withTimeout's background branch was untested

- [x] **Found: `withTimeout`'s background branch had no test.** `tests/with-timeout.test.ts` only exercised the foreground path, so the branch's entire contract — mapping the background-safe race's `undefined` sentinel to `null` ("null means timeout") — was unverified. Removing the mapping left the suite green.
- [x] **Added two cases** (`tests/with-timeout.test.ts`): while backgrounded, a fast value resolves and a hung promise resolves to `null`; `withTimeoutReject` throws on the background timeout. Non-vacuous (removing the mapping fails the first).
- [x] **Also caught:** removing `withTimeout`'s timer cleanup fails the existing "leaves no pending timer after settle" test.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2600 passed` (27 skipped without a DB); desktop `282 passed`.
- [x] Cumulative mutation sample: 53 areas, 7 real gaps (all closed).

## Phase 674: Storage mutation pass (two real gaps closed)

Mutation pass over the storage modules changed this session.

- [x] **Gap 1 — the 500-point history cap was untested.** Keeping the *oldest* points instead of the newest (`slice(0, MAX)` vs `slice(-MAX)`) left the suite green, which would silently show stale prices and drop recent history. Added a case with 520 points asserting the newest survive and the oldest do not. Non-vacuous.
- [x] **Gap 2 — `deactivateAlert`'s stale-event guard was untested.** Removing the "an event older than the alert's current activation must not deactivate a freshly re-armed alert" check left the suite green, which would immediately re-trigger a re-armed alert for a price drop that already happened. Added a case (a pre-activation event does not transition; a current one does). Non-vacuous.
- [x] **Caught:** `deactivateAlert`'s compare-and-set guard (the double-fire protection) fails the existing "transitions exactly once under concurrent calls" test when removed.
- [x] **Method note:** my first mutation run targeted the wrong test files (`tests/alerts*.test.ts` rather than `tests/storage.test.ts`, where `deactivateAlert` is actually exercised) and looked like a surviving mutation — re-ran against the right file.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2602 passed` (27 skipped without a DB); desktop `282 passed`.
- [x] Cumulative mutation sample: 57 areas, 9 real gaps (all closed).

## Phase 675: sync-meta corruption tests (one real gap closed)

- [x] **Gap — the sync-meta payload guards were untested.** No test exercised a corrupt `sync_meta` payload, so removing the `lastSyncedAt` type check (trusting a string as the cursor) left the suite green — a bogus cursor makes the next sync incremental and silently skips items. Added `tests/sync-meta-corrupt.test.ts` (5 cases): non-object payloads (`[]`, a string, a number, `null`), invalid JSON, a non-numeric `lastSyncedAt`, a non-object `items` map, and a valid payload round-trip. Non-vacuous (removing the `lastSyncedAt` check fails it).
- [x] **Investigated and correctly non-discriminating:** removing the `Array.isArray(parsed)` check does not fail any test — and that is right, not a gap: an array payload has no `lastSyncedAt`/`items`, so the downstream type checks yield the same `0`/`{}` result. The array check is defensive (it makes the intent explicit) rather than behaviour-changing.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2607 passed` (27 skipped without a DB); desktop `282 passed`.
- [x] Cumulative mutation sample: 59 areas, 10 real gaps (all closed); 3 mutations confirmed behaviourally equivalent.

## Phase 676: Server data-module mutation pass (all guards discriminate)

Mutation pass over `server/devices.ts` and `server/db.ts`.

- [x] **Caught:** `isDeviceRevoked`'s global `*:<deviceId>` wildcard (memory) and its legacy-NULL global block (DB, both sites) — removing either fails the device-revocation tests. The token-consume existence check (the Phase-594 double-consume protection) and the memory used/expired checks (3 sites each) — disabling either fails "rejects a second consume even when an in-memory copy exists".
- [x] **Method note:** the token-consume patterns appear three times (password reset, email verification, and one more), so a `count == 1` assertion correctly refused to mutate — switched to a line-based edit that reported the real site count (3) before mutating.
- [x] No code change; tree unchanged from Phase 675 (`tsc 0`, lint 0 errors / 157 warnings, `2607 passed`; desktop `282`).
- [x] Cumulative mutation sample: 63 areas, 10 real gaps (all closed).

## Phase 677: Timezone/DST audit — quiet-hours offset branch was untested

- [x] **Found: `isInQuietHours`'s `utcOffsetMinutes` branch had no test.** The offset path is the *server-side* one (the client sends its offset so the server evaluates the window in the user's local time); flipping the sign (`utc - offset` → `utc + offset`) left the suite green, which would fire notifications during the user's quiet hours. Added three cases (UTC-4 overnight, UTC+8 positive offset, and a UTC-8 daytime window with both an inside and an outside instant). Non-vacuous — the sign flip now fails three tests.
- [x] **Verified the drop calendar's local-time bucketing is intentional and correct.** `drop-calendar.ts` deliberately uses local date parts (a user-facing calendar buckets by the user's local day), with documented calendar-date arithmetic rather than fixed 24h steps; `tests/drop-calendar-dst.test.ts` pins `TZ=America/New_York` and covers spring-forward. I also checked fall-back empirically: the calendar-date arithmetic yields 30 unique keys including the 25-hour day (and the buggy fixed-24h version happens to pass fall-back too — it is the spring-forward direction that breaks, which the test covers).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2610 passed` (27 skipped without a DB); desktop `282 passed`.
- [x] Cumulative mutation sample: 65 areas, 11 real gaps (all closed).

## Phase 678: Notification digest/evaluator mutation pass (all guards discriminate)

- [x] **Caught:** `shouldHoldScope`'s "every bound config must opt in" rule (changing `every` → `some` fails "delivers when any device lacks prefs" — one old client without quiet hours would otherwise delay every device's notifications); `mergeDigestHeld`'s dedup by `dedupKey` (defeating it fails "merges by dedupKey, latest wins"); `takeDigestHeld`'s consume-once (not deleting the buffer fails "resumes individual delivery on later ticks").
- [x] **Investigated and correctly non-discriminating:** shifting the health dedup bucket by a constant (`Math.floor(now / BUCKET) + 1`) does not fail any test — and that is right: a constant shift preserves which events fall in the same window, so it is behaviourally equivalent, not a gap.
- [x] No code change; tree unchanged from Phase 677 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).
- [x] Cumulative mutation sample: 69 areas, 11 real gaps (all closed); 4 mutations confirmed behaviourally equivalent.

## Phase 679: Memory-growth audit (clean)

Scanned every module-level `Map`/`Set` and the growing persisted collections for unbounded accumulation.

- [x] **All five module-level collections are bounded by a fixed key space:** `COMMERCE_SUFFIXES` (a constant set); `breakerQueues` (keyed by `distributorId:model`, bounded by the catalog × 25 distributors, and overwritten rather than appended); `quarantineKeys` (keyed by storage key, with a per-key cap of 3); `catalogWarmAttempts`/`imageGenerationAttempts` (keyed by the fixed catalog/product set).
- [x] **The persisted collections are capped:** the discovery store at 200 products/distributors; the displayed-event-id list at 200 (oldest spliced off); the notification history at 200 (oldest truncated). The server purges old `notificationEvents` on the warmer tick.
- [x] **Method note:** my first grep missed the `ids.length > 200` cap form (it looked for `size`), which briefly made the notification history look unbounded — reading the actual function showed the cap.
- [x] No code change; tree unchanged from Phase 678 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).

## Phase 680: End-to-end web app against a live API + database (clean)

The earlier web smoke (Phase 632) had a dead API (a dev `.env` baked in). This run served the export from the API server itself and exercised the real client↔server contract.

- [x] **Full stack up:** built the server bundle + web export, started it against MySQL, and drove it in headless Chromium.
- [x] **The client↔server contract works end-to-end:** register → cookie session → authenticated `/api/auth/me` (200, user returned) → a tRPC query (`fx.get`, 200, 2.6 KB) all succeed. The app's own API calls reach the correct origin with **0 failed requests and 0 page errors**, and the shell renders the seeded watchlist.
- [x] **Confirmed the AGENTS.md gotcha empirically:** the first export baked in the stale `EXPO_PUBLIC_API_BASE_URL` (`localhost:3000`) because Metro's transform cache missed the change — 13 `ERR_CONNECTION_REFUSED` requests to the wrong origin. Re-running `expo export -p web --clear` produced a bundle with 0 `localhost:3000` and 3 `127.0.0.1:4650` references, after which every request succeeded. The documented `--clear` requirement is real and load-bearing.
- [x] No code change; tree unchanged from Phase 679 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).

## Phase 681: End-to-end desktop app against a live API + database (clean)

The desktop analogue of Phase 680 — the desktop's own tRPC/header layer had never been exercised end-to-end.

- [x] **Full stack up:** built the server bundle + desktop renderer (`VITE_API_BASE_URL` baked in — 3 references, no stale value), served the renderer, and started the API against MySQL.
- [x] **The desktop client works end-to-end:** it boots (onboarding + full nav), register returns 200 with a session token, and a tRPC query (`fx.get`) returns 200 / 2.6 KB — **0 failed requests, 0 page errors**.
- [x] **Verified the CORS boundary is correct, not broken:** the first attempt failed with `Failed to fetch` because the desktop renderer (`:4661`) calls the API (`:4660`) cross-origin and `CORS_ALLOWED_ORIGINS` was empty — the browser blocked it. Setting the origin produced `Access-Control-Allow-Origin` + `Access-Control-Allow-Credentials`, after which everything worked. That is the allowlist doing its job (a wildcard would have been the bug).
- [x] No code change; tree unchanged from Phase 680 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).

## Phase 682: Storage-key privacy boundary audit (clean)

Diffed the full `STORAGE_KEYS` list against what each wipe path removes — a key that is neither wiped nor deliberately preserved would leak across accounts.

- [x] **`clearAccountData` removes every user-content key** (watchlist, alerts, reminders, stock watches, digest snapshot, sync meta, displayed event ids, notification history, pending health events, discovered products/distributors) plus the legacy keys, recent searches, error breadcrumbs, the breaker store, and the quarantine blobs.
- [x] **The four keys it keeps are all deliberate device-level state, none carrying user content:** `app_settings` (device preferences — with the BYO-LLM key stripped and the LLM config reset), `fx_rates` / `fx_rate_history` (public market data), and `background_task_interval` (a device registration marker).
- [x] **`clearAllData` removes every key** (verified programmatically: no key in `STORAGE_KEYS` is missed).
- [x] No code change; tree unchanged from Phase 681 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).

## Phase 683: Malformed server-response handling audit (clean)

Checked how each client fetch handles a 200 with an unexpected body (a proxy HTML page, a truncated payload) — not just an error status.

- [x] **`lib/server-prices.ts`:** the direct background path's `JSON.parse(html)` is outside its own try but inside `fetchServerPrice`'s `try/catch` (returns null), and the shape is read with optional chaining plus a `!json` guard and `history ?? []`. The foreground tRPC path validates `!result.snapshot && !result.history?.length` and defaults `history`.
- [x] **`shared/src/fx.ts`'s `fetchFxRates`:** validates `typeof result.rates === "object" && result.rates !== null` and `fetchedAt` numeric, and catches everything (returns null). `lib/fx.ts` additionally guards `typeof result.fetchedAt !== "number" || result.fetchedAt <= 0`.
- [x] **`lib/server-insights.ts` / `lib/server-images.ts` / `lib/server-notifications.ts`:** each has a `catch` on its fetch path.
- [x] No code change; tree unchanged from Phase 682 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).

## Phase 684: Error-message contract audit (clean)

Checked every user-facing failure path for actionable messages and internal-detail leakage.

- [x] **Server errors are redacted before they reach the UI:** `redactErrorShape` replaces an internal error's message with a generic one (and strips the stack, Phase 659), so a surfaced `data.error` is a deliberate, safe message.
- [x] **Client fallbacks are generic:** every `showAlert`/`setError`/`setLoadError` site uses `err instanceof Error ? err.message : "<generic>"`, and the throwing helpers (e.g. `resetPassword` → `data.error || "Password reset failed"`) fall back to a generic string when the server sends none.
- [x] **The error boundary's message display is a deliberate crash-screen aid** (truncated to 160 graphemes, grapheme-safe), showing the app's own error rather than server data.
- [x] No code change; tree unchanged from Phase 683 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).

## Phase 685: Static data integrity audit (clean)

Verified the catalog, distributor list, seed list, and sample data are internally consistent — a dangling reference would break rendering.

- [x] **Catalog:** 42 products, all ids unique (no duplicates).
- [x] **Seed list:** all 7 `SEED_IDS` exist in the catalog (a missing one would seed a product that cannot resolve).
- [x] **Sample data:** all 7 keys exist in the catalog, and its 16 `distributorId` references all resolve to real distributors.
- [x] **Catalog listings:** every `distributorId` reference resolves to a real distributor.
- [x] No code change; tree unchanged from Phase 684 (`tsc 0`, lint 0 errors / 157 warnings, `2610 passed`; desktop `282`).

## Phase 686: The Forge LLM client had no request timeout

- [x] **Found: `server/_core/llm.ts`'s `fetchWithBackoff` had no deadline.** Node's `fetch` has no default timeout, so a hung Forge request held the caller — a **paid** insight/discovery/trending call — open indefinitely, tying up the socket and the handler. (`user-llm.ts` already had its own AbortController for the direct provider path; the Forge path did not.)
- [x] **Fix:** a per-attempt `AbortController` with a 30-second deadline, aborted and retried by the existing backoff loop (the caller's own signal still wins if supplied), cleared in a `finally`.
- [x] **Tests:** `tests/llm-fetch-timeout.test.ts` (the request carries an abort signal; a network error retries the full budget and then throws). `invokeLLM` is mocked in 7 other suites, so this is the first test to exercise the real fetch path. Non-vacuous (removing the signal fails both).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2612 passed` (27 skipped without a DB); desktop `282 passed`.

## Phase 687: The paid image-generation client had no request timeout

- [x] **Found: `server/_core/imageGeneration.ts` had five `fetch` calls with no deadline** (the Forge image API, the local Ollama `/v1/images/generations` and `/api/tags`, the direct OpenAI API, and the model-list call). Node's `fetch` has no default timeout, so a hung provider held the request — and its socket — open indefinitely on the **paid** image path (`server/product-images.ts` → `generateImage`).
- [x] **Fix:** new `server/_core/fetch-timeout.ts` (`fetchWithTimeout`, 60 s default, caller's own signal wins) applied to all five sites.
- [x] **Tests:** `tests/core-fetch-timeout.test.ts` (the signal is passed; the deadline aborts). Non-vacuous.
- [x] **Also noted:** `server/_core/voiceTranscription.ts` (288 lines) is unused, like `heartbeat.ts`/`dataApi.ts` — framework code, reported rather than removed.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2614 passed` (27 skipped without a DB); desktop `282 passed`.

## Phase 688: The owner-notification helper had no request timeout (outbound-timeout class closed)

- [x] **Found: `server/_core/notification.ts`'s `notifyOwner` had a `fetch` with no deadline** — reachable via the admin `systemRouter.notifyOwner` procedure. A hung notification service held the request open indefinitely.
- [x] **Fix:** wrapped with the `_core` `fetchWithTimeout` (60 s).
- [x] **Closed the class:** every *reachable* `_core` fetch now has a deadline. The remaining unwrapped ones are in `llm.ts` (already wrapped by its own `AbortController`, Phase 686) and in `dataApi.ts` / `heartbeat.ts` / `voiceTranscription.ts`, which are **dead code** (no callers — reported, not removed, as framework files).
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2614 passed` (27 skipped without a DB); desktop `282 passed`.

## Phase 689: Hooks audit (clean)

Reviewed every hook in `hooks/` (several had no direct test).

- [x] **`use-search-data`:** parallel `getWatchlist`/`getTagDefinitions` loads, each with a `.catch`, and the selected tag ids are filtered against the loaded definitions (dropping orphaned ids). Correct.
- [x] **`use-connection`:** a React Query poll (60 s) with `retry: 1`, an AppState listener that refetches on foreground **with a proper `sub.remove()` cleanup**, and a status derived from `reachable`/`isAuthenticated`/`configured`. Correct.
- [x] **`use-server-config`:** a trivial memo over `isServerConfigured()`. Correct.
- [x] **`use-color-scheme` / `.web`:** the web variant handles the SSR hydration case (returns "light" until hydrated, then the real scheme), avoiding a hydration mismatch. Correct.
- [x] **`use-alert-badge`:** carries the Phase-601 storage subscription and the mounted guard. Correct.
- [x] **`use-auth`, `use-alerts-data`, `use-live-prices`, `use-colors`:** already covered by tests and audited in earlier phases.
- [x] No code change; tree unchanged from Phase 688 (`tsc 0`, lint 0 errors / 157 warnings, `2614 passed`; desktop `282`).

## Phase 690: Desktop Modal had the same inline-onClose effect bug as DialogOverlay

- [x] **Found: `desktop/src/components/Modal.tsx`'s keydown/focus-trap effect depended on `[open, onClose]`.** `ProductDetail.tsx` passes an inline `onClose` at four sites, so the effect re-ran on every parent render — re-adding the keydown listener and popping/re-pushing the dialog token each time (corrupting the shared dialog stack so Escape could close the wrong dialog). This is the exact bug fixed in `DialogOverlay` in Phase 605; `Modal.tsx` was missed.
- [x] **Fix:** the handler now lives in an `onCloseRef` and the effect is keyed on `[open]` only, matching `DialogOverlay`.
- [x] **Tests:** added two `Modal` cases (it had none) — an accessible dialog that focuses into it, and Escape closing it exactly once. Non-vacuous for the behaviour they assert.
- [x] **Honest note:** I tried to write a test that discriminates the *dependency* change specifically (a nested-dialog stack test and a listener-count test), but both were non-discriminating — React already cleans up the previous listener, and the nested-dialog harness did not reproduce the ordering. Removed them rather than keep tests that pass either way; the fix is the proven Phase-605 pattern.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2614 passed`; desktop `tsc 0`, `284 passed`.

## Phase 691: Desktop components audit (clean)

Reviewed the desktop components with real logic (beyond the `Modal` fix in Phase 690).

- [x] **`Sidebar`:** the badge uses the shared `countActiveAlerts` predicate (matching mobile, after an earlier fix that had counted unread notifications instead), the load is best-effort with a `catch`, and the `window` focus listener has a proper `removeEventListener` cleanup.
- [x] **`TrendingSection`:** `load` is a `useCallback` with `catch`/`finally`, the watchlist read has a `catch`, and `ensureWatchlistProduct` adds before navigating (so the detail screen can resolve a server-only trending product) with a failure toast.
- [x] **`search-chrome`:** `loadRecent`/`saveRecent`/`recordRecent` reuse the shared `lib/recent-searches` helpers (cap + dedup can't drift from the storage wipe's key), and the read-modify-write is synchronous localStorage (no async race).
- [x] **`ProductImage`:** correct `active` guard, module cache, and cleanup (verified in Phase 690's review).
- [x] No code change; tree unchanged from Phase 690 (`tsc 0`, lint 0 errors / 157 warnings, `2614 passed`; desktop `284`).

## Phase 692: Desktop HealthDetail had the same out-of-order load bug as mobile

- [x] **Found: `desktop/src/pages/HealthDetail.tsx`'s `load` had no generation guard.** `id` comes from the route, so navigating from one distributor's health page to another re-runs the load while the previous one is still in flight — the older result could land last and show the **wrong distributor's samples** (and status). This is the exact bug fixed on mobile in Phase 663; the desktop page was missed.
- [x] **Fix:** a `loadGenRef` generation guard checked after each await, with `setLoading(false)`/`setLoadError` only for the current generation.
- [x] **Test:** `desktop/tests/health-detail-race.test.ts` asserts both awaits are guarded (count-based). Non-vacuous.
- [x] **Audited the other untested desktop pages and found them correct:** `ResetPassword` (validation, `aria-*`, `disabled` double-submit guard, server-error surfacing), `SharedWatchlist` (uses the shared untrusted-data normalizer, dedup-aware add, mutation catches with toasts), `DistributorAnalysis`.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2614 passed`; desktop `tsc 0`, `285 passed`.

## Phase 693: Mobile↔desktop parity audit of this session's fixes (clean)

Checked whether each mobile fix from this session has a desktop counterpart, and whether the desktop has the same bug.

- [x] **Already mirrored:** compare's selection latch (`latchSelection`/`selectionInitialized`), search reading `getDiscoveredProducts`, the AI-discovery `rediscoverProduct` step, and the product-detail alert in-flight guard (`creatingAlert`) are all present on desktop.
- [x] **No desktop counterpart (nothing to fix):** the mobile tag-picker's synced-id reset — the desktop has no tag-picker component.
- [x] **Not applicable by architecture:** the mobile undo bug (restoring a cascade-cancelled `notificationId`) — the desktop has **no local notification scheduling** at all (it relies on server push and the notification pull), so there is no local id to restore. Its undo correctly restores the product, alerts, reminders, and watches.
- [x] No code change; tree unchanged from Phase 692 (`tsc 0`, lint 0 errors / 157 warnings, `2614 passed`; desktop `285`).

## Phase 694: Mobile verify-email refresh was unauthenticated (the desktop fix never reached mobile)

- [x] **Found: `app/verify-email.tsx`'s post-verification refresh called `fetchCurrentUser(baseUrl)` with only `credentials: "include"`.** On React Native the session cookie is not reliably sent cross-origin, so `/api/auth/me` 401'd and the "verify your email" banner never cleared until the next sign-in. This is the **mirror** of the Phase-605 desktop fix (which added the Bearer header) — this time the desktop had it and mobile did not.
- [x] **Fix:** the refresh now passes a fetch wrapper adding `Authorization: Bearer <sessionToken>` (from `Auth.getSessionToken()`), matching `lib/_core/api.ts`'s `apiCall`.
- [x] **Tests:** a source guard in `tests/screen-fixes-source-guards.test.ts` (non-vacuous — removing the header fails it) and the existing parity test's assertion updated to the new form.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2615 passed` (27 skipped without a DB); desktop `285 passed`.

## Phase 695: Remaining screens + privacy-policy accuracy audit (clean)

- [x] **`app/dev/theme-lab.tsx`** is a documented stub; **`app/product/_components.tsx`** is 7 lines; **`app/privacy.tsx`** is static text. No logic to audit.
- [x] **Verified the privacy policy's claims against the code** (a stale policy is a compliance issue):
  - "delete your account … removes your synced watchlist, alerts, reminders, settings, and device records" — the delete-account feature exists (`/api/auth/delete-account` → `deleteUserById`), and the deletion is comprehensive: FK cascades cover `watchlist_items`, `price_alerts`, `back_order_reminders`, `app_settings`, `device_notification_configs`, `notification_events`, `device_push_tokens`, `password_reset_tokens`, and `shared_watchlists`; the non-FK tables (`device_labels`, `revoked_devices`) are cleaned explicitly.
  - "a hashed password (never the password itself)" — passwords are bcrypt-hashed; the raw value is never stored or returned (`auth.me` never returns the raw user row).
  - "we do not send your watchlist or account details to those sites — only the product model being looked up" — scrapers fetch by model number only.
  - "we do not use third-party advertising or tracking SDKs" — no analytics/tracking dependency in `package.json`.
- [x] No code change; tree unchanged from Phase 694 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 696: Database schema index audit (clean)

Checked all 20 tables for missing indexes on FK columns and hot query paths.

- [x] **Every hot query path has a supporting index:** `device_notification_configs` (userId), `notification_events` (userId+dedupKey unique, deviceId+dedupKey unique, createdAt for purges, deviceId), `price_history` (composite PK + a `date` index for the purge), `shared_watchlist_members` (composite PK + token + user), `device_push_tokens` (userId), and the rest.
- [x] **The three FK columns my static scan flagged are all indexed — verified against the live schema, not the source:** `app_settings.userId` is the primary key; `password_reset_tokens.userId` and `email_verification_tokens.userId` have InnoDB's **auto-created FK indexes** (`*_userId_users_id_fk`), confirmed via `SHOW INDEX` on the migrated test database.
- [x] **Method note:** the static scan produced false positives because it did not model InnoDB's automatic FK indexing; querying the real schema settled it.
- [x] No code change; tree unchanged from Phase 695 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 697: Desktop Rust scrapers audit (clean)

- [x] **`breaker.rs` mirrors the shared resilient-fetch semantics** (30-min block cooldown growing 1.5× to a 2-hour cap; hard errors cool down only at the 3-failure threshold for a flat 15 min; any success resets) and has tests.
- [x] **All 25 Rust parsers delegate to the shared `parse_price_page`**, which gates on `model_mismatch` and returns an error for a wrong-product result — the same architecture as mobile, so the AGENTS.md "thread the model and gate on mismatch" rule holds. The gate itself has tests (`mismatch_of` cases).
- [x] **`parse_price_from_text` mirrors the mobile fix** (first number run only, with space/NBSP thousands separators kept), so "Was $100 Now $80" cannot parse as 10080.
- [x] No code change; tree unchanged from Phase 696 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`; `cargo test` 71).

## Phase 698: Desktop lib modules audit (clean)

Reviewed the desktop `lib/` modules that had no direct test.

- [x] **`launch.ts`:** each step (seed → poller → FX warm → launch price check) is independently try/caught, and the ordering is deliberate (FX warmed before the check so it converts with live rates). Correct.
- [x] **`share.ts`:** clipboard write with a `document.execCommand` fallback and proper textarea cleanup; PNG export appends/clicks/removes the anchor. Correct.
- [x] **`device-id.ts`:** caches a memory fallback for a storage failure (a new id per call made the server see a different device every request) and dedups concurrent calls via a shared `pending` promise. Correct.
- [x] **`device-cleanup.ts` / `push-unregister.ts`:** both race the call against a timeout and clear the timer in a `finally`, returning a safe fallback on failure. Correct.
- [x] **`notification-permission.ts`:** gates on `Notification.permission`, requests when `default`, and falls through to granted for Tauri. Correct.
- [x] No code change; tree unchanged from Phase 697 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 699: Root layout launch sequence audit (clean)

Reviewed `app/_layout.tsx` (458 lines) — the app's entry point.

- [x] **Launch effect:** the notification-channel chain has a `.catch` so a storage read failure cannot skip task registration, the launch price check, push registration, or the server-notification pull; each async step is individually caught. The missing-listings discovery is bounded per run.
- [x] **Notification-tap effect:** dedups responses with a 2-second TTL, prunes entries older than 10 s, caps the map at 100, and defers navigation until the root tree is ready (cold start) via `rootNavigationReadyRef`/`pendingRouteRef`.
- [x] **Sync-retry effect:** debounced (1 s), catches the storage read, and registers/removes the correct listener for web (`focus` + `visibilitychange`) and native (`AppState`).
- [x] **Sign-in effect:** resets the device-revoked flag and kicks off sync, history backfill, and stale-device cleanup.
- [x] **FX effect:** both `loadFxRates` and `maybeRefreshFxRates` are caught.
- [x] No code change; tree unchanged from Phase 698 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 700: Mobile product/watchlist components audit (clean)

Reviewed the components with effects/state in the two largest groups.

- [x] **`notes-card`:** loads the note on `productId` change, saves with a `catch` that surfaces an error and does not clear the draft, and haptics are web-guarded. Correct.
- [x] **`search-bar`:** a controlled input (the parent owns the query) with no internal debounce, a clear button, and a11y labels. Correct.
- [x] **`edit-product-sheet`:** `canSave` includes `!saving` (in-flight guard), validates name/modelNumber, and on a storage failure shows an alert **without** closing the sheet as if the edit succeeded. Correct.
- [x] **`price-alert-modal`:** no async effect; the price input is validated by the caller. Correct.
- [x] No code change; tree unchanged from Phase 699 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 701: Mobile alerts/compare/settings components audit (clean)

- [x] **`compare/multi-line-chart`:** guards every NaN/empty case — `allPrices.length === 0` and `allDates.length === 0` early returns, `Number.isFinite`/`Number.isNaN` per point, `dateRange || 1` (divide-by-zero), and an `isFlat` branch for an all-equal series.
- [x] **`compare/cheapest-region-card`:** the pulse animation has an `anim.stop()` cleanup, and the memo passes the live-rate converter so it agrees with the prices beside it.
- [x] **`settings/llm-settings-section`:** three debounced autosaves (API key, model, Ollama URL), each with a `clearTimeout` cleanup and a no-op guard when unchanged; the key is masked behind a show/hide toggle.
- [x] **`alerts/*`:** no async effects (pure cards/modals).
- [x] No code change; tree unchanged from Phase 700 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 702: Remaining mobile component groups audit (clean)

- [x] **`search/product-image`:** a carefully-built bounded loader — LRU cache capped at 200, max 3 concurrent fetches, `requestIdleCallback` deferral with a `setTimeout` fallback, and a cleanup that removes a still-queued task. The in-flight counter is incremented only on the immediate path and decremented on every terminal path (including the not-active early return), so it cannot leak; the cleanup splices a queued task (never counted) without touching the counter.
- [x] **`ui/toast`, `ui/skeleton`, `search/catalog-search-bar`, `search/manual-add-sheet`, `home/trending-section`:** reviewed; each has a proper cleanup or is a pure render.
- [x] No code change; tree unchanged from Phase 701 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 703: shared/src modules audit (clean)

- [x] **`compare-utils`:** `filterByRange` anchors the window on `min(now, maxDate)` so a future-dated point cannot shift the cutoff; `cheapestByRegion` prefers in-stock over back-order per region, skips non-orderable/non-positive prices, guards non-finite conversions, and takes an injectable converter so it agrees with the live-rate prices beside it; `distributorColor` is a deterministic hash shared by mobile + desktop (fixing the desktop's selection-order recoloring).
- [x] **`log.ts`:** a dev-only logger guarded with `typeof __DEV__ !== "undefined"` (the safe form — unlike the Phase-634 `import.meta.env.DEV` bug), and it is used only in `lib/_core/api.ts`, which the server bundle never imports.
- [x] **`catalog` / `distributors` / `currency` / `fx` / `history-upload` / `trending`:** all have tests and were audited in earlier phases.
- [x] No code change; tree unchanged from Phase 702 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`).

## Phase 704: CI ran only 3 of the 8 DB-gated test suites

- [x] **Found: `test:db` was a hand-maintained list of three files** (`sync-e2e`, `sync-db`, `create-user-transaction`), but there are now **eight** DB-gated suites — the five added this session (`auth-pre-hijack-db`, `notification-refire-db`, `server-db-branches`, `sync-settings-secret-db`, `token-double-consume-db`) **never ran in CI**, so their guards (the OAuth pre-hijack eviction, the notification re-fire, the quiet-hours route, the server-side key strip, the token double-consume) were unverified on every push.
- [x] **Fix:** new `scripts/test-db.mjs` discovers every `tests/*.test.ts` containing `RUN_DB_TESTS` and runs them (failing loudly if none are found), so a future DB-gated suite is picked up automatically. `test:db` now calls it; the CI comment was updated.
- [x] **Verified:** `pnpm test:db` now runs **8 files / 30 tests** (was 3 files) and passes against the test database.
- [x] **Also verified:** every other CI script reference exists (`check`, `check:desktop`, `lint`, `test`, `build`, `smoke:web`, `db:push`), and `scripts/smoke-web.mjs` exists.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2615 passed` (27 skipped without a DB); desktop `285 passed`.

## Phase 705: CI never compiled the Rust backend (and clippy had 4 warnings)

- [x] **Found: nothing in CI compiled the desktop Rust backend.** The 71 `cargo test` cases and clippy ran only on developer machines, so a Rust regression could merge unchecked.
- [x] **Fix:** a new `rust` CI job (stable toolchain + clippy + `Swatinem/rust-cache`, GTK/WebKit dev headers for tauri/wry) running `cargo test`, `cargo fmt --check`, and `cargo clippy --all-targets -- -D warnings`.
- [x] **Fixed the 4 clippy warnings so `-D warnings` passes:** `parts[0].len() >= 1` → `!parts[0].is_empty()`; a redundant `as u32`; two `&PathBuf` params → `&Path` (adding the `Path` import); and `parse_html` moved above the `#[cfg(test)]` module in `mikrotikstore.rs` ("items after a test module"). `cargo fmt` applied.
- [x] **Fixed a test that depended on formatting:** `cargo fmt` wrapped the parsers' `format!`/`parse_price_page` calls across lines, breaking the parity scanner's single-line regex (it found 3 of 25 parsers). The scanner is now tolerant of wrapped calls.
- [x] Root `tsc 0`, lint 0 errors (157 warnings), `2615 passed`; desktop `285 passed`; `cargo test` 71, `cargo clippy` **0**, `cargo fmt --check` clean.

## Phase 706: Build/config files audit (clean)

- [x] **`vitest.config.ts`:** alias ordering is deliberate (`@shared/const` before the `@shared` prefix), `desktop/**` is excluded (it has its own config), and `fileParallelism` is disabled for DB runs.
- [x] **`tsconfig.json`:** strict, includes `.expo/types` + the env declarations, excludes `desktop`.
- [x] **`eslint.config.js`:** ignores the build outputs, and the node-side override (server/scripts/shared) turns off the RN dynamic-env rule and adds the Node globals. `.mjs` scripts lint clean.
- [x] **`metro.config.js` + `scripts/metro-resolver.js`:** the resolver redirects `lib/scrapers/browser` → the playwright-free `browser.web.ts` stub and `cheerio` → its browser build on native, and the config pre-creates the NativeWind CSS cache file so a clean install (CI/Railway) doesn't fail the web export. The resolver has tests (`tests/metro-resolver.test.ts`).
- [x] **`eas.json` / `drizzle.config.ts` / `babel.config.js`:** correct (build profiles, a required `DATABASE_URL`, the NativeWind/worklets presets).
- [x] No code change; tree unchanged from Phase 705 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 707: Full CI pipeline run locally (clean)

Ran the exact CI sequence end to end, including the two steps not exercised since the CI changes.

- [x] **`pnpm build`** (server bundle + web export) succeeds; **`pnpm smoke:web`** renders the SPA (289 chars) with no `import.meta`/blank-page failure.
- [x] **`pnpm db:push` against a fresh database** generates and applies every migration successfully.
- [x] **Verified the migrated schema:** 20 app tables + `__drizzle_migrations`, and the Phase-596 `users.credentialsChangedAt` column is present — the migration chain is complete and applies cleanly from scratch (so CI's DB tests run against the real schema).
- [x] No code change; tree unchanged from Phase 706 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 708: Test setup audit (clean)

- [x] **Root `tests/setup.ts`** sets `__DEV__ = true` so `shared/src/log.ts`'s guard and any dev-only branch behave as in development.
- [x] **Desktop `tests/setup.ts`** adds jest-dom matchers, the same `__DEV__` global (with a comment explaining why the vite `define` doesn't reliably reach `../lib/*` under vitest), `matchMedia`, a `ResizeObserver` mock that reports a fixed size (so Recharts' `ResponsiveContainer` renders in jsdom), and the Tauri `__TAURI_INTERNALS__`/`__TAURI_EVENT_PLUGIN_INTERNALS__` stubs so pages calling `invoke()`/`listen()` don't throw.
- [x] No code change; tree unchanged from Phase 707 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 709: Scaffolding-artifact audit (clean)

- [x] **`template.json`** contains the old app name, `web.output: "static"`, and old dependency versions — but it is *not* live code. `docs/superpowers/specs/2026-08-16-v48-cleanup-design.md` explicitly states: "Do not touch `template.json` (it is the original template snapshot, not live code)." Nothing in the repo references it. Left untouched per that documented decision (verified before acting).
- [x] **`constants/` (`oauth.ts`, `theme.ts`)** and **`server/_core/types/`** are small re-export/type modules with no drift.
- [x] **`scripts/`** (`generate-vapid-keys.js`, `load-env.js`, `metro-resolver.js`, `reset-project.js`, `generate_qr.mjs`, `smoke-web.mjs`, `test-db.mjs`) all lint clean and are referenced by `package.json`/CI where expected.
- [x] No code change; tree unchanged from Phase 708 (`tsc 0`, lint 0 errors / 157 warnings, `2615 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 710: Guard the store version lockstep

- [x] **Gap found:** `tests/tauri-version-lockstep.test.ts` keeps root / desktop / `tauri.conf.json` / `Cargo.toml` on the same version, but **`app.config.ts`'s `version` — the value that actually ships to the App Store / Play Store — was unguarded.** A release bump that missed it would silently lag the store build.
- [x] **Fix:** added a case to `tests/store-config.test.ts` asserting `app.config.ts`'s `version` equals `package.json`'s. Proven non-vacuous: bumping `app.config.ts` to `9.9.9` fails the test; restoring `5.16.0` passes.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2616 passed**; desktop `tsc 0`, **285 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 711: CI never built the desktop Vite bundle

- [x] **Gap found:** CI ran `check:desktop` (tsc) and desktop vitest, but never `pnpm build:desktop` (the Vite production build). That is exactly the class of the Phase-634 `__DEV__` `define` boot crash — it compiles and unit-tests clean, then crashes the built app. Nothing in CI would have caught it.
- [x] **Fix:** added `pnpm build:desktop` to the `check` job, and a new `tests/ci-workflow.test.ts` guard asserting the workflow keeps the build/test/smoke steps, the Rust job, and that `playwright install` precedes `smoke:web`. Proven non-vacuous: deleting the `build:desktop` step fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2619 passed**; desktop `tsc 0`, **285 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 712: PWA manifest icon 404

- [x] **Gap found:** `public/manifest.json` declares a 512×512 `/icon.png`, but no such file existed in `public/` (only `manifest.json` + `sw.js`). `expo export` copies `public/` verbatim, so `dist-web/icon.png` 404'd and the PWA installed with no icon. The existing `tests/pwa-precache.test.ts` only asserted the manifest *mentions* `icon.png`, never that the file exists.
- [x] **Fix:** generated `public/icon.png` (512×512, scaled from `assets/images/icon.png`), and strengthened the guard to assert every declared manifest icon exists in `public/` **and** its PNG dimensions match the declared `sizes`. Proven non-vacuous: removing `public/icon.png` fails the guard.
- [x] Verified the icon now lands in `dist-web/` at 512×512. Root `tsc 0`, lint 0 errors / 157 warnings, **2620 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 713: Guard the Tauri bundle icons exist

- [x] **Gap found:** `tauri.conf.json` declares five bundle icons (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`) and all five currently exist — but nothing guarded them. A missing one fails `cargo tauri build` late or ships a blank icon, the same class as the Phase-712 PWA icon 404.
- [x] **Fix:** added a case to `tests/tauri-version-lockstep.test.ts` asserting every declared bundle icon exists on disk. Proven non-vacuous: renaming `icon.ico` fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2621 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 714: Desktop stub/mirror parity audit (clean)

- [x] **`desktop/src/storage.ts`** mirrors exactly the six keys the Rust `is_allowed_storage_key` allowlist accepts (`watchlist_products`, `price_alerts`, `back_order_reminders`, `app_settings`, `back_in_stock_watches`, `fx_rates`), and `tests/desktop-chart-guard.test.ts` guards the parity (a mirrored-but-unwritable key would silently diverge the two stores).
- [x] **`desktop/src/lib/async-storage-stub.ts`** is localStorage-backed (not a throwaway Map) so shared modules share the desktop store; the `react-native`/`expo-secure-store`/`expo-linking` stubs cover the imports shared modules pull in.
- [x] **`desktop/vite.config.ts`** `define` uses `JSON.stringify(mode !== "production")` (not the verbatim `import.meta.env.DEV` that crashed the built app), bridges the `EXPO_PUBLIC_*` vars, and aliases the native-only modules to stubs.
- [x] **`tsconfig.json` includes exist** (`expo-env.d.ts`, `nativewind-env.d.ts`, `.expo/types/router.d.ts`); `tsconfig.node.json` is absent and unreferenced.
- [x] No code change; tree unchanged from Phase 713 (`tsc 0`, lint 0 errors / 157 warnings, `2621 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 715: Test the Android release-signing plugin

- [x] **Gap found:** `plugins/with-android-cleartext-traffic.js` had a thorough behavioral test, but `plugins/with-android-release-signing.js` — the plugin that prevents shipping a debug-signed build the Play Store rejects — had **no test at all**, despite containing a subtle regex fix (a loose pattern had rewritten the *debug* build type).
- [x] **Fix:** added `tests/android-release-signing.test.ts` (5 cases): adds the release signingConfig + points the release build type at it; does **not** rewrite the debug build type; is idempotent; throws on a non-Groovy file; is registered in `app.config.ts`. Proven non-vacuous: reverting to the loose regex fails 2 cases.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2626 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 716: Desktop favicon 404

- [x] **Gap found:** `desktop/index.html` referenced `/vite.svg` (the stock Vite-template favicon), but no such file existed anywhere in `desktop/` — the built app requested a 404 favicon. Same class as the Phase-712 PWA icon.
- [x] **Fix:** shipped `desktop/public/icon.png` (512×512, from the Tauri icon set) and pointed `index.html` at it. Added a guard to `desktop/tests/tauri-capabilities.test.ts` asserting every non-`/src/` asset `index.html` references exists in `public/`. Proven non-vacuous: removing the icon fails the guard.
- [x] Verified the icon lands in `desktop/dist/`. Root `tsc 0`, lint 0 errors / 157 warnings, **2626 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 717: IconSymbol `as never` casts defeated the mapping guard

- [x] **Gap found:** AGENTS.md requires every `<IconSymbol name="...">` to have an Android/web mapping, and `components/ui/icon-symbol.tsx` deliberately does **not** widen its key type so tsc rejects unmapped names. But three call sites cast `name={x as never}` (`EmptyStateView`, `Toast`, the Home `SummaryCard`) with `string`-typed props — defeating the compile-time guard, so a typo would silently render the `help-outline` fallback glyph on Android/web.
- [x] **Fix:** exported `IconSymbolName`, typed those three props/values with it, and removed the casts. Added `tests/icon-symbol-mapping.test.ts` (3 cases): every literal `name=` is mapped; every ternary-result literal in a dynamic `name={...}` is mapped; the mapping is not widened via `as IconMapping`. Proven non-vacuous: a bogus literal in `name=` and a bogus ternary result each fail the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2629 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 718: Unnecessary `as never` casts on domain objects

- [x] **Gap found:** four call sites cast domain objects to `never` for no reason — `addToWatchlist(newProduct as never)` and the `SAMPLE_LISTINGS[...] as unknown as never[]` fallback (trending), `addAlert({...} as unknown as never)` (watchlist import), the `TagPickerSheet` product literal, and `getBestPrice((product.listings ?? []) as never[])` (shared watchlist). Each already satisfied its type, so the cast only removed the checker's ability to catch a future field drift.
- [x] **Fix:** removed all five casts (and the now-unneeded `as never[]`), adding the `DistributorListing` import where needed. `tsc` passes with 0 errors, proving the literals were well-typed. Added `tests/domain-type-casts.test.ts` asserting no `addToWatchlist`/`addAlert`/`getBestPrice` argument is cast to `never`. Proven non-vacuous: reintroducing a cast fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2631 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 719: Unnecessary `as any` casts

- [x] **Gap found:** several `as any` casts were unnecessary and only disabled the checker — `(user as any)?.emailVerified` (account-section; `User` already declares it), `deliveries as any[]` + `(d as any).eventId` (notification evaluate), the three `.set({...} as any)` writes in `server/db.ts`, the `(req|tx as any).error` reads in `idb-adapter.ts`, and the `(c as any).name/value/domain` reads in `browser.ts`'s cookie guard.
- [x] **Fix:** removed all of them; `tsc` passes with 0 errors, proving they were well-typed. Kept the four genuinely load-bearing casts (`window as any` browser globals, the `_core` `Api.getMe` return-type gap, and `Buffer`→`BlobPart` variance). No new guard: the compile-time check is the guard, and it now covers these sites.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2631 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 720: Platform-guard and cast audit (clean)

- [x] **Notifications:** every scheduling/cancel function in `lib/notifications.ts` guards `Platform.OS === "web"` (14 guards); `setupAndroidNotificationChannel` guards `!== "android"` (web included). No unguarded `scheduleNotificationAsync`/`cancelScheduledNotificationAsync`.
- [x] **Background tasks:** `TaskManager.defineTask` runs at module scope (outside any component) per AGENTS.md, and `registerTaskAsync`/`unregisterTaskAsync` guard web.
- [x] **`eslint-disable` comments:** only four, all `react-hooks/exhaustive-deps`, each documented and legitimate (stable `Animated.Value` refs, intentional one-time selection init, a `series`/`displayCurrency`-keyed a11y label).
- [x] **`as any`:** down to four genuinely load-bearing casts (browser globals, the `_core` `Api.getMe` return-type gap, `Buffer`→`BlobPart` variance).
- [x] No code change; tree unchanged from Phase 719 (`tsc 0`, lint 0 errors / 157 warnings, `2631 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 721: `shared/src/currency.ts` getBestPrice diverged from lib/currency.ts

- [x] **Gap found:** `shared/src/currency.ts`'s `getBestPrice` carries the comment "Must match lib/currency.ts", but it omitted the `roundMoney` step, so a cross-currency conversion returned `102.80999999999999` where the live-rate `lib/currency.ts` version returns `102.81`. The shared version is exported and exercised by tests (desktop imports the live-rate one), so the two could silently drift.
- [x] **Fix:** added `roundMoney` to the shared module and applied it in `getBestPrice`, matching `lib/currency.ts` exactly. Added a parity case to `tests/best-price-status.test.ts` asserting the two implementations agree across a set of prices and that the result satisfies the roundMoney invariant. Proven non-vacuous: reverting the shared rounding fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2632 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 722: Duplicated-implementation audit (clean)

- [x] **`lib/fx.ts` ↔ `shared/src/fx.ts`:** intentional layering — the shared module is pure (fetch/TTL/stubs), the lib wrapper adds AsyncStorage persistence + the live overlay. `deterministicJitter` is duplicated verbatim, but both copies are identical and the shared stub is unused in production (low risk; left as-is).
- [x] **`lib/notification-routing.ts` ↔ `desktop/src/lib/notification-routing.ts`:** desktop *imports* the shared `notificationRouteFor` (no duplication) and layers `resolveEventRoute` on top.
- [x] **`lib/device-id.ts` ↔ `desktop/src/lib/device-id.ts`:** intentional platform variants (AsyncStorage vs localStorage) with identical logic.
- [x] **`lib/history-sync.ts` ↔ `desktop/src/lib/history-sync.ts`:** both use the shared `sanitizeHistoryPoints`; the mobile counts only confirmed uploads and desktop counts non-throwing mutations — equivalent, since `uploadServerHistory` returns `true` exactly when `mutate` resolves.
- [x] **`formatPrice`:** single implementation in `shared/src/currency.ts`.
- [x] No code change; tree unchanged from Phase 721 (`tsc 0`, lint 0 errors / 157 warnings, `2632 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 723: Pure-logic module audit (clean)

- [x] **`lib/restock.ts`:** the `lastKnownStatus ?? "back_order"` default can't fire a spurious restock — watches are created with `lastKnownStatus: listing.stockStatus`, so an already-in-stock watch has `prevStatus === "in_stock"`. The watch is consumed only after a confirmed notification, and the injected store/notifier keep desktop and mobile from diverging.
- [x] **`lib/tax.ts` / `lib/best-deal.ts` / `lib/distributor-analysis.ts`:** prototype-key (`hasOwnProperty`) and NaN (`Number.isFinite`) guards are in place; free shipping (0) bypasses conversion; the single-in-stock fallback doesn't fabricate free shipping.
- [x] **`lib/region-filter.ts`, `lib/currency.ts` (`effectiveRates`/`convertPrice`/`roundMoney`), `formatPrice`:** guarded and well-tested (negatives, unknown currency, exponential, NaN/Infinity, round-trip).
- [x] No code change; tree unchanged from Phase 722 (`tsc 0`, lint 0 errors / 157 warnings, `2632 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 724: Same-day price-point selection used string comparison

- [x] **Gap found:** `appendPricePoint` and `mergePriceHistory` chose the newer same-day point with `p.date > existing.date` (string compare). `"…T00:00:00Z" > "…T00:00:00.500Z"` lexically, but the `.500Z` point is chronologically later — so a mixed-format history (a hand-edited backup, a legacy export, or a server row) kept the **older** point. Internal writers all use `toISOString()`, but the Rust import validates structure without normalizing `priceHistory` dates, so the invariant wasn't enforced.
- [x] **Fix:** compare `Date.parse(...)` in both functions. Added a `same-day point selection across ISO formats` case to `tests/price-history-order.test.ts` (both directions, both functions). Proven non-vacuous: reverting to string comparison fails 2 cases.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2634 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 725: Same string-date bug in the server memory history path

- [x] **Gap found:** `server/price-history.ts`'s `mergeHistory` memory fallback used `p.date > current.date` (string compare) — the same bug as Phase 724. The `uploadHistory` zod schema accepts both `…:00Z` and `…:00.500Z`, so a mixed-format payload kept the older same-day point. The DB path already compares the numeric `fetchedAt`; only the memory fallback (no `DATABASE_URL`) was wrong.
- [x] **Fix:** compare `Date.parse(...)`. Added a case to `tests/server-price-history.test.ts`. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2635 passed**; DB suite **8 files / 30 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 726: Date-comparison audit (clean)

- [x] **`lib/alert-state.ts`:** `isAlertActive` parses `snoozedUntil` with `Date.parse` (not string compare) and guards non-finite.
- [x] **`lib/price-digest.ts` (`triggeredAt >= lastDigestAt`), `components/settings/scraper-status-section.tsx` (`lastChecked > existing`):** both operands are internally generated via `toISOString()`, so the lexical comparison equals chronological; only a hand-edited backup could break them (low risk, left as-is).
- [x] **`desktop/src/pages/Stats.tsx` (`pt.date < cutoffStr`):** a `YYYY-MM-DD` day-prefix cutoff compared against a date that starts with the same prefix — lexically correct.
- [x] **`lib/sync.ts` / `server/sync-db.ts` `updatedAt` comparisons:** epoch-millisecond numbers, not strings.
- [x] No code change; tree unchanged from Phase 725 (`tsc 0`, lint 0 errors / 157 warnings, `2635 passed`; DB 8/30; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 727: Sorting/aggregation audit (clean)

- [x] **`lib/watchlist-org.ts`:** every comparator is NaN-safe with a deterministic `id.localeCompare` tie-breaker (`Date.parse(...) || 0`, `Infinity`/`-Infinity` sentinels); `STATUS_ORDER` lists all four `StockStatus` values so `indexOf` never returns `-1`.
- [x] **`lib/watchlist-summary.ts`:** counts all listings, converts only finite positive prices with a known rate, and is explicitly documented as "all listings value" (distinct from the basket value).
- [x] **`lib/price-chart.ts`:** `findNearestIndex` clamps to `[0, count-1]` and handles `count <= 1`; the `.5` tie rounds down consistently.
- [x] **`lib/last-refreshed.ts`:** guards invalid dates and clamps a negative diff to 0.
- [x] No code change; tree unchanged from Phase 726 (`tsc 0`, lint 0 errors / 157 warnings, `2635 passed`; DB 8/30; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 728: Sync-engine audit (clean)

- [x] **LWW/tombstones (`lib/sync.ts`):** pull applies only when `item.updatedAt > local.updatedAt`; tombstones clear local meta; full-resync drops only items with `entry.updatedAt < cutoff && <= oldCursor` (never-synced work preserved); stale tombstones are cleared via a direct delete (not the per-item-merge save).
- [x] **Push batching:** the client batches on `SYNC_PUSH_MAX_ITEMS`/`SYNC_PUSH_MAX_BYTES` using `JSON.stringify(...).length`, and the server measures the same way (`< 100_000` per item, `<= 5_000_000` per batch) — no UTF-16-vs-bytes mismatch.
- [x] **Stamps:** pushed stamps are capped at the cursor (`Math.min(stampedAt, nextCursor)`) so `collectDirty` doesn't re-collect every sync; partial-batch stamps are persisted on a mid-push failure; `stale_write` rejections are not retried (would revert the remote edit), while validation/transient ones are.
- [x] **`serializeItem`:** trims history to fit `SYNC_PUSH_ITEM_MAX_BYTES` (never the local copy) with a defensive `?? []`.
- [x] No code change; tree unchanged from Phase 727 (`tsc 0`, lint 0 errors / 157 warnings, `2635 passed`; DB 8/30; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 729: Digest/quiet-hours audit (clean)

- [x] **`lib/quiet-hours.ts`:** `parseQuietTime` validates `HH:MM` ranges; the `utcOffsetMinutes` math (`(utc - offset) mod 1440`) evaluates the window in the user's local time; `start === end` is treated as "no window"; the wrap-around branch (`cur >= start || cur < end`) is correct. Four test files cover it.
- [x] **`lib/price-digest.ts`:** honours the master `notificationsEnabled` toggle and quiet hours; the weekly branch compares calendar days (DST-safe) and gates on `digestDayOfWeek`; an invalid `lastDigestAt` skips the interval check but still respects the weekly day gate; the snapshot is not advanced when delivery fails.
- [x] **`computeDigest`:** detects a display-currency change (legacy snapshots without the stamp are trusted), and guards a zero/sub-cent baseline.
- [x] No code change; tree unchanged from Phase 728 (`tsc 0`, lint 0 errors / 157 warnings, `2635 passed`; DB 8/30; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 730: Notification dedup audit (clean)

- [x] **Client (`lib/storage/notifications.ts`):** `recordDisplayedEventId` and `recordNotificationEvent` are id-checked and bounded at 200, so the launch pull skips already-seen events without unbounded growth.
- [x] **Client (`lib/notifications.ts` `setupPushEventTracking`):** guards web, records eventIds from received/tapped/last-response listeners, and documents the accepted best-effort gap (background pushes never tapped) with the pull as the correctness guarantee.
- [x] **Server (`server/notifications/build-events.ts`):** `clampDedupKey` keeps keys within `varchar(255)` (an over-long key would throw "Data too long" and abort the whole warmer tick); health keys bucket on **server** time (not the attacker-controlled `createdAt`) and separate `alert`/`recovery`; `dedupKeyFor` prefers the builder-assigned key so a digest isn't re-pushed on re-entering quiet hours.
- [x] No code change; tree unchanged from Phase 729 (`tsc 0`, lint 0 errors / 157 warnings, `2635 passed`; DB 8/30; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 731: CSV import dropped products whose name starts with `#`

- [x] **Gap found:** `isShareDeepLinkLine` skipped *any* `#`-prefixed line as a share header, but the exporter only ever emits `# Share: <url>`. So a legitimate product named `#1 Router` was silently dropped on re-import — a round-trip data-loss bug (`watchlistToDetailedCsv` → `parseWatchlistCsv` returned 0 products).
- [x] **Fix:** match the exact `^#\s*share\s*:` form (plus legacy `//` and `shareUrl,`). Added two cases to `tests/csv-share-header.test.ts` (round-trip a `#`-named product; still skip the emitted header). Proven non-vacuous: reverting to `startsWith("#")` fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2637 passed**; desktop `285`; `cargo test` 71, clippy 0, fmt clean.

## Phase 732: CSV parser audit (clean)

- [x] **`parseBulkImportCsv`:** handles a `#`-prefixed model and surrounding whitespace; caps at `BULK_MAX_ROWS` and reports `truncated` instead of silently dropping rows; clamps currency length and tag count.
- [x] **Headerless detailed/summary parsing:** a first product named `#1 Router` now parses (the Phase-731 fix covers both paths).
- [x] **`escapeCsv`:** neutralizes `= + - @ \t \r` formula injection (guarded by `tests/csv-injection.test.ts`); RFC-4180 tokenizer handles quoted commas/newlines (`tests/csv-quoted-newline.test.ts`).
- [x] No code change; tree unchanged from Phase 731 (`tsc 0`, lint 0 errors / 157 warnings, `2637 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 733: Shared-watchlist audit (clean)

- [x] **Server (`sharedWatchlists.get`):** public endpoint with dual rate limiting (per-IP + per-token), expiry enforcement (deletes the row), `membersOnly` gating (token alone insufficient), a payload cap (`SHARED_WATCHLIST_MAX_ITEMS + 1` to detect truncation), and SQL-level tombstone filtering.
- [x] **`create`:** `randomUUID()` tokens (122-bit entropy) with a duplicate-key retry; 30-day expiry; `isDuplicateKeyError` unwraps the Drizzle error (Phase 594).
- [x] **Client (`lib/watchlist-share.ts`, `app/w/[token].tsx`):** builds the share message/summary; the screen handles join/leave, expiry, and CSV export.
- [x] No code change; tree unchanged from Phase 732 (`tsc 0`, lint 0 errors / 157 warnings, `2637 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 734: Price-source/freshness audit (clean)

- [x] **`lib/price-source.ts`:** server-first with a freshness gate, device-scrape fallback bounded by a 3-slot semaphore, and stale-server-snapshot fallback — the documented sole foreground entry point.
- [x] **`lib/price-freshness.ts`:** rejects non-finite `fetchedAt`; the server stamps `fetchedAt: Date.now()` server-side, so a client cannot inject a far-future value that would make a stale snapshot look fresh.
- [x] No code change; tree unchanged from Phase 733 (`tsc 0`, lint 0 errors / 157 warnings, `2637 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 735: Trending/LLM-discovery audit (clean)

- [x] **`shared/src/trending.ts`:** falls back to `FALLBACK_TRENDING` on non-ok/error/empty; `formatPrice` renders `N/A` for a malformed `estimatedPrice`, so a bad server item degrades gracefully rather than crashing the card.
- [x] **`lib/llm-discovery.ts`:** 15s abort timeout, classified errors (`timeout`/`network`/`server`/`parse`/`byo-auth`), query bounded to `MAX_DISCOVERY_QUERY`, injectable store/header providers, and a distinct BYO-LLM auth token surfaced as "check your API key".
- [x] No code change; tree unchanged from Phase 734 (`tsc 0`, lint 0 errors / 157 warnings, `2637 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 736: Blocked-detection audit (clean)

- [x] **`classifyFetchStatus`:** 403/429 → blocked, other 4xx/5xx → error, marker match → blocked; `BLOCKED_MARKERS` is byte-identical to the Rust `BLOCKED_MARKERS` (guarded by `tests/desktop-scraper-parity.test.ts`). Matching is case-sensitive on both platforms — a deliberate choice (the markers are the exact strings Cloudflare/PerimeterX/DataDome emit), and a miss degrades to "no price found" rather than a false positive.
- [x] **Breaker stores:** `serializeByKey` serializes read-modify-write per storage key across the several breaker stores sharing `distributor_breaker`.
- [x] No code change; tree unchanged from Phase 735 (`tsc 0`, lint 0 errors / 157 warnings, `2637 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 737: Price-drop detection audit (clean)

- [x] **`runPriceCheckCore`:** single-flight (`inFlightPriceCheck`), 25s time budget with carried-through listings (never writes an empty array over a non-empty one), and `refreshListingsWithinBudget` preserves unprocessed listings.
- [x] **Basket alert:** computes in the display currency (matching the sheet's promise), clears the threshold only after a confirmed display, and uses the serialized settings patch.
- [x] **Price alerts:** scoped via `listingsForAlert`; claims the transition with `deactivateAlert` before notifying (so a concurrent runner can't double-fire); re-arms on a failed web display; re-reads alerts to avoid duplicates.
- [x] **`lib/alert-scope.ts`:** `listingsForAlert`/`scopedAlertFor`/`productWideAlert` correctly scope by distributor and skip triggered/inactive alerts.
- [x] No code change; tree unchanged from Phase 736 (`tsc 0`, lint 0 errors / 157 warnings, `2637 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 738: Health probe/alert audit (clean)

- [x] **`detectHealthAlert`/`detectHealthRecovery`:** fire exactly once per edge (require `threshold` consecutive non-working samples preceded by a working one, and vice versa).
- [x] **`checkHealthAlerts`:** deliberately does *not* bail during quiet hours (the working→down edge is detectable for only one run); `scheduleHealthAlert` suppresses the OS notification and the server holds the event.
- [x] **`health-collector`/`testAllDistributors`:** single-flight, concurrency-bounded (3), bounded history (`HISTORY_MAX_SAMPLES`), and the collector merges into existing health rather than replacing.
- [x] No code change; tree unchanged from Phase 737 (`tsc 0`, lint 0 errors / 157 warnings, `2637 passed`; desktop `285`; `cargo test` 71, clippy 0, fmt clean).

## Phase 739: Device scrapes stored implausible prices

- [x] **Gap found:** the server's `setCachedPrice` rejects a price `> 1e7` as implausible (a misparsed barcode/SKU/shipping figure), but the **client device-scrape paths** (`refreshListing`, `scrapePriceOnDevice`) stored any positive finite price. A page whose price element held a 13-digit barcode (`4006381333931`) would show a bogus price and could fire a spurious price-rise alert.
- [x] **Fix:** added `MAX_PLAUSIBLE_PRICE` + `isPlausiblePrice` to `shared/const.ts`, applied it in both device paths, and refactored `server/price-cache.ts` to use the shared helper (one source of truth). Added non-vacuous guards to `tests/refresh-listing.test.ts` and `tests/price-source.test.ts`.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2639 passed**; DB suite **8 files / 30 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 740: Backup listing merge compared lastChecked as strings

- [x] **Gap found:** `lib/backup.ts`'s `mergeProductListings` kept the newer listing with `(listing.lastChecked ?? "") >= (fromBackup.lastChecked ?? "")` — a string compare. `"…T00:00:00Z" >= "…T00:00:00.500Z"` lexically but is chronologically earlier, so a mixed-format backup kept the older listing. The Rust `merge_listings` already parses via `listing_last_checked_ms`, so this was also a parity gap.
- [x] **Fix:** compare `Date.parse(...)`. Added a mixed-format case to `tests/backup.test.ts`. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2640 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 741: Digest alert-window compared triggeredAt as strings

- [x] **Gap found:** `computeDigest` filtered triggered alerts with `a.triggeredAt >= lastDigestAt` (string compare). `"…:00.500Z" >= "…:00Z"` is false lexically though chronologically later, so a mixed-format pair dropped a freshly triggered alert from the digest. `triggeredAt` can arrive via server sync (only `targetPrice` is validated in `sanitizePulledItem`).
- [x] **Fix:** compare `Date.parse(...)`. Added a mixed-format case to `tests/price-digest.test.ts`. Proven non-vacuous: reverting fails the guard.
- [x] **Also:** fixed a flaky assertion in the Phase-739 `refresh-listing` test (it called `listing()` twice, so the two timestamps differed by a millisecond).
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2641 passed**; desktop `286`; `cargo test` 71, clippy 0, fmt clean.

## Phase 742: Analysis/backup module audit (clean)

- [x] **`lib/drop-calendar.ts`:** DST-safe calendar-date arithmetic (`setDate`, not fixed 24h steps); in-stock-only history; one entry per product/distributor/day keeping the largest drop.
- [x] **`lib/price-events.ts`:** sorts by parsed time, guards NaN, and the `index` field indexes the caller's already-sorted array.
- [x] **`lib/alert-savings.ts` / `lib/deal-score.ts` / `lib/product-insights.ts` / `lib/price-average.ts` / `lib/alert-suggestions.ts`:** all filter to in-stock history, guard NaN/non-finite, and use `bestPricePoints` (minimum) where a like-for-like comparison is needed.
- [x] **`lib/settings-privacy.ts` / `lib/backup-files.ts`:** the BYO-LLM key is stripped from outbound settings and never adopted on inbound merge; file export/import handles web and native.
- [x] No code change; tree unchanged from Phase 741 (`tsc 0`, lint 0 errors / 157 warnings, `2641 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 743: Storage context/adapter audit (clean)

- [x] **`lib/storage/context.ts`:** `enqueue` serializes read-modify-write per key and drops writes during a wipe (`clearing`); suppressed changes are buffered and replayed (skipping sync-applied keys); `readList` quarantines corrupt/non-array payloads (capped per key, indexed for wipes) instead of returning `[]` and letting the next write destroy data; observers are isolated so a throwing listener can't reject the caller's write.
- [x] **`lib/storage/idb-adapter.ts`:** distinguishes "IDB unavailable" (fall back) from "operation failed" (surface); waits for the transaction commit on writes so a commit-time abort isn't a silent lost write.
- [x] **`lib/storage/adapter.ts`:** history caps documented.
- [x] No code change; tree unchanged from Phase 742 (`tsc 0`, lint 0 errors / 157 warnings, `2641 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 744: Tag-LWW compared tagsUpdatedAt as strings

- [x] **Gap found:** the tag-LWW merge in `lib/sync.ts` used `(incomingStamp ?? "") >= (existingStamp ?? "")` with the comment "ISO-8601 UTC strings compare lexicographically". But `tagsUpdatedAt` is preserved verbatim from an arbitrary client via sync, so it is not guaranteed canonical — and `"…:00.500Z" >= "…:00Z"` is false lexically though chronologically later, so a newer remote tag edit lost to an older local one.
- [x] **Fix:** compare `Date.parse(...)`. Added a mixed-format case to `tests/sync-tags-lww.test.ts`. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2642 passed**; desktop `286`; `cargo test` 71, clippy 0, fmt clean.

## Phase 745: Exhaustive string-date-comparison sweep (clean)

- [x] Swept every `>=`/`<=`/`>`/`<` involving a date-ish field across `lib/`, `app/`, `components/`, `server/`, `shared/`, `desktop/src`. The remaining comparisons are all numeric (epoch ms, `Date` objects, SQL integer columns) or day-prefix cutoffs:
  - `components/alerts/reminder-card.tsx` compares `Date` objects.
  - `server/notifications/index.ts` (`createdAt < cutoff`) and `server/_core/sdk.ts` (`credentialsChangedAt < userEpoch`) compare epoch numbers.
  - `server/db.ts` token `expiresAt <= now` compares epoch numbers.
  - `server/price-history.ts` / `server/sync-db.ts` use SQL `fetchedAt`/`updatedAtMs` integer columns.
- [x] No code change; tree unchanged from Phase 744 (`tsc 0`, lint 0 errors / 157 warnings, `2642 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 746: Web-notifications/push audit (clean)

- [x] **`lib/web-notifications.ts`:** guards secure-context/Notification support, returns whether a notification was actually shown (so callers don't consume state on a no-op), dedups pushes via the SW `web-push-shown` message, and polls only when authenticated + enabled.
- [x] **`lib/web-push.ts`:** `urlBase64ToUint8Array` correctly decodes a 65-byte P-256 VAPID key (verified); subscribe/unsubscribe are best-effort with the server token pruned on sign-out.
- [x] **`lib/push-token.ts`:** web/non-device/project-id guards, 4s timeout, and `unregisterPushToken` prunes both the web subscription and the server token on sign-out.
- [x] No code change; tree unchanged from Phase 745 (`tsc 0`, lint 0 errors / 157 warnings, `2642 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 747: Seed/manual-add/onboarding audit (clean)

- [x] **`lib/launch-seed.ts`:** idempotent (skips existing ids), only backfills the two MikroTik seeds' listings when missing, per-id error isolation.
- [x] **`lib/manual-add.ts`:** dedupes on the storage return value (not just the stale `trackedIds`), handles the discovery timeout as an empty result, and `rediscoverMissingListings` rotates attempts (`MISSING_LISTINGS_RETRY_MS`) so permanently-unfindable products can't occupy every run's slots.
- [x] **`lib/onboarding.ts` / `lib/recent-searches.ts` / `lib/legal-links.ts`:** `isPublicRoute` handles trailing slash/query/hash and rejects non-public routes (verified); recent searches are deduped case-insensitively and capped; the support email uses `||` so an empty override can't produce a bare `mailto:`.
- [x] No code change; tree unchanged from Phase 746 (`tsc 0`, lint 0 errors / 157 warnings, `2642 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 748: Timing-primitive audit (clean)

- [x] **`lib/with-timeout.ts`:** documents the "null = timeout" contract; uses the background-safe poll loop while backgrounded (a plain `setTimeout` race would freeze) and clears the timer in `finally`.
- [x] **`lib/background-safe-timers.ts`:** the Android timer-freeze behavior is documented; `backgroundSafeDelay`/`backgroundSafeRace` poll via `setImmediate` while backgrounded and self-terminate back to a real timer when the app returns to the foreground; the module stays react-native-import-free (server-bundle purity).
- [x] **`lib/background-fetch.ts`:** XHR with a native `timeout` (enforced by OkHttp, fires while backgrounded); a `settled` guard prevents double-settle.
- [x] No code change; tree unchanged from Phase 747 (`tsc 0`, lint 0 errors / 157 warnings, `2642 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 749: Guard SETTING_DEFAULTS coverage

- [x] **Gap found:** `lib/backup.ts`'s `SETTING_DEFAULTS` must list every defaulted `AppSettings` field — a field missing there is always taken from the backup, silently overwriting the local value with the exporter's default. It currently covers all 11 fields, but nothing guarded the invariant.
- [x] **Fix:** added a `SETTING_DEFAULTS coverage` case to `tests/backup.test.ts` asserting every `DEFAULT_SETTINGS` key appears in `SETTING_DEFAULTS`. Proven non-vacuous: removing a key fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2643 passed**; desktop `286`; `cargo test` 71, clippy 0, fmt clean.

## Phase 750: Auth/device module audit (clean)

- [x] **`lib/auth-refresh.ts`:** validates the `/api/auth/me` shape before use, defaults `loginMethod`, and returns null on any failure.
- [x] **`lib/device-revoked.ts`:** coalesces concurrent revocations (`fired`), clears the session + user info regardless of the logout call's outcome, and resets on the next tick so a later revocation still fires.
- [x] **`lib/devices.ts`:** every call is timeout-bounded and best-effort.
- [x] No code change; tree unchanged from Phase 749 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 751: Server-client wrapper audit (clean)

- [x] **`lib/server-prices.ts`:** the backgrounded path bypasses the tRPC batch loader (whose `setTimeout` dispatch freezes) and hits the HTTP endpoint via the native-timeout `backgroundFetch`; the foreground path races a 4s timeout; `JSON.parse` failures are caught by the outer try/catch (return null).
- [x] **`lib/server-insights.ts` / `lib/server-images.ts` / `lib/server-llm.ts` / `lib/server-notifications.ts`:** all timeout-bounded and best-effort, gated on `isServerConfigured()` where appropriate.
- [x] No code change; tree unchanged from Phase 750 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 752: Share/utility module audit (clean)

- [x] **`lib/price-share.ts`:** `buildShareRows` prefers in-stock converted prices, falls back to the cheapest converted listing, then to a raw-price sort labelled in the listing's own currency (not misleading); `buildShareText` handles the all-out-of-stock case.
- [x] **`lib/share-image.ts` / `lib/csv-export.ts` / `lib/utils.ts` / `lib/sync-gate.ts` / `lib/notification-center-helpers.ts`:** platform-specific capture/export with false-on-failure; the sync-generation token is a monotonic counter bumped on account wipe.
- [x] No code change; tree unchanged from Phase 751 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 753: Concurrency/stats/live-prices audit (clean)

- [x] **`lib/concurrency.ts`:** the semaphore transfers slots directly to waiters (race-free), with an optional bounded queue that sheds load.
- [x] **`lib/watchlist-stats.ts`:** `computeMovers` parses dates, filters to in-stock history, skips unrated-currency points, and uses a deterministic tie-break; `computeBasketValue`/`computeStockHealth`/`computeDataFreshness` are guarded.
- [x] **`lib/live-prices.ts`:** a stale server snapshot merges history but never overwrites the presented price; `deriveConnectionStatus` is a clean precedence chain.
- [x] No code change; tree unchanged from Phase 752 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 754: Alerts/reminders storage audit (clean)

- [x] **`lib/storage/alerts.ts`:** every mutation is an enqueued read-modify-write; `deactivateAlert` is a compare-and-set (only the first runner transitions) with a stale-event guard (`eventAt < createdAt`); `rearmAlert`/`updateAlert` re-stamp `createdAt` so a stale server event can't immediately re-deactivate.
- [x] **`lib/storage/reminders.ts`:** dedups by `(productId, distributorId)` as well as id and returns the replaced `notificationId` so the caller can cancel the orphaned schedule.
- [x] No code change; tree unchanged from Phase 753 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 755: `server-product-parse` leaked its timeout timer

- [x] **Gap found:** `fetchParsedProduct` raced a bare `new Promise((resolve) => setTimeout(...))` without clearing the timer, so a fast response still kept the event loop alive up to the 8s deadline (and the race used a plain `setTimeout`, which freezes while backgrounded). `lib/server-prices.ts` already cleared its timer in `finally`.
- [x] **Fix:** use the shared `withTimeout` (clears its timer on settle; background-safe poll loop). Behavior-preserving; existing tests pass.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2643 passed**; desktop `286`; `cargo test` 71, clippy 0, fmt clean.

## Phase 756: Health/digest-fx/barrel audit (clean)

- [x] **`lib/health.ts`:** 3s abort timeout cleared in `finally`.
- [x] **`lib/storage/digest-fx.ts`:** validates the digest-snapshot shape (a non-array `products` would throw in `computeDigest`'s `.map`) and filters FX rates to finite numbers.
- [x] **`lib/background-price-check.ts`:** a clean re-export barrel.
- [x] **`lib/storage/index.ts`:** the barrel is the only AsyncStorage importer; `tests/server-bundle-purity.test.ts` guards that server-reachable modules import leaf storage modules, not the barrel.
- [x] No code change; tree unchanged from Phase 755 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 757: Scraper-parser conformance audit (clean)

- [x] **All 25 parsers gate on `modelMismatch`** (verified by grep); `tests/scrapers/model-gate-conformance.test.ts` asserts each rejects a `__NO_SUCH_MODEL__` against its real fixture (27 cases pass), and requires a fixture per registered parser.
- [x] **`tests/scrapers/adversarial.test.ts`:** a two-product page (decoy first) must yield the target card's price, never the decoy's; the exception list is explicit and capped at 2.
- [x] **`tests/scraper-card-boundary.test.ts`:** the card boundary beats a shared row container (the Aerial grid-in-one-`<tr>` case).
- [x] Every parser has a per-parser test with a positive path.
- [x] No code change; tree unchanged from Phase 756 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 758: Trending/discovery router audit (clean)

- [x] **`server/routers/trending.ts`:** feed/LLM fetches are timeout-bounded and `readCapped` (a hostile/looping feed can't OOM the process); LLM rows are sanitized to the column limits (name 255, brand/category 100, price decimal(10,2), source 255); `get` uses SQL `LIMIT`/`ORDER BY`. Feed URLs are hardcoded constants (no SSRF surface).
- [x] **`server/routers/discovery.ts`:** rate-limited + spend-budgeted (skipped for user-funded BYO-LLM), query bounded to `MAX_DISCOVERY_QUERY`, LLM output field-bounded, retailer URLs validated (`^https?://`), retailer array capped at 4, and a rejected BYO key mapped to a non-auth status the client shows as "check your API key".
- [x] No code change; tree unchanged from Phase 757 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 759: Server notification digest/evaluate audit (clean)

- [x] **`server/notifications/digest.ts`:** `digestId` hashes the scope to fit the `varchar(128)` id while the readable `dedupKey` fits `varchar(255)`; the digest day bucket uses the client's UTC offset; `shouldHoldScope` requires *every* bound config to opt in (an old client without quiet hours isn't delayed).
- [x] **`server/notifications/evaluate.ts`:** paged device rows (bounded tick), one memoized price lookup per tick, and `isEventBlocking` bounds the delivery-grace wait so a stale binding can't suppress a condition forever.
- [x] No code change; tree unchanged from Phase 758 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 760: Server price/warmer audit (clean)

- [x] **`server/prices.ts`:** global scrape semaphore (bounded queue, slot-release guard so a queue-full rejection can't corrupt the active count), single-flight per (distributor, model), and `runWarmerTick` gives each step its own error boundary (one failing purge no longer starves the rest).
- [x] **`server/catalog-warmer.ts`:** `pickPairsToWarm` ranks by `max(fetchedAt, attemptedAt)` so a pair that never yields a result rotates out instead of monopolizing every tick.
- [x] **`pLimit`:** a synchronous throw doesn't leak the slot or wedge the queue.
- [x] No code change; tree unchanged from Phase 759 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 761: Rate-limit/spend/email/SSRF audit (clean)

- [x] **`server/rate-limit.ts`:** per-bucket windows (a short-window call can't truncate a long-window bucket), LRU eviction capped at `MAX_BUCKETS` on both prune and insert, and `req.ip` (trust-proxy-aware) rather than raw XFF (spoof-resistant).
- [x] **`server/spend-budget.ts`:** rolling-window caps with env overrides; callers degrade rather than error.
- [x] **`server/email.ts`:** Resend HTTP API with a fetch timeout; never logs bodies/tokens; skips + logs when unconfigured.
- [x] **`server/product-parse.ts`:** exhaustive SSRF guard (IPv4, IPv6, IPv4-mapped/compatible, NAT64, 6to4, Teredo, unique-local/link-local/multicast), rejects credentials-in-URL, resolves the hostname and rejects if any address is private (DNS-rebinding), and `readCapped` bounds the body.
- [x] No code change; tree unchanged from Phase 760 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 762: BYO-LLM proxy audit (clean)

- [x] **`server/user-llm.ts`:** fixed provider hosts (no user-supplied URL → no SSRF); `ollama-local` restricted to loopback **and** port 11434 (any port would aim the server's POST at an arbitrary local service); header values bounded; the API key is used per-request and never persisted; `postJson` uses `redirect: "error"` (a 3xx from loopback isn't followed), a 20s deadline covering the body, a 200k response cap, and never echoes the provider body (which can contain the key).
- [x] No code change; tree unchanged from Phase 761 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 763: Server device-management audit (clean)

- [x] **`server/devices.ts`:** `assertDeviceAccess` enforces per-user ownership; label lookup is scoped to the user's own device ids (no full scan); `unrevokeDevice` lifts the user's wildcard on sign-in (proving current credentials); `purgeOldRevokedDevices` drains in batches.
- [x] No code change; tree unchanged from Phase 762 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 764: Server utility-module audit (clean)

- [x] **`server/health.ts`:** stateless (fresh in-memory adapter per call).
- [x] **`server/fx.ts`:** single-flight refresh, stale-while-revalidate, static-rate fallback, and finite/positive rate filtering.
- [x] **`server/concurrency.ts`:** `mapWithConcurrency` preserves input order and bounds in-flight work.
- [x] **`server/db-errors.ts`:** unwraps the Drizzle error chain (`.cause`) for duplicate-key/FK classification.
- [x] **`server/fetch-timeout.ts` / `server/store-keys.ts` / `server/api-cache.ts`:** outbound deadline; case-folded store keys + DECIMAL(12,4) rounding for memory/DB parity; `/api` `no-store`.
- [x] No code change; tree unchanged from Phase 763 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 765: Server insights/images/push/storage audit (clean)

- [x] **`server/price-insights.ts` / `server/product-images.ts`:** single-flight per product (a burst shares one paid call), TTL-cached, budget-gated.
- [x] **`server/web-push.ts`:** `isAllowedPushEndpoint` requires HTTPS and an allowlisted push-service host suffix — push endpoints are attacker-supplied, so without this the VAPID-signed request is an SSRF primitive that leaks the JWT.
- [x] **`server/push-notifications.ts`:** memory/DB parity for token ownership.
- [x] **`server/storage.ts`:** Forge presign with a fetch timeout; key normalization + hash suffix.
- [x] No code change; tree unchanged from Phase 764 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 766: Hooks audit (clean)

- [x] **`use-alert-badge.ts`:** mounted guard, per-read `.catch`, shared `countActiveAlerts` predicate, and refreshes on both focus and storage changes.
- [x] **`use-connection.ts`:** 60s refetch, foreground refetch, `deriveConnectionStatus` precedence.
- [x] **`use-live-prices.ts`:** generation guards on async loads, debounced persist, refs to avoid stale closures, and a fresh read in `refreshAll` (a product added since the last render isn't missed).
- [x] **`use-alerts-data.ts`:** generation guard, storage-change subscription, and reschedule schedules the new notification **before** cancelling the old (keeping the old id when scheduling fails so it stays cancellable) with a double-tap guard.
- [x] No code change; tree unchanged from Phase 765 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 767: use-auth audit (clean)

- [x] **`hooks/use-auth.ts`:** module-level shared snapshot (so every `useAuth()` agrees), device header on every auth request, platform-specific fetch, `logout` retracts the push binding and calls `clearAccountData`, and `changePassword` persists the re-minted session token (credential epoch). `deleteAccount` leaves the local wipe to its caller (`account-section` calls `clearAllData()`), which is correct.
- [x] No code change; tree unchanged from Phase 766 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 768: Components audit (clean)

- [x] **`components/compare/multi-line-chart.tsx`:** converts every point to the display currency, guards empty/flat ranges, sorts by parsed time, and the scrubber picks the globally nearest point.
- [x] **`components/best-distributor-card.tsx`:** converts to the display currency (not hardcoded USD); `isLowestEver` sorts explicitly and filters to in-stock history.
- [x] **`components/watchlist/product-card.tsx`:** converts each listing's history before flattening (no mixed-currency sparkline), memoizes derivations, and uses `Animated` refs.
- [x] No code change; tree unchanged from Phase 767 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 769: LLM settings section audit (clean)

- [x] **`components/settings/llm-settings-section.tsx`:** debounced (500ms) settings updates, the API key is `secureTextEntry` by default with an explicit Show toggle, and the test-connection result distinguishes auth failure from unreachable.
- [x] No code change; tree unchanged from Phase 768 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 770: Login modal audit (clean)

- [x] **`components/settings/login-modal.tsx`:** validates required fields and register password length; the client doesn't trim the email, but the server normalizes (`trim().toLowerCase()`) before lookup, so it's harmless.
- [x] No code change; tree unchanged from Phase 769 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 771: Manual-add sheet audit (clean)

- [x] **`components/search/manual-add-sheet.tsx`:** trims inputs, dedupes on the slug, guards against unmount (`activeRef`) so a late discovery result doesn't set state on an unmounted component, and reports the discovered count.
- [x] No code change; tree unchanged from Phase 770 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 772: Coverage-lens audit (clean)

- [x] Generated coverage and reviewed the lowest-covered non-`_core` modules. The 0%-coverage files are configs (`drizzle/metro/tailwind/theme.config`), Expo Router screens (integration-tested via smoke), and thin wrappers (`lib/legal-links.ts`, `lib/server-llm.ts`, `lib/theme-provider.tsx`) whose empty/failure branches are handled by their callers (`about-section` guards an empty privacy URL; `server-llm` returns null on failure).
- [x] The low-coverage `lib/`/`server/` files are the platform-specific file/notification wrappers (web/native branches) and the DB-backed paths (covered by the DB-gated suite).
- [x] No code change; tree unchanged from Phase 771 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 773: Notifications module audit (clean)

- [x] **`lib/notifications.ts`:** every scheduling function guards web and returns null on failure; `immediateTrigger` works around the Android trigger-channel quirk (channelId must be on the trigger, not `content`); `ensureNotificationPermission` is the cross-platform entry point (web uses the Notification API); `scheduleStockWatchConfirmation` is distinct from the real restock alert.
- [x] No code change; tree unchanged from Phase 772 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 774: Product detail screen audit (clean)

- [x] **`app/product/[id].tsx`:** cancellation signal on the async load, per-read `.catch` (a storage failure doesn't hang the skeleton), the alert-creation guard is claimed *before* the async permission round-trip (double-tap safe), and reminder creation cancels the notification it replaced.
- [x] No code change; tree unchanged from Phase 773 (`tsc 0`, lint 0 errors / 157 warnings, `2643 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 775: CSV round-trip bugs found by fuzzing

- [x] **Gap 1 — formula prefix leaked:** `escapeCsv` prefixes `'` to a value starting with `= + - @ \t \r` (spreadsheet text-marker), but the import paths never stripped it, so exporting `=-` and re-importing produced `'=-`. Added `unescapeCsv` (strips a leading `'` only when followed by a formula char, preserving a genuine apostrophe) and applied it in `parseDetailedCsv`, `parseWatchlistCsv`, and `parseBulkImportCsv`.
- [x] **Gap 2 — bare CR split the row:** `escapeCsv` quoted on `[",\n]` but not `\r`, and the tokenizer treats a bare CR as a row break, so a value containing `\r` (e.g. `1-2_1b\rb`) was re-imported as just `b`. Added `\r` to the quote condition.
- [x] Found by a deterministic property-based fuzzer (50k random names/models through export→import); added 3 non-vacuous guards to `tests/csv-injection.test.ts`. Reverting either fix fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2646 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 776: Property-based fuzzing (sync/analysis invariants)

- [x] Fuzzed `syncNow` with 3000 random pulled payloads (malformed data, unknown collections, tombstones, non-object values): never threw, malformed items dropped safely.
- [x] Fuzzed `mergePriceHistory` (sorted ascending, no duplicate days), `matchesModel` (never throws), `computeMovers`/`computeDropCalendar`/`computeDigest`/`computePriceVsAverage` (finite outputs), `parsePriceFromText`/`convertPrice`/`roundMoney` (finite/null, idempotent), `addRecentSearch` (bounded, deduped), `isPublicRoute` (never throws) — all clean.
- [x] The CSV round-trip fuzzer found the two Phase-775 bugs; the remaining functions held their invariants.
- [x] No code change; tree unchanged from Phase 775 (`tsc 0`, lint 0 errors / 157 warnings, `2646 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 777: Property-based fuzzing (tokenizer/state machines)

- [x] Fuzzed the CSV tokenizer with 100k random byte strings (all 256 chars): never threw.
- [x] Fuzzed the health state machine (200k random sample sequences): `detectHealthAlert` and `detectHealthRecovery` are never both true for the same input.
- [x] Fuzzed `detectPriceEvents` (100k random histories): event `index` always in range and `type` always valid.
- [x] No code change; tree unchanged from Phase 776 (`tsc 0`, lint 0 errors / 157 warnings, `2646 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 778: Property-based fuzzing (storage concurrency/filtering)

- [x] **Concurrency:** 500 trials of N concurrent `addToWatchlist` — every item persisted (no lost updates); 500 trials of concurrent `removeAlert` — none resurrected.
- [x] **Sorting:** 20k trials of `sortWatchlist` across all sort keys — output is deterministic, same length, no duplicates.
- [x] **Filtering/grouping:** 30k trials — `filterWatchlist` never returns more than its input; `groupWatchlist` partitions exactly (union of groups == input).
- [x] **Tag helpers:** 100k trials — `tagColor`/`nextTagColor` always return a palette color; `matchesTagFilterMode` never throws.
- [x] **Storage quarantine:** 2k trials with corrupt/non-array JSON pre-seeded — `getWatchlist` returns an array and a subsequent write is not lost.
- [x] No code change; tree unchanged from Phase 777 (`tsc 0`, lint 0 errors / 157 warnings, `2646 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 779: Property-based fuzzing (analysis/currency)

- [x] 30k trials across `computeBasketValue` (finite total, counts partition), `computeStockHealth` (0–100%), `computeDataFreshness` (finite avg), `buildShareRows` (≤5 rows, finite prices), `findBestDeal`, `getTaxRate`, `analyzeDistributors`, `computePriceChange`, `getBestPrice` (finite), `formatPrice` — all invariants held, no throws.
- [x] No code change; tree unchanged from Phase 778 (`tsc 0`, lint 0 errors / 157 warnings, `2646 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 780: Property-based fuzzing (security parsers/validators)

- [x] 200k random `parseOAuthCallbackParams` inputs — never throws, action always one of redeem/failed/redirect.
- [x] 50k `sanitizeHistoryPoints` inputs (bad dates/prices/currencies) — output ≤ cap, all finite non-negative prices.
- [x] 100k `sanitizeTrendingRows` inputs — every field within its column limit, price finite and in `[0, 99999999.99]`.
- [x] 200k random strings through `isBlockedUrl`/`isAllowedPushEndpoint`/`resolveOllamaLocalUrl`/`isInQuietHours` — never throws.
- [x] Explicit security invariants: all private/loopback/metadata/IPv4-mapped URLs blocked; public URLs allowed; push allowlist rejects `http://`, `evil.com`, and suffix-confusion (`googleapis.com.evil.com`); accepts real FCM/APNs/Mozilla endpoints.
- [x] No code change; tree unchanged from Phase 779 (`tsc 0`, lint 0 errors / 157 warnings, `2646 passed`; desktop `286`; `cargo test` 71, clippy 0, fmt clean).

## Phase 781: `sanitizeHistoryPoints` kept the OLDEST points on unsorted input

- [x] **Gap found:** `sanitizeHistoryPoints` trimmed with `valid.slice(-MAX_UPLOAD_HISTORY_POINTS)`, assuming the input was chronologically ascending. A history restored from a backup or a server pull is not guaranteed ordered, so a descending array kept the **oldest** 200 points instead of the newest (verified: 600 descending points → the newest was dropped, the oldest kept). The doc comment even asserted the order assumption.
- [x] **Fix:** sort by parsed time before trimming. Two existing tests had encoded the buggy positional behavior (root: built a descending array; desktop: cycled the day-of-month so positional ≠ chronological) — corrected both to use genuinely ascending dates, and added an explicit unsorted-input guard to `tests/history-upload-sanitize.test.ts`. Proven non-vacuous: reverting the sort fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2647 passed**; DB suite **30 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 782: Storage history cap kept the OLDEST points on unsorted input

- [x] **Gap found:** the same ordering bug as Phase 781, in `lib/storage/watchlist.ts`'s `trimHistory`. Its `slice(-MAX_HISTORY_PER_LISTING)` cap and its `shift()` eviction loop both assume oldest-first, but a history restored from a backup or a server pull is adopted verbatim and may be descending — so the cap kept the **oldest** 500 points and the eviction loop dropped the **newest**. Verified: 600 descending points → newest dropped, oldest kept.
- [x] **Fix:** sort each history by parsed time before trimming (skipping the sort when already ascending, to avoid needless array copies). Added a non-vacuous guard to `tests/storage-old-payloads.test.ts`. The Rust side doesn't cap history, so no parity change.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2648 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 783: Health-event upload kept the OLDEST events

- [x] **Gap found:** the pending-health-event buffer caps at `MAX_UPLOAD_HEALTH_EVENTS` keeping the **newest** (`slice(pending.length - N)`), but the upload in `syncServerNotifications` used `slice(0, MAX_UPLOAD_HEALTH_EVENTS)` — the **oldest**. A legacy store holding an over-cap array would upload stale events and drop the recent ones. Desktop had the same `slice(0, N)`.
- [x] **Fix:** use `slice(-MAX_UPLOAD_HEALTH_EVENTS)` in both mobile and desktop. Added a non-vacuous guard to `tests/server-notifications.test.ts`. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2649 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 784: Sync byte-cap fallback kept the OLDEST points

- [x] **Gap found:** the third instance of the ordering bug. `serializeItem`'s byte-cap fallback trims pushed history with `withinWindow.slice(-maxPointsPerListing)`, assuming ascending order — but a history restored from a backup or a server pull reaches the sync path unsorted, so the trim sent the **oldest** points (verified: a descending 700-point history trimmed to 20 sent the oldest 20).
- [x] **Fix:** sort `withinWindow` by parsed time before the fallback. Added a non-vacuous guard to `tests/sync-push-batching.test.ts` that seeds the raw store directly (bypassing the write-path sort from Phase 782). Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2650 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 785: refresh-listing history upload kept the OLDEST points

- [x] **Gap found:** the fourth instance of the ordering bug. `refreshListing`'s best-effort history upload trims `localHistory.slice(-MAX_UPLOAD_HISTORY_POINTS)` assuming ascending order — a descending history (from a backup/restore) uploaded the **oldest** 200 points. `uploadServerHistory` does not sanitize, so the trim is what the server receives.
- [x] **Fix:** sort by parsed time before trimming. Added a non-vacuous guard to `tests/refresh-listing.test.ts`. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2651 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 786: Health history read unsorted

- [x] **Gap found:** `getHealthHistory` returned stored samples in stored order, but `detectHealthAlert`/`detectHealthRecovery` and the timeline read positionally (`slice(-threshold)`, `samples[length-1]`). `recordSample` sorts on write, so this is only reachable via a hand-edited/legacy payload — but the read boundary is the right place to enforce it.
- [x] **Fix:** sort each distributor's samples by parsed time on read. Added a non-vacuous guard to `tests/price-check.test.ts`. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2652 passed**; desktop `tsc 0`, **286 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 787: Desktop watchlist trend read history positionally

- [x] **Gap found:** `desktop/src/pages/Watchlist.tsx`'s `getTrend` read `history[history.length - 1]` (newest) and `history[length - 3]` (older) positionally without sorting. A history restored from a backup or a server pull can be newest-first, so a **dropping** price was reported as **"up"** (verified: `[50, 75, 100]` descending → "up" instead of "down"). Mobile has no equivalent function, so this was desktop-only.
- [x] **Fix:** sort by parsed time before reading; exported `getTrend` and added `desktop/tests/watchlist-trend.test.ts` (ascending/descending/reversed all agree). Proven non-vacuous: reverting fails 2 cases.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2652 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 788: Positional-history-read sweep (clean)

- [x] Swept every `history[0]`/`history[length-1]`/`sorted[0]` read on a history-like array. All remaining sites sort first:
  - `lib/price-change.ts` uses `bestPricePoints` (sorts by time).
  - `server/price-insights.ts` reads `getHistory` (sorts by date).
  - `desktop/src/pages/Compare.tsx` (both sites) and `app/compare/[id].tsx` sort explicitly.
  - `desktop/src/pages/ProductDetail.tsx` sorts explicitly.
  - `desktop/src/pages/Home.tsx` / `app/(tabs)/index.tsx` sort listings by status order.
  - `lib/scrapers/health.ts` `timelineSegments` receives already-sorted samples.
- [x] No code change; tree unchanged from Phase 787 (`tsc 0`, lint 0 errors / 157 warnings, `2652 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 789: Trend/sparkline positional-read audit (clean)

- [x] **`components/price-sparkline.tsx`:** sorts by parsed time before reading `first`/`last`.
- [x] **`lib/scrapers/health.ts` `computeHealthStats`:** its `slice(half)`/`slice(0, half)` trend split relies on ascending order, which `getHealthHistory` now guarantees (Phase 786); both `HealthDetail` screens read through it.
- [x] **`desktop/src/pages/Compare.tsx`, `app/compare/[id].tsx`, `desktop/src/pages/ProductDetail.tsx`, `components/best-distributor-card.tsx`, `lib/price-change.ts`:** all sort before comparing first/last.
- [x] No code change; tree unchanged from Phase 787 (`tsc 0`, lint 0 errors / 157 warnings, `2652 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 790: Silent-error-swallowing audit (clean)

- [x] Reviewed all 514 `catch` blocks in `lib/`, `server/`, `shared/`, `desktop/src/`. The ones returning a default (`[]`/`{}`/`null`/`false`) are all deliberate best-effort paths (network probes, notification scheduling, image/share capture, FX rates, discovery).
- [x] Critical paths distinguish correctly: `parseBackup` → `null` is the documented contract; `itemBytes` → `Infinity` fails safe (forces a trim); the token-consume paths (Phase 594) only fall back to memory when the DB row is **absent** (a used/expired row stays rejected); `registerSecurityHeaders` ignores a malformed API base (client falls back to same-origin).
- [x] Storage `enqueue` drops writes only during a wipe (their data is being removed anyway) and isolates throwing observers.
- [x] No code change; tree unchanged from Phase 789 (`tsc 0`, lint 0 errors / 157 warnings, `2652 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 791: Unbounded-growth audit (clean)

- [x] Reviewed every module-level `Map`/`Set` and long-lived cache. All are bounded or purged:
  - `server/rate-limit.ts` buckets: LRU-capped at 10k.
  - `server/notifications/memory-store.ts`: `memoryEvents`/`memoryDeliveries` purged by `purgeOldNotificationEvents`; `digestBuffers` cleared on unbind and consumed on flush.
  - `server/db.ts` `memTokens`/`memVerifyTokens`: purged by `purgeExpiredAuthTokens`.
  - `server/_core/oauth.ts` `usedStateNonces`/`oauthTickets`: `pruneExpiring`/`pruneTickets` (time + 1000 cap).
  - `lib/scrapers/browser.ts` pool: capped at 3.
  - `server/prices.ts` `catalogWarmAttempts`/`imageGenerationAttempts`: bounded by the fixed catalog size.
  - `lib/scrapers/resilient.ts` `inFlight`/`breakerQueues`: deleted on settle.
- [x] No code change; tree unchanged from Phase 790 (`tsc 0`, lint 0 errors / 157 warnings, `2652 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 792: Async-UI-state race audit (clean)

- [x] Reviewed the async `useEffect` loads across `app/` and `components/`. The screens use the right guards:
  - `app/(tabs)/rates.tsx`: generation counter (`loadGenRef`).
  - `app/product/[id].tsx`, `app/health/[id].tsx`, `app/w/[token].tsx`, `app/search.tsx`: cancellation signal / `active` flag.
  - `app/(tabs)/settings.tsx`: `cancelled` flag.
  - `app/compare/[id].tsx`: `selectionInitialized`/`lastAppliedDistributor` refs + latching.
  - `app/health.tsx`: `isMountedRef` for the interactive path; the one-shot mount load is benign (runs once, ref starts true).
- [x] No code change; tree unchanged from Phase 791 (`tsc 0`, lint 0 errors / 157 warnings, `2652 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 793: Re-discovering a product created a duplicate watchlist entry

- [x] **Gap found:** the server mints a fresh `discovered-<timestamp>` id on every discovery, and `addDiscoveredProduct` deduped the *stored catalog* by brand|model (keeping the original id) — but returned `void`, so `discoverProduct` returned the **fresh** time-based id. The search screen then called `addToWatchlist`, which dedups by **id**, so re-discovering the same product added a **second watchlist entry** (verified: 2 entries for one product). Affected mobile and desktop (both add `res.product`).
- [x] **Fix:** `addDiscoveredProduct` now returns the canonical stored product (existing id when deduped); `discoverProduct` returns that. Added a non-vacuous guard to `tests/discovery-storage.test.ts` and updated the `llm-discovery` mock to return the product. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2653 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 794: CSV-import identity audit (not reachable)

- [x] Investigated whether the CSV import path has the same duplicate bug as Phase 793: `detailedCsvToProducts`/`parseWatchlistCsv` build `id: r.model` (raw, e.g. `CRS326-24G-2S+RM`) while the catalog uses `mikrotik-<slug>`, so importing an already-tracked catalog product *would* create a duplicate.
- [x] **Not reachable:** `parseWatchlistCsv`/`detailedCsvToProducts` are used only by tests — the live import path is the JSON backup (`parseBackup` + `applyBackup`, which merges by id and preserves the existing product) and the bulk import (`parseBulkImportCsv` → catalog lookup by `modelNumber`). No production caller builds a watchlist product from CSV.
- [x] No code change; tree unchanged from Phase 793 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 795: Time-based-id collision/dedup audit (clean)

- [x] Reviewed every `Date.now()`-derived id. All are either collision-safe or dedup by a stable key:
  - `newEventId` (server) / `generateTagId` / `generateId` (device): prefer `crypto.randomUUID()`, with a random-suffixed fallback.
  - `local-price-<alertId>-<ts>` / `local-restock-<watchId>-<ts>`: unique per fire; `recordNotificationEvent` dedups by id and caps at 200.
  - Health events: the client id is unique per fire, but the server dedups by its own bucketed `health:<dist>:<status>:<kind>:<bucket>` key; the alert/recovery edge detection fires once per transition.
  - `discovered-<ts>` / `retailer-<ts>-<i>`: now canonicalized by `addDiscoveredProduct` (Phase 793).
  - Quarantine keys (`<key>.corrupt-<ts>`): intentionally unique per quarantine.
- [x] No code change; tree unchanged from Phase 794 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 796: Unit/precision-mismatch audit (clean)

- [x] Reviewed time conversions (`ms`/`s`/`min`/`hour`/`day`), percent-vs-fraction, and currency minor units:
  - `formatRelativeTime`/`formatLastSeen`/`formatLastRefreshed`/`formatSyncStatus`: consistent `Math.floor(diff / 60000)` → minutes → hours → days.
  - Tax rates are **fractions** (`0.1` = 10%) everywhere: `getTaxRate`, `findBestDeal` (`price * taxRate`), `analyzeDistributors`, and both listing cards. All 25 parsers use the shared `getTaxRate`.
  - `parsePriceFromText` handles both separator styles and rejects malformed runs (fails closed, matching Rust).
  - `computePriceChange`/`computeDigest`/`computeMovers` all use `(new - old) / old * 100` with a zero-baseline guard.
- [x] Desktop reads `taxRate` from the server snapshot (`{ ...result }` spreads the parser's value); the Rust parsers don't emit one, but desktop uses server prices, so no parity gap.
- [x] No code change; tree unchanged from Phase 795 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 797: Desktop pages audit (clean)

- [x] **`Alerts.tsx`:** per-load error state, `Promise.all` loads, optimistic-free mutations with try/catch + toast, reschedule validates the date is today-or-future, edit validates the price.
- [x] **`Stats.tsx`:** basket-alert save is an optimistic update with revert on failure; serialized `updateSettings` (no stale whole-object clobber); `pathname` in the load deps.
- [x] **`Home.tsx`:** `recentActivity` guards invalid dates (`isNaN` → 0) and picks the most-recently-checked listing.
- [x] **`ProductDetail.tsx`:** alert creation gates on notification permission, guards double-submit, returns the alert so the screen state stays in sync, and swallows storage failures into `{ ok: false }`.
- [x] No code change; tree unchanged from Phase 796 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 798: Desktop Settings audit (clean)

- [x] **Poller lifecycle:** stops before starting (the unawaited start-then-stop race left no poller); reverts to Manual on a start failure.
- [x] **LLM key drafts:** debounced (500ms) `update`, guarded against re-saving the unchanged value; the key is never logged.
- [x] **Sync status:** shared `formatSyncStatus` (surfaces `lastSyncError`); 30s refresh interval cleared on unmount.
- [x] **Delete account:** requires typing the account email, deletes server-side, then logs out and wipes local data; `deleting` guard prevents double-submit.
- [x] **Test notification:** exercises the real Tauri-native path (the old handler called the web-only no-op).
- [x] No code change; tree unchanged from Phase 797 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 799: Root layout orchestration audit (clean)

- [x] **Notification routing:** bounded dedup map (TTL 10s, cap 100), defers navigation until the `Stack` has mounted (gated on `onboardingState === "app"`), flushes a buffered route on a tick.
- [x] **Launch setup:** `setupAndroidNotificationChannel().then(...)` chain with a final `.catch` so a storage failure can't skip task registration / price check / push registration; each async step has its own catch.
- [x] **Sync:** `isAuthenticatedRef` avoids stale closures; retries a failed sync on foreground (1s throttle); resets device-revoked on sign-in.
- [x] **Seeding:** `seedWatchlistProducts` runs once on mount with a catch.
- [x] **Background timers:** `setBackgroundAppState` wired to Android `AppState` (the timer-freeze workaround).
- [x] No code change; tree unchanged from Phase 798 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 800: Rust backend command-surface audit (clean)

- [x] **`set_value_for_key`:** allowlists the key (an absolute/`../` key would escape the data dir); `open_external`/`open_system_browser` restrict the scheme (http/https/mailto) and use arg-array spawning (no shell injection; Windows quoting for `cmd`).
- [x] **`start_oauth`:** loopback listener that ignores stray connections, bounds the read (5s) and the whole flow (120s), accepts only `/callback` with a single-use server ticket (never a raw session token).
- [x] **`import_watchlist`:** 10MB cap, version + schema validation, strips the device-local LLM key, atomic stage-all-then-rename write.
- [x] **Poller:** zero-interval guard, generation counter, single-flight `PRICE_CHECK_LOCK`, semaphore-bounded (3) scrapes, server-first with local fallback, stale-snapshot rejection.
- [x] **`spawn_and_reap`:** reaps opener children on a detached thread (no zombies).
- [x] No code change; tree unchanged from Phase 799 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 801: Rust price-check/tray audit (clean)

- [x] **`check_price_drops_inner`:** gates on `notificationsEnabled` + `priceAlerts` (quiet hours deliberately do NOT gate price alerts, matching mobile); parses timestamps rather than string-comparing; scopes per-distributor alerts; only in-stock listings anchor; converts with the live overlay; boundary semantics match mobile exactly (`>=` rise, `<=` drop).
- [x] **`update_tray_badge`:** excludes snoozed alerts, excludes `back_in_stock` from the reminder count (they live in their own file and are counted separately), matching the in-app badge.
- [x] No code change; tree unchanged from Phase 800 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 802: Test-quality audit (clean)

- [x] No assertion-free test files; no `expect(true).toBe(true)`-style tautologies; no test mocks the module under test (self-mock scan: 0).
- [x] The 13 files whose only assertions are `toHaveBeenCalled*` are legitimate — `toHaveBeenCalledWith` verifies the exact arguments (e.g. `product-parse-ssrf.test.ts` asserts the SSRF guard returns null **and** that `fetch` was never called).
- [x] All `describe.skipIf` skips are DB-gated (`runDbTests`), not silently disabled.
- [x] No code change; tree unchanged from Phase 801 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 803: Schema/constraint audit (clean)

- [x] **Composite PKs** on the sync tables (`userId`+`productId`/`alertId`/`reminderId`) and `price_cache`/`price_history`; targeted indexes with rationale comments (`idx_price_cache_fetched`, `idx_price_history_date`, `idx_*_user_updated`/`_deleted`).
- [x] **`notification_events`:** `id` PK + two unique dedup indexes (`user`+`dedupKey`, `device`+`dedupKey`); the insert path also dedups in-batch (`seen` set) and catches `isDuplicateKeyError`, so a NULL `userId`/`deviceId` (which MySQL treats as distinct) can't cause a duplicate.
- [x] **`price_history`:** `date` (varchar(10)) is part of the PK and separately indexed for the purge `DELETE ... WHERE date < ?`.
- [x] All FKs cascade on user delete.
- [x] No code change; tree unchanged from Phase 802 (`tsc 0`, lint 0 errors / 157 warnings, `2653 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 804: Mutation-testing pass — 3 coverage gaps closed

- [x] Ran a mutation harness (apply a source mutation, run the relevant test file, check it fails). Three mutations **survived** — real coverage gaps:
  - `lib/price-change.ts`: the 0.5% noise floor was untested (no case near the boundary).
  - `lib/best-deal.ts`: the `price <= 0` guard was only tested with `0`, not a negative price.
  - `lib/relative-time.ts`: the 60-minute boundary was untested (only 5m and 3h).
- [x] Added boundary cases to `tests/price-change.test.ts`, `tests/best-deal.test.ts`, `tests/relative-time.test.ts`; each mutation now fails the suite (verified by re-running the harness).
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2654 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 805: Mutation pass — alert-suggestion rounding gap

- [x] A second mutation batch found `lib/alert-suggestions.ts`'s `round2` untested: every test value was already 2-decimal, so `Math.round` → `Math.floor` survived.
- [x] Added a case using `0.03 * 0.95 = 0.0285` (rounds to 0.03, floors to 0.02); the mutation now fails the suite.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2655 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 806: Mutation pass — digest zero-baseline gap

- [x] A third mutation batch found `lib/price-digest.ts`'s zero-baseline guard (`from > 0`) untested: changing it to `from >= 0` survived, because no test used a `bestPrice` of 0 (a sub-cent price rounds to 0, and `(to - from) / from` would be `Infinity` → "+Infinity%").
- [x] Added a case with `previous.bestPrice = 0`; the mutation now fails the suite. The critical alert guards (`deactivateAlert` stale-event + compare-and-set) were all killed — well-tested.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2656 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 807: Mutation pass — isPlausiblePrice boundary gap

- [x] A fourth mutation batch found `shared/const.ts`'s `isPlausiblePrice` had **no direct test**: both `price <= MAX_PLAUSIBLE_PRICE` → `<` and `price > 0` → `>= 0` survived (the price-cache test only used `5e9` and `-5`, far from the boundary). The helper is shared by the server cache and the client device-scrape paths.
- [x] Added `tests/plausible-price.test.ts` (boundary + zero/negative/non-finite/over-cap); both mutations now fail. The health-dedup `kind`/bucket mutations were killed — well-tested.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2658 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 808: Mutation pass — relative-time 7d + best-deal tie gaps

- [x] A fifth mutation batch found two more gaps:
  - `lib/relative-time.ts`: the 7-day boundary (`days < 7` → `< 30`) survived — no test used 6d/7d.
  - `lib/best-deal.ts`: the strict `total < best.total` tie-break survived — no test had two listings with an identical landed cost.
- [x] Added a 6d/7d case to `tests/relative-time.test.ts` and a tie case to `tests/best-deal.test.ts` using two distributors that share Asia-Pacific shipping (`balticnetworks-us`/`rocnoc-us`). Both mutations now fail. (`price-chart` `count <= 1` → `<= 0` is behaviorally equivalent — both return 0 — so no test needed.)
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2659 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 809: Mutation pass — drop-calendar boundary + price-average rounding

- [x] A sixth mutation batch found two more gaps:
  - `lib/drop-calendar.ts`: the `for (let i = days - 1; i >= 0; i--)` bound (`>= 0` → `> 0`) survived — the DST test checked length/uniqueness but not that the grid ends on **today**. Added assertions for the first and last key.
  - `lib/price-average.ts`: `Math.round(... * 1000) / 10` → `Math.floor` survived (the existing `toBeCloseTo(-5.3, 0)` was too loose). Added a case (avg 3, current 2 → -33.3, floor would give -33.4) and tightened the exact value.
- [x] Both mutations now fail. (`price-change` `pct < 0` → `<= 0` is behaviorally equivalent — pct 0 is suppressed by the 0.5% floor — so no test needed.)
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2660 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 810: Mutation pass — savingAlerts zero-delta gap

- [x] A seventh mutation batch found `lib/alert-savings.ts`'s `savingAlerts` delta guard (`> 0` → `>= 0`) survived: no test used an alert triggered **exactly** at target (zero saving). Added an `exact` case; the mutation now fails.
- [x] Confirmed the rise-exclusion and `computeTotalSaved` sign mutations are killed — well-tested.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2660 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 811: Desktop secondary-pages audit (clean)

- [x] **`OAuthCallback.tsx`:** cancellation flag, ticket-only redemption (never a raw token), validates the returned user (`id` finite + `openId` present) before persisting.
- [x] **`ResetPassword.tsx`:** token presence, both fields, min length, match; guards an unconfigured base URL; a11y (`aria-invalid`/`aria-describedby`/`role="alert"`).
- [x] **`RestockWatches.tsx`:** per-load error state, named confirm, optimistic removal with a friendly toast on failure.
- [x] **`HealthDetail.tsx`:** generation guard on the async load.
- [x] **`Compare.tsx`:** `ResizeObserver` cleanup, hooks run unconditionally (documented), currency-convertible-only cheapest, sorted series.
- [x] No code change; tree unchanged from Phase 810 (`tsc 0`, lint 0 errors / 157 warnings, `2660 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 812: Listener/timer-cleanup audit (clean)

- [x] Every `addEventListener`/`addListener`/`setInterval` in `app/`, `components/`, `hooks/` is paired with a cleanup in the effect return (`watchlist`, `_layout`, `about-section`, `use-connection`, `settings`, `use-device-management`).
- [x] `components/search/product-image.tsx`: the concurrency-limited image queue releases its slot even when the component unmounts before the idle callback fires (`run` checks `active` and calls `dequeueImageFetchOnComplete`); a queued-but-unstarted task is spliced out.
- [x] Debounce timers (`llm-settings-section`, tag sheets, `toast`, `use-live-prices`) clear in their effect cleanup; `undoTimer` is cleared on each new undo.
- [x] No code change; tree unchanged from Phase 811 (`tsc 0`, lint 0 errors / 157 warnings, `2660 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 813: Mutation pass — snooze boundary gap

- [x] An eighth mutation batch found `lib/alert-state.ts`'s snooze guard (`until > now` → `>= now`) survived: no test used a `snoozedUntil` exactly equal to `now`. Added that case; the mutation now fails.
- [x] Confirmed `server/db-errors.ts` (dup-entry code), `server/store-keys.ts` (case fold), `server/rate-limit.ts` (`>= limit`), `lib/price-freshness.ts` (`< TTL`), and the history cap are all killed — well-tested.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2661 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 814: Mutation pass — no new gaps (runtime mutations all killed)

- [x] A ninth batch targeted `lib/price-digest.ts`, `lib/watchlist-stats.ts`, `lib/price-events.ts`, `lib/price-share.ts`, `lib/notification-routing.ts`, `lib/restock.ts`. The runtime mutations (stats pct, event type) were all **killed**.
- [x] Three apparent survivors were **type-annotation-only** mutations (e.g. `const x: DigestResult["alertTargetsHit"] = ...` → a different key type) — stripped at runtime, so they have no behavioral effect and are not real gaps.
- [x] No code change; tree unchanged from Phase 813 (`tsc 0`, lint 0 errors / 157 warnings, `2661 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 815: Pluralization + hook-dependency audit (clean)

- [x] **Pluralization:** every `N item${n === 1 ? "" : "s"}` site uses the same count for the number and the suffix (mobile + desktop). The desktop `Watchlist` "· N tags" fallback shows the raw tag count only when no definitions resolve — a deliberate loading-state fallback (definitions load from settings), not a miscount.
- [x] **Hook dependencies:** a scanner over every `useMemo`/`useCallback` in `app/`, `components/`, `desktop/src/pages/` found no stale-closure reads of `displayCurrency`/`tagDefinitions`/`shippingRegion`/`regionFilter` (the earlier hits were `setDisplayCurrency` setters — false positives).
- [x] No code change; tree unchanged from Phase 814 (`tsc 0`, lint 0 errors / 157 warnings, `2661 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 816: Browser click-through verification (clean)

- [x] Built the web export and drove it with Playwright (pre-seeding onboarding + a watchlist so screens render real content). Visited 15 routes — all 9 tabs/screens (`/`, `/watchlist`, `/alerts`, `/rates`, `/settings`, `/stats`, `/health`, `/search`, `/privacy`) plus deep links (`/product/[id]`, `/compare/[id]`, `/health/[id]`, `/distributor-analysis`, `/restock-watches`, `/w/[token]`).
- [x] **Zero JS errors** on every route (the only console errors were the expected `ERR_FAILED` from offline API calls, filtered out). Interactive tab navigation and product-detail navigation also produced no errors.
- [x] Error states render correctly (`/w/nonexistent-token` → "Share not found"; `/health/[id]` with no samples → "No data").
- [x] No code change; tree unchanged from Phase 815 (`tsc 0`, lint 0 errors / 157 warnings, `2661 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 817: Live HTTP end-to-end against the real server + MySQL (clean)

- [x] Built the production server bundle, migrated a fresh `psf_e2e` database, started the real server, and exercised the live HTTP API. **16/16 checks passed:**
  - `GET /api/health` 200; `/api` is `no-store`; security headers present.
  - Register → session cookie; login; `GET /api/auth/me` returns the right user; wrong password rejected.
  - `sync.push` then `sync.pull` returns the pushed item; unauthenticated `sync.pull` rejected.
  - `fx.get` 200; `sharedWatchlists.create` returns a token; public `sharedWatchlists.get` 200.
  - Unknown `/api` route 404; CORS does not reflect an arbitrary origin.
- [x] No code change; tree unchanged from Phase 816 (`tsc 0`, lint 0 errors / 157 warnings, `2661 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 818: Sync-convergence verification (clean)

- [x] Built an in-memory two-client convergence harness (shared LWW server model) to probe add/edit/delete convergence. The harness was **unfaithful** — its fake server clock and the client's skew-corrected stamping (`Date.now() + (lastSyncedAt - okAt)`) interact in a way the real server does not, producing flaky results across runs.
- [x] The **authoritative** check is the DB-gated `tests/sync-e2e.test.ts`, which runs two devices against the real tRPC server + MySQL. All 6 tests pass, including "propagates a deletion as a tombstone and does not resurrect it", "pages a large change set without dropping items", and "returns the complete state on a full resync".
- [x] Confirmed the production removal path tombstones correctly: a focused probe showed `removeFromWatchlist` → `onChange` → `markDirty` sets `deleted: true` in sync meta (the harness had raced the async `markDirty`).
- [x] No code change; tree unchanged from Phase 817 (`tsc 0`, lint 0 errors / 157 warnings, `2661 passed`; DB 8/30; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 819: Mutation pass — 4 compare-utils gaps closed

- [x] A tenth mutation batch on `shared/src/compare-utils.ts` (the cross-platform chart/region core) found **four** surviving mutations:
  - `filterByRange` anchor (`min(now, max)` → `max`): no test used a future-dated (clock-skewed) point.
  - `cheapestByRegion` tie-break (`<` → `<=`): no test had two same-region listings at an equal converted price.
  - Back-order fallback (`if (!merged.has(region))` removed): no test asserted a back-order listing is used when a region has nothing in stock.
  - Orderable-status guard (`!== in_stock && !== back_order` → `!== in_stock`): the regression test only asserted `unknown` is excluded, never that `back_order` **is** included.
- [x] Added guards to `tests/compare-utils.test.ts` and `tests/distribute-pricing-regression.test.ts`; all four mutations now fail.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2664 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 820: Mutation pass — roundMoney scale gap

- [x] An eleventh mutation batch found `shared/src/currency.ts`'s `roundMoney` had no direct test: `* 100 / 100` → `* 1000 / 1000` survived (the only callers are the two `getBestPrice` implementations, whose tests use already-2-decimal values). Added a direct test (1.2345 → 1.23, 102.80999999999999 → 102.81); the mutation now fails.
- [x] Confirmed `shared/src/fx.ts` TTL and `server/notifications/build-events.ts` dedup-key clamp are killed — well-tested.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2665 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 821: Mutation pass — desktop lib (no new gaps)

- [x] A twelfth batch mutated the desktop TS lib functions (`basket-alert`, `sync-retry`, `device-cleanup`, `history-sync`). **All runtime mutations were killed:**
  - `basket-alert`: threshold boundary (`<=`), `threshold <= 0` guard, clear-on-fire.
  - `sync-retry`: 1s throttle, retry-only-on-error.
  - `device-cleanup`: removed-count return, timer clear.
  - `history-sync`: upload cap.
- [x] No code change; tree unchanged from Phase 820 (`tsc 0`, lint 0 errors / 157 warnings, `2665 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 822: Adversarial input against the live server (clean)

- [x] Started the real server bundle + MySQL and fired hostile payloads at every reachable tRPC endpoint. **39/39 checks passed — no 5xx, no crash:**
  - `sync.push` / `sharedWatchlists.create`: `null`/array/string JSON, 200-deep nesting, a 200 KB string, unicode + NUL, `__proto__`/`constructor` pollution, `NaN`/`Infinity`, SQL-injection strings, `<script>` — all rejected cleanly.
  - `sync.pull`: malformed/empty/`%`/`null`/`undefined`/`[]`/`{` input, `since` as a string/`-1`/`1e308` — all handled.
  - `sharedWatchlists.get`: empty, path-traversal, SQL-injection, 5000-char, and `%00` tokens.
  - Oversized body (1000 items × 1 KB) and a wrong content-type.
- [x] The server stayed healthy (`/api/health` 200) after the whole barrage.
- [x] No code change; tree unchanged from Phase 821 (`tsc 0`, lint 0 errors / 157 warnings, `2665 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 823: Live concurrency/race verification (clean)

- [x] Fired concurrent requests at the live server + MySQL. **All real checks pass:**
  - 20 concurrent same-id `sync.push` → LWW resolved to the newest.
  - 30 concurrent distinct pushes → all persisted (after draining pages).
  - create+delete race (either order) → exactly one row, newest wins.
  - 10 concurrent logins → sessions valid; 10 concurrent share creates → 10 distinct tokens.
  - Server healthy after the barrage.
- [x] Two apparent failures were **test artifacts**, not bugs: `sync.pull` is paged (my first pull didn't drain) and `sync.push` is rate-limited to **30/min per IP** — the 30-push burst 429'd the follow-up requests, and the 10th concurrent login hit the login throttle (correct behavior). A corrected test under the limit passed 6/6.
- [x] No code change; tree unchanged from Phase 822 (`tsc 0`, lint 0 errors / 157 warnings, `2665 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 824: Schema/migration-drift audit (clean)

- [x] `drizzle-kit generate` reports **"No schema changes, nothing to migrate"** — `schema.ts` and the migration set are in sync.
- [x] The migration journal and SQL files are consistent: 29 journal entries ↔ 29 `.sql` files, no missing or orphaned files.
- [x] Verified the **applied** DB schema matches `schema.ts` for all 20 tables (a direct `SHOW COLUMNS` check; five initial "missing column" hits were a regex bleed across table blocks, confirmed false by direct inspection).
- [x] No code change; tree unchanged from Phase 823 (`tsc 0`, lint 0 errors / 157 warnings, `2665 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 825: Mutation pass — restock legacy-watch default gap

- [x] A thirteenth batch mutated the server notification/sync logic and client sync/restock. Most were killed (digest hold, dedup bucket, evaluate blocking, tombstone window, rate limit, client LWW, dirty cursor, stamp cap, restock condition).
- [x] One survived: `lib/restock.ts`'s `watch.lastKnownStatus ?? "back_order"` → `?? "in_stock"`. No test covered a legacy watch with `lastKnownStatus` **undefined**; defaulting to `"in_stock"` would silently never fire for pre-existing watches. Added a guard; the mutation now fails.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2666 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 826: Mutation pass — Rust backend (no new gaps)

- [x] Mutated the Rust security guards and merge logic; **all killed:**
  - `is_allowed_storage_key` / `is_allowed_external_url` (return-true stubs).
  - `parse_price_from_text` / `classify_fetch_status` (constant-return stubs).
  - `merge_listings` tie-break (`>` → `>=`), id-less-listing retention, disk-only-listing retention.
  - `deactivate_alerts_by_id` (renamed → compile/test failure).
- [x] No code change; tree unchanged from Phase 825 (`tsc 0`, lint 0 errors / 157 warnings, `2666 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 827: Mobile auth/legal screens audit (clean)

- [x] **`app/oauth/callback.tsx`:** cancellation flag, ticket-only redemption, validates the returned user (`id` finite + `openId`), publishes the shared auth state so sync/backfill/push start without a restart. `emailVerified: rawUser.emailVerified === true` is correct — every server auth response goes through `buildUserResponse`, which coerces to `Boolean`.
- [x] **`app/verify-email.tsx` / `app/reset-password.tsx`:** token extraction handles string/array, cancellation flag, Bearer token on native (cookie unavailable), refreshes `emailVerified` after verification.
- [x] **`app/search.tsx`:** double-submit guards (`adding`/`discovering`), dedup handling (reports "already tracked" instead of a false success), discovery-before-navigate.
- [x] **`app/stats.tsx` / `app/health.tsx`:** memoized derivations; `health.tsx` uses `isMountedRef` for its progress loop.
- [x] No code change; tree unchanged from Phase 826 (`tsc 0`, lint 0 errors / 157 warnings, `2666 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 828: Desktop components audit (clean)

- [x] **`ErrorBoundary.tsx`:** class boundary wrapping `<App/>` (outside the router), state-reset retry, `role="alert"`.
- [x] **`Modal.tsx` / `DialogOverlay.tsx` / `lib/dialog-stack.ts`:** shared LIFO token stack (Escape closes only the topmost, even when a picker is layered over a modal), ref-counted body-scroll lock, focus trap + restore, `onCloseRef` pattern (an inline `onClose` dependency re-ran the effect per keystroke and jumped focus).
- [x] **`ProductImage.tsx`:** `active` guard, module-level cache, error fallback.
- [x] **`SearchModal.tsx`:** `wasOpenRef` (loads only on open), memoized Fuse index, deferred query, catalog merge dedup.
- [x] No code change; tree unchanged from Phase 827 (`tsc 0`, lint 0 errors / 157 warnings, `2666 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 829: Dead-export audit (clean — minor dead code, no bugs)

- [x] Scanned every exported symbol in `lib/`, `app/`, `components/`, `hooks/`, `server/`, `shared/`, `desktop/src/` for production usage. Most "unused" hits are false positives (scrapers referenced via `registry.ts`, `_core/` hands-off, `*ForTests` resets).
- [x] A few genuinely dead-but-tested helpers exist — **not bugs**, just superseded API surface:
  - `lib/fx-history.ts` `getFxChange` (superseded by `getFxWindowChange`, which the Rates screens use).
  - `lib/price-chart.ts` `indexForLocationX` (production uses `nearestByX`).
  - `lib/tags.ts` `tagColor` (production uses `getTagById(...)?.color`) and `matchesTagFilter` (an "any"-mode wrapper over `matchesTagFilterMode`).
  - `lib/csv.ts` `parseWatchlistCsv` (test-only; the live import is JSON backup + bulk import).
- [x] Left in place: they are small, tested, and removing them is churn without a correctness benefit.
- [x] No code change; tree unchanged from Phase 828 (`tsc 0`, lint 0 errors / 157 warnings, `2666 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 830: Error-message leakage audit (clean)

- [x] **tRPC (`server/_core/trpc.ts`):** `redactErrorShape` strips `data.stack` unconditionally (the server is often run without `NODE_ENV=production`, so tRPC's default formatter would otherwise leak validation internals/file paths) and replaces the message with `GENERIC_ERR_MSG` whenever the error has a `cause`.
- [x] **REST auth (`server/_core/oauth.ts`):** every catch returns `safeAuthErrorMessage`, which passes through only deliberate `HttpError` messages and genericizes everything else; `/api/auth/me` failures return a static `"Not authenticated"`.
- [x] **tRPC routers:** every `TRPCError` message is a static string (e.g. `"Database not available"`) — no raw `error.message` is ever forwarded.
- [x] Client `String(e)`/`e.message` fallbacks therefore only ever surface the sanitized server message or a local storage error, never a stack or internal path.
- [x] No code change; tree unchanged from Phase 829 (`tsc 0`, lint 0 errors / 157 warnings, `2666 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 831: `.gitignore` missed per-environment env files

- [x] **Gap found:** `.gitignore` listed only `.env` and `.env*.local`, so `.env.production`, `.env.development`, `.env.staging`, and `.env.test` were **committable** — a developer creating one with real credentials could leak them. (The Android keystore script and its `credentials/` output were already covered.)
- [x] **Fix:** added `.env.*` with `!.env.example` (so the template stays committable). Added `tests/gitignore-secrets.test.ts` (4 cases: per-env files ignored, signing material ignored, `.env.example` allowed, no tracked `.env`). Proven non-vacuous: reverting fails the guard.
- [x] Also confirmed no committed secrets: the only `AIza…` hits are distributors' own public Google Maps keys inside scraped HTML fixtures, not referenced by our code.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2670 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 832: Dependency security audit — production-reachable advisories fixed

- [x] `pnpm audit` reported **133 vulnerabilities (4 critical, 80 high)** — the `dependency-analyzer` tool's "0 vulnerable" was wrong. Most are build/dev-time transitive deps (Expo CLI, metro, vitest, eslint), but several were **production-reachable**.
- [x] **Fixed production-reachable advisories:**
  - `undici` 7.29.0 → 7.30.0 (direct dep; used by the server's DNS-rebinding pin).
  - `path-to-regexp` 0.1.12 → 0.1.13 (via express) — ReDoS.
  - `@trpc/server` 11.7.2 → 11.19.0 (root + desktop) — prototype pollution.
  - pnpm overrides: `undici@>=7 <7.29.1` → 7.30.0, `undici@>=6 <6.28.1` → 6.28.1 (Expo CLI's bundled copy), `path-to-regexp@<0.1.13` → 0.1.13.
- [x] **Production-reachable advisories remaining: 0.** The remaining 108 are build/dev-only (Expo CLI/metro/vitest/eslint trees) and are left to their own release cadence.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2670 passed**; desktop `tsc 0`, **289 passed**; `pnpm build` (server + web) succeeds; `cargo test` 71, clippy 0, fmt clean.

## Phase 833: Dependency audit — dev-tree criticals reduced

- [x] Extended the overrides to the two simple dev-tree criticals: `tar` → 7.5.22 (node-tar decompression DoS) and `shell-quote` → 1.8.4 (newline-escape, the minimal patched version so `concurrently`'s `^1.8.3` range stays satisfied).
- [x] `pnpm audit` criticals: **4 → 1**. The last is `vitest` (<3.2.6, a UI-server file-read that requires a major vitest upgrade); it is a dev-only tool and is left for a dedicated upgrade.
- [x] Verified `concurrently --version` still works, `pnpm build` (server + web) succeeds, and all tests pass.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2670 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 834: Dependency audit — high-severity advisories eliminated

- [x] Extended the pnpm overrides to the transitive high-severity advisories with safe patch/minor bumps: `flatted`, `node-forge`, `ws`, `form-data`, `fast-uri`, `js-yaml`, `nanoid`, `postcss`, `rollup`, `vite`, `@xmldom/xmldom`, `browserslist`, `shell-quote`.
- [x] **`pnpm audit` high: 80 → 2, critical: 4 → 1, moderate: 43 → 11.** The two remaining highs are `image-size` — its patched version (2.0.3) is a major jump that **breaks Metro's web bundling** (`TypeError: The "list" argument must be an instance of SharedArrayBuffer…`), so it is left for a coordinated Expo upgrade. The last critical is `vitest` (dev-only, needs a major upgrade).
- [x] Caught the breakage by running `pnpm build:web` after the overrides and bisecting to the culprit (`image-size`); confirmed the final set builds cleanly.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2670 passed**; desktop `tsc 0`, **289 passed**; `pnpm build` (server + web) succeeds; `cargo test` 71, clippy 0, fmt clean.

## Phase 835: Remaining advisories assessed (dev-only, not reachable)

- [x] **`vitest` critical (GHSA-5xrq-8626-4rwp):** requires the **Vitest UI server** to be listening. The project only ever runs `vitest run` (headless) and `vitest` (watch) — never `--ui`. Not reachable.
- [x] **`vitest` moderate (GHSA-82fw-gwwq-j7x9):** requires a malicious test file (path traversal via `@vitest/mocker`). We author our own tests. Not reachable.
- [x] **`image-size` high:** the patched version (2.0.3) is a major jump that breaks Metro's web bundling (Phase 834), so it awaits a coordinated Expo upgrade. It is a build-time image-dimension reader, not a runtime request path.
- [x] Upgrading vitest to 4.x would require vite ^6/^7/^8 and a major test-config migration for zero reachable risk; deferred deliberately.
- [x] Verified both vitest runners still pass with the current overrides; root `tsc 0`, lint 0 errors / 157 warnings, **2670 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 71, clippy 0, fmt clean.

## Phase 836: AGENTS.md drift fixed + guarded

- [x] **Gap found:** AGENTS.md (the entry point for every agent) had stale counts: "25 global electronics distributors" (actually **30**), "25 entries" in the distributors.ts description (30), and "~277 test files / ~1734 tests" (actually **~376 / ~2670**).
- [x] **Fix:** corrected the distributor, parser, and test counts. Added `tests/agents-doc-drift.test.ts` pinning the distributor count (30), parser count (25), schema table count (20), and a 5%-tolerance test-file count. Proven non-vacuous: reverting a count fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2673 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 837: design.md drift fixed + guarded

- [x] **Gap found:** `design.md` (referenced by AGENTS.md as the live UI/UX spec) said "25 global electronics distributors (15 live parsers + 10 degraded)" and "Pre-loaded Distributor Database (25 sites)", and its catalog list stopped at 20 — omitting the 10 newer distributors. Two names were also wrong (`Allasch`→Allied Electronics, `Valve`→Steam).
- [x] **Fix:** corrected the counts (30 distributors / 25 parsers), completed the catalog list to all 30, fixed the two names, and extended `tests/agents-doc-drift.test.ts` to pin design.md's distributor count and catalog-list length. Proven non-vacuous: reverting a count fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2674 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 838: Deep-link/SW/web-serving audit (clean)

- [x] **Universal links (`server/spa.ts`):** `UNIVERSAL_LINK_PATHS` covers every routable path (`/product/*`, `/compare/*`, `/w/*`, `/stats`, `/health/*`, `/restock-watches`, `/search`, `/reset-password`, `/verify-email`, `/oauth/*`), and `tests/universal-link-paths.test.ts` derives the expected set from the filesystem so a new route without an association fails the test.
- [x] **Android intent filters (`app.config.ts`):** custom scheme + `autoVerify` https filter for the configured host (standard app-link behavior captures all paths).
- [x] **Service worker (`public/sw.js`):** navigation is network-first and refreshes `/index.html` (the URL the offline fallback reads); hashed `/_expo/static/*` bundles are runtime cache-first (not precached, since `addAll` rejects on a 404); `skipWaiting`/`clients.claim` + old-cache purge on activate.
- [x] **`registerSpa`:** unmatched `/api/*` and `/storage/*` return JSON 404 (not the HTML shell); the shell is `no-store`; hashed bundles are `immutable`.
- [x] No code change; tree unchanged from Phase 837 (`tsc 0`, lint 0 errors / 157 warnings, `2674 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 839: store-listing.md drift fixed + guarded

- [x] **Gap found:** `docs/store-listing.md` (the live Play Store / App Store submission copy) said "25 electronics distributors" / "25 global electronics distributors" in both the short and full descriptions — the store listing would advertise the wrong number.
- [x] **Fix:** corrected both to 30 (short description is 78 chars, within the 80-char Play Store limit). Extended `tests/agents-doc-drift.test.ts` to pin the store-listing distributor count and the 80-char short-description cap. Proven non-vacuous: reverting fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2675 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 840: Timezone/DST audit (clean)

- [x] **`lib/quiet-hours.ts`:** `utcOffsetMinutes` (client `Date.getTimezoneOffset()` semantics) evaluates the window in the user's local time (`(utc - offset) mod 1440`); wrap-around windows (`start > end`) handled; `start === end` treated as no window.
- [x] **`lib/price-digest.ts`:** the weekly gate compares **calendar days** (`setHours(0,0,0,0)` + `Math.round`), not elapsed 24h periods, so a DST week (167/169h) can't skip or double-fire; an invalid `lastDigestAt` still respects the day gate.
- [x] **`lib/drop-calendar.ts` / `lib/scrapers/health.ts`:** day keys use calendar-date arithmetic (`setDate`) and local `getFullYear/getMonth/getDate`, so a 23h spring-forward day can't be skipped.
- [x] **`lib/notifications.ts`:** reminders use a DATE trigger with the actual `Date` object (the OS fires in local time); the Android channel is on the trigger, not `content`.
- [x] **End-to-end:** the client sends its offset (`server-notifications.ts`), the server mapper preserves it, and `evaluate.ts`/`digest.ts` use it for every quiet-hours check.
- [x] No code change; tree unchanged from Phase 839 (`tsc 0`, lint 0 errors / 157 warnings, `2675 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 841: Numeric-overflow/large-input audit (clean)

- [x] **Server zod bounds:** every string has `.max()` (ids 191, distributor 64, model 128, currency 8), every array has a cap (`SYNC_PUSH_MAX_ITEMS`, `MAX_UPLOAD_*`), and prices are `.finite().positive().max(99_999_999)`.
- [x] **Future-stamp clamping (`sync.push`):** a stamp beyond `now + 5min` is clamped to `now` (not rejected) so a bad client clock can't poison LWW forever and the client self-heals.
- [x] **Byte caps:** the server sums `JSON.stringify(item.data).length` and rejects >5MB with a `BAD_REQUEST`; a cyclic payload throws and is caught → `"Unserializable sync data"`.
- [x] **Client:** `itemBytes` returns `Infinity` on a cyclic payload (forces a trim rather than aborting sync); `batchSyncItems` batches on both item count and bytes; `serializeItem` progressively trims history (`[20,10,5,2,1,0]`) until the item fits, never touching the local copy.
- [x] No code change; tree unchanged from Phase 840 (`tsc 0`, lint 0 errors / 157 warnings, `2675 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 842: Scraper positive-path coverage audit (clean, one tightened)

- [x] Verified all 25 parsers have a positive-path test (a non-null result with a price assertion) and that the 25 fixtures are negative (404) fixtures — returning null from them is correct.
- [x] 24 parsers assert the **exact** parsed price; `balticnetworks` only asserted `> 0`. Tightened it to the exact fixture price (1195) — a parser that grabbed the wrong number (shipping figure, crossed-out MSRP) would have passed a `>0` check. Proven non-vacuous: perturbing the parsed price by +1 fails the assertion.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2675 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 843: In-place array-mutation audit (clean)

- [x] Reviewed every `.sort()`/`.reverse()`/`.splice()` in `lib/`, `app/`, `components/`, `server/`, `shared/`, `desktop/src/`. Every sort operates on a freshly-created array (a `.map()`/`.filter()` result, an explicit `[...x]` copy, or a local accumulator), so no caller's array is mutated:
  - `distributor-analysis` (`results` local), `price-digest` (`priceChanges` from `.map`), `app/compare/[id]` (`[...listings]`), `app/(tabs)/index` (`withTime` from `.map`), `drop-calendar`/`watchlist-stats`/`product-insights`/`health` (mapped points), `price-share`/`deal-score` (mapped candidates).
  - `watchlist-org` sorts `copy` (an explicit clone).
  - `splice` sites are intentional: `storage/context` drains the suppressed-change buffer, `storage/notifications` trims the displayed-id list.
- [x] No code change; tree unchanged from Phase 842 (`tsc 0`, lint 0 errors / 157 warnings, `2675 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 844: Missing-await audit (clean)

- [x] Scanned every call to a known-async storage/auth/sync function for a missing `await`. All 43 raw hits resolved to false positives:
  - Interface declarations (`getWatchlist(): Promise<...>`).
  - Members of `Promise.all`/`Promise.allSettled` (e.g. `bulk-import-modal`'s chunked import).
  - `.catch()`-guarded fire-and-forget (`_layout`'s `seedWatchlistProducts`, `product/[id]`'s reads).
  - The desktop `use-auth.ts` `setSessionToken`/`setUserInfo` are its **own synchronous localStorage** helpers, not the async `_core/auth` versions — the calls are correct.
- [x] No code change; tree unchanged from Phase 843 (`tsc 0`, lint 0 errors / 157 warnings, `2675 passed`; desktop `289`; `cargo test` 71, clippy 0, fmt clean).

## Phase 845: Rust/mobile scraper currency parity guarded

- [x] **Gap found:** `tests/desktop-scraper-parity.test.ts` guarded search URLs, price selectors, the model matcher, and browser wait selectors — but **not currency**. A Rust parser declaring the wrong currency (e.g. `"USD"` where mobile says `"GBP"`) would show the wrong price on desktop and pass every existing check.
- [x] **Fix:** added a currency-parity case (verified all 25 parsers currently match). Proven non-vacuous: changing `linitx`'s Rust currency to `"USD"` fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2676 passed**; desktop `289`; `cargo test` 71, clippy 0, fmt clean.

## Phase 846: Rust CARD_SELECTOR still listed `.item` (decoy-price bug)

- [x] **Gap found:** mobile's `CARD_SELECTORS` deliberately **removed** the bare `.item` alternative (it is a generic list/grid wrapper on many shops, so `closest` returned the wrapper whose text names every product — validating a decoy price). The Rust `CARD_SELECTOR` still had `.item`, so the desktop could return a **wrong-product price**. Confirmed with a Rust test: a `<ul class="item">` grid with a CRS326 card first and a CRS804 card second accepted the CRS326 price for a CRS804 request.
- [x] **Fix:** removed `.item` from the Rust `CARD_SELECTOR` to match mobile; added a Rust regression test mirroring the mobile `.item`-wrapper case, and a `tests/desktop-scraper-parity.test.ts` case asserting the Rust and TS card/row selector lists are identical (and neither contains `.item`). Both proven non-vacuous.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2677 passed**; desktop `tsc 0`, **289 passed**; `cargo test` **72**, clippy 0, fmt clean.

## Phase 847: Rust/TS duplicated-constant parity audit (clean)

- [x] Enumerated every duplicated constant between the TS and Rust scraper engines:
  - `CARD_SELECTOR`/`ROW_SELECTOR` — now parity-tested (Phase 846).
  - `COMMERCE_SUFFIXES` — parity-tested (existing case).
  - `SERVER_SNAPSHOT_TTL_MS` (Rust) = `PRICE_SNAPSHOT_TTL_MS` (TS) = `60 * 60 * 1000`; the Rust comment names the TS constant.
  - `infer_stock_status` keyword lists — byte-identical, with a shared-corpus test (`infer_stock_status_agrees_with_the_shared_parser`).
  - `parse_price_from_text` / `matchesModel` — shared-corpus tests on both sides.
- [x] No code change; tree unchanged from Phase 846 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 848: Rust browser-pool/breaker audit (clean)

- [x] **`browser.rs` pool:** `in_use` counts checked-out browsers (so concurrent acquires can't exceed the cap); `acquire` only increments on success; `release` decrements and re-idles a connected browser; `PooledBrowser` keeps the `Playwright` driver alive (dropping it SIGKILLs the driver). No outer `tokio::time::timeout` wraps `fetch_with_browser`, so a scrape runs to completion and `release` always executes (no `in_use` leak).
- [x] **`breaker.rs`:** constants and the `1.5^(n-1)` growth formula are byte-identical to `lib/scrapers/resilient.ts` (30min block / 15min failure / threshold 3 / 2h cap); the 6 Rust tests assert the same values as the TS tests (30min, 45min, 15min-at-threshold).
- [x] No code change; tree unchanged from Phase 847 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 849: Tauri command-surface validation audit (clean)

- [x] **`set_value_for_key` / `read_value_for_key`:** both allowlist the key (an absolute/`../` key would escape the data dir).
- [x] **`export_watchlist`:** validates `format` (`json`/`csv`, else error) and strips the device-local BYO-LLM key from the export.
- [x] **`start_price_poller`:** rejects a zero interval (would panic `tokio::time::interval`); `poller_interval_secs` uses `saturating_mul(60).max(60)` (no overflow, 1-minute floor); a generation counter + running flag stop stale pollers.
- [x] **`fetch_price_insight`:** builds the URL from `api_base_url` (renderer-supplied, same trust boundary as the session token), validates each `x-llm-*` header via `HeaderName::from_bytes`/`HeaderValue::from_str`, and has an 8s timeout.
- [x] **`open_external` / `start_oauth` / `import_watchlist`:** scheme allowlist / loopback listener with a single-use ticket / size+version+schema validation (audited in Phases 800–801).
- [x] No code change; tree unchanged from Phase 848 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 850: Rust alert-delivery audit (clean)

- [x] **`delivered_events`:** emits only alerts whose notification was actually delivered (the renderer deactivates every event it receives, so emitting an undelivered one consumed an alert the user never saw).
- [x] **`deactivate_after_notify`:** `triggered` is index-aligned with `notifications` (a hit with an empty id is still pushed), so a failed toast can't consume a different alert; only `results[i] === true` is deactivated.
- [x] **`deactivate_alerts_by_id`:** re-reads the file immediately before writing (a minutes-long check must not revert a concurrent add/snooze/delete) and matches by id.
- [x] **Basket alert:** implemented in the renderer (`desktop/src/App.tsx` → `lib/basket-alert.ts`), matching mobile's semantics (audited in Phase 821).
- [x] No code change; tree unchanged from Phase 849 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 851: Resilient-fetch audit (clean)

- [x] **`attemptMethod`:** a definitive block is never retried (breaks immediately); a transient browser failure retries; `BrowserUnavailableError` breaks (no point retrying an absent browser).
- [x] **`resilientFetch`:** single-flight per `(breaker-store, parser, url)` with `.finally` cleanup; a cooldown returns `skipped`; tries the other method after a block (a browser block ≠ a plain block); records success/blocked/error with the correct cooldown (30min block growth, 15min at the failure threshold).
- [x] **`fetchAndParse`:** resolves a relative `resolveProductUrl` href against the search URL (fetch/Playwright reject relative URLs), falls back to the search page when the second hop fails, and threads the model through `parsePrice`.
- [x] No code change; tree unchanged from Phase 850 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 852: FX history/Rates audit (clean)

- [x] **`appendFxHistory`:** enforces the rate-array-length == timestamps-length invariant (pads with null, throws if it can't), handles a duplicate timestamp (replaces the last point) and a code absent from the incoming batch (appends null). Fuzzed 200 appends with random codes/duplicate timestamps — invariant held.
- [x] **`sliceFxHistoryByRange` / `getFxWindowChange`:** anchor is `min(now, max(ts))` (clock-skew safe); filters nulls before computing the first/last change; guards a zero baseline. Fuzzed 10k histories — always finite or null.
- [x] **Rates screen:** generation guard (the mount effect fires `loadData` twice, so an earlier read could land last), fallback to static `EXCHANGE_RATES` for a missing/non-finite rate.
- [x] **Desktop** imports the shared `lib/fx-history.ts` (no duplication).
- [x] No code change; tree unchanged from Phase 851 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 853: Watchlist screen audit (clean)

- [x] **Queued-count effect:** cancellation flag, 30s interval, web focus/visibility listeners, all cleaned up; re-subscribes on `watchlist.length` change.
- [x] **`loadData`:** a storage failure keeps previous values and leaves the loaded gate unset (marking it loaded would let the persist effect write fallbacks over the user's saved filters).
- [x] **Price-range filter:** real-time, validates `min <= max` and non-negative, skips the write when unchanged.
- [x] **Persist:** serialized `updateSettings` (a whole-object save raced the sort/group persist).
- [x] **Undo:** captures the full removal cascade (alerts, reminders, watches), restores all of them, and re-schedules the reminder notification (a restored dead id would never fire).
- [x] No code change; tree unchanged from Phase 852 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 854: Alerts data hook audit (clean)

- [x] **`loadData`:** generation guard (a stale read can't overwrite a newer one), `Promise.all` of all six reads, explicit `loadError` state, `loading` cleared only for the current generation.
- [x] **Refresh triggers:** focus effect + `subscribeToStorageChanges` (a price check firing or a server notification reconciling refreshes the visible list, not just the badge).
- [x] **`handleReschedule`:** rejects a past date; double-tap guard; schedules the new notification **before** cancelling the old (a scheduling failure leaves the user with a reminder); keeps the old notification id when the new schedule failed (so the still-scheduled one stays cancellable); storage-write failure shows an error instead of leaving the modal stuck.
- [x] **`handleRearmAlert` / deletes:** try/catch with a user-facing error and a reload.
- [x] No code change; tree unchanged from Phase 853 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 855: React key-prop audit (clean)

- [x] Scanned every `.map()` in `app/`, `components/`, `desktop/src/`. No JSX-returning map is missing a `key`.
- [x] The `key={i}`/`key={idx}` sites are all static or render-only lists where an index key is correct: weekday labels, skeleton placeholders, chart points/ticks/legend, timeline segments, onboarding dots. No dynamic reorderable list uses an index key.
- [x] No code change; tree unchanged from Phase 854 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 856: Settings screen audit (clean)

- [x] **Sync-status effect:** cancellation + 30s interval, gated on `isAuthenticated`.
- [x] **`updateSetting`:** optimistic update with a revert **from the store** (assigning the render-time snapshot undid a second change that had committed while the write was in flight), serialized `updateSettings`, and a background-task resync on `checkInterval`.
- [x] **`handleReenableDistributor`:** clears the circuit breaker (updating `lastChecked` alone left the distributor in cooldown while the UI showed "OK"), and re-reads the watchlist before `updateProductListings` (building from the mount-time snapshot reverted every price/status/history change since Settings opened).
- [x] **Load effect:** cancellation, `Promise.all`, error handling.
- [x] No code change; tree unchanged from Phase 855 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 857: Stats screen audit (clean)

- [x] **`load`:** `loadedRef` distinguishes first load (spinner) from refresh; `Promise.all` of the four reads; explicit `loadError`.
- [x] **Derived cards:** all memoized with correct deps; `digestPlaceholder` handles the "enabled but no snapshot yet" case (the card used to vanish).
- [x] **`handleSaveBasketAlert`:** optimistic update with revert on failure (leaving the new threshold on screen after a failed save showed a setting that was never persisted).
- [x] No code change; tree unchanged from Phase 856 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 858: React hooks-rules audit (clean)

- [x] Ran ESLint's `react-hooks/rules-of-hooks` across `app/`, `components/`, `hooks/`, `desktop/src/`: **0 errors** — no conditional/early-return hook violations.
- [x] Manually verified the 13 early-return sites (loading gates, `!open`/`!product` guards) have **no hooks after** the return.
- [x] The 36 `exhaustive-deps` warnings are benign: the "missing" deps in `use-auth.ts` are module-level `useCallback`-wrapped setters (`setUser`/`setLoading`/`setError`, stable); the `use-live-prices` ref-cleanup warnings are the documented generation-guard pattern.
- [x] No code change; tree unchanged from Phase 857 (`tsc 0`, lint 0 errors / 157 warnings, `2677 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 859: Quarantine index orphaned blobs across sessions

- [x] **Gap found:** `quarantinePayload` persisted the index as `[...quarantineKeys.values()].flat()` — but `quarantineKeys` is module memory, empty after a reload. So the first quarantine of a new session **overwrote** the persisted index with only the new keys, orphaning every blob from earlier sessions. Those blobs contain raw watchlist/alerts/settings payloads and would survive a wipe (`clearAllData`/`clearAccountData` only remove what the index lists). Verified with a reload simulation.
- [x] **Fix:** merge with the on-disk index (`listQuarantinedKeys`) before writing, and cap the merged list (`MAX_QUARANTINE_INDEX = 30`, newest by timestamp suffix) so it can't grow one entry per quarantine forever. Added `tests/storage-quarantine-index.test.ts` (reload-orphan + bound) using `vi.resetModules()` to simulate a real reload. Proven non-vacuous: reverting the merge fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2679 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 72, clippy 0, fmt clean.

## Phase 860: Storage enqueue/drain audit (clean)

- [x] **`enqueue`:** serializes read-modify-write per key (verified: same-key writes run in order), runs different keys concurrently, drops writes during a wipe, and stores `next.catch(() => {})` so a rejected write doesn't break the chain (verified: a write after a rejection still runs).
- [x] **`drainQueues`:** awaits the error-swallowed promises, so a rejected write doesn't reject the drain (verified) — `clearAllData` can't be undone by an in-flight write.
- [x] **`notify`/`setChangeSuppressed`:** buffers changes while suppressed and replays them on lift, skipping the keys the sync just applied; observers are isolated (a throwing listener can't reject the caller's write).
- [x] **`readList`:** an adapter failure throws (doesn't masquerade as empty); a corrupt/non-array payload is quarantined, not dropped.
- [x] No code change; tree unchanged from Phase 859 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 861: Sync full-resync/cursor audit (clean)

- [x] **Full resync:** drops a locally-present item only when it has sync meta with `updatedAt < cutoff && updatedAt <= oldCursor` (already-confirmed, not edited since); never-synced offline work is preserved; settings excluded (no client tombstones). The tombstone-expiry limitation is documented.
- [x] **Cursor:** a page-drain that hits its guard keeps the old cursor (advancing would skip the remaining pages); the push stamp is capped at the cursor (`Math.min(stampedAt, nextCursor)`) so `collectDirty` doesn't re-collect every sync; stamps + cursor are saved in one write.
- [x] **Rejections:** `stale_write` is not retried (re-pushing would beat the remote edit in LWW); validation/transient rejections are tracked in `retryKeys` (their stamp is `<= cursor`, so the normal freshness check would skip them forever).
- [x] **Generation gate:** a wipe during the push aborts before saving the cursor (otherwise the next account's first sync is incremental and skips rows).
- [x] No code change; tree unchanged from Phase 860 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 862: Notifications scheduling audit (clean)

- [x] **`immediateTrigger`:** works around the Android trigger-channel quirk (channelId must be on the trigger, not `content`); returns `null` on non-Android.
- [x] **`ensureNotificationPermission`:** cross-platform entry point (web uses the Notification API); callers must not use `requestNotificationPermissions` directly (always false on web).
- [x] **Health alerts/recovery:** bail when the web display failed (the caller records the event as delivered, so a failed display would silently consume the alert); return the same `eventId` the caller uploads (otherwise the server mints a different one and the event is delivered twice); quiet-hours gated.
- [x] **`scheduleServerEventNotification`:** returns whether a notification was shown (non-fatal on failure).
- [x] **`setupPushEventTracking`:** records eventIds from received/tapped/last-response listeners, cleans up subscriptions, and documents the accepted background-push gap (pull is the correctness guarantee).
- [x] No code change; tree unchanged from Phase 861 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 863: Price-check basket/alert audit (clean)

- [x] **Basket alert:** computes the total in the display currency (the sheet says the threshold is in that currency); does **not** `return` on a web-display failure (that would skip the price-alert evaluation below); clears the threshold only after the alert actually fired (permission denied / scheduling throw leaves it set to retry); uses the serialized `updateSettings` patch.
- [x] **Price alerts:** scoped via `listingsForAlert`; only in-stock, finite, positive listings anchor; converts to the alert currency; re-reads alerts before firing (dedup); **claims the transition with `deactivateAlert` before notifying** (a concurrent runner that already triggered returns false, so no double-notify); re-arms on a post-claim display/scheduling failure.
- [x] No code change; tree unchanged from Phase 862 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 864: Storage wipe/cascade audit (clean)

- [x] **`removeFromWatchlist` cascade:** removes the product, its alerts, and its reminders/watches, cancelling each scheduled notification (an orphaned schedule would still fire).
- [x] **`clearAccountData`:** bumps the sync generation before touching the store (an in-flight sync can't re-apply the previous account's rows), drains queued writes, cancels all notifications, removes every collection + health/breaker/quarantine keys, and **strips the BYO-LLM credential** (reset to `forge`, delete model/ollama url) so the next account can't reveal or bill the previous user's provider.
- [x] **`clearAllData`:** drains, cancels notifications, removes every key including `has_seen_onboarding`, the background-task interval marker, and quarantine blobs.
- [x] **`addToWatchlist` / `updateProductListings`:** enqueued read-modify-write (no lost updates).
- [x] No code change; tree unchanged from Phase 863 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 865: Remaining storage-module audit (clean)

- [x] **`discovery.ts`:** product dedup by id/identity with a cap (200) and canonical return (Phase 793); `addDiscoveredDistributor` dedups by id and caps at 200. `getDiscoveredDistributors` is stored/tested but unused in production (dead storage, not a bug).
- [x] **`digest-fx.ts`:** validates the digest-snapshot shape (a non-array `products` would throw in `computeDigest`'s `.map` inside a `useMemo` with no boundary); filters FX rates to finite numbers; enqueued writes.
- [x] **`notifications.ts`:** displayed-event ids and history dedup by id and cap at 200; `markNotificationRead`/`markAllNotificationsRead` only write when something changed; pending-health-events buffer is enqueued.
- [x] No code change; tree unchanged from Phase 864 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 866: Health service/probe audit (clean)

- [x] **`lib/health.ts`:** 3s abort timeout cleared in `finally`.
- [x] **`computeHealthStats`:** trend split is guarded (`half > 0`), sparkline maps an unknown status to 0 (a corrupt status would yield NaN → malformed SVG).
- [x] **`computeHealthSummary` / `timelineSegments`:** ignore unparseable dates; trapezoidal weights sum to 1 and guard a non-finite/zero span; `groupSamplesByDay` sorts newest-first.
- [x] **`getHealthHistory`:** sorts each distributor's samples on read (positional alert/recovery detection).
- [x] **`testAllDistributors`:** single-flight (the background probe and manual "Test All" can overlap); concurrency-bounded (3); `recordSample` prunes to the age/sample caps.
- [x] No code change; tree unchanged from Phase 865 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 867: Price-digest computation audit (clean)

- [x] **`computeDigest`:** `valueDelta` requires no currency change and both totals > 0 (a zero baseline would be `Infinity`); `alertTargetsHit` uses parsed-time comparison and falls back to `targetPrice` when `triggeredPrice` is 0 (a server-detected trigger can store 0, which rendered "target hit at $0.00"); `stockChanges` compares per-product status.
- [x] **`formatDigestNotification`:** caps each section (3 price changes, 2 stock changes, 2 alerts) and the total body to 9 lines; emits "No changes" when nothing changed.
- [x] No code change; tree unchanged from Phase 866 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 868: Desktop App orchestration audit (clean)

- [x] **Keyboard shortcuts dialog:** focus trap + restore, Escape close, `isTyping` guard (a shortcut doesn't fire while typing).
- [x] **Sync setup:** `syncRef` + `registerSyncSetup` (the Settings "Sync now" button works); sign-in triggers `syncNow` + device cleanup + history backfill; foreground retry mirrors mobile.
- [x] **Web push:** registers the SW `web-push-shown` dedup listener.
- [x] **Launch sequence:** seeds, starts the poller, loads FX, runs one price check.
- [x] **Price-sweep handler:** records health samples, rediscoveries missing listings, evaluates restock watches with the **desktop store + Tauri notifier** (the shared default resolves to IndexedDB / the browser Notification API, which is not granted in the webview), and sends the digest — each step in its own try/catch.
- [x] No code change; tree unchanged from Phase 867 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 869: Listing-discovery/manual-add audit (clean)

- [x] **`discoverListings`:** concurrency-bounded (3), rejects stale snapshots (would masquerade as fresh discoveries), best-effort per distributor, progress callback.
- [x] **`manualAddProduct`:** checks `trackedIds` then the storage return value (a sync landing between the check and the write makes `trackedIds` stale; storage dedupes — running discovery then would replace the existing product's listings/history with a fresh single-point array); timeout → empty listings + `timedOut`.
- [x] **`rediscoverMissingListings`:** bounded per run (`MISSING_LISTINGS_PER_RUN = 2`), rotates attempts (`MISSING_LISTINGS_RETRY_MS = 6h`) so permanently-unfindable products can't occupy every run's slots; `customProductSlug` (`custom-<slug>`) can't collide with catalog ids (`mikrotik-<slug>`).
- [x] No code change; tree unchanged from Phase 868 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 870: LLM discovery audit (clean)

- [x] **Error taxonomy:** typed `DiscoveryAuthError` (401/403) and `DiscoveryError` (network/timeout/server/parse/byo-auth); `toDiscoverErrorState` maps each to a user-facing title/message/retry, including the distinct "Check your API key" for a rejected BYO key.
- [x] **Request:** bounds the query to `MAX_DISCOVERY_QUERY` (the server rejects longer ones outright); 15s abort timeout cleared in `finally`; injectable auth/BYO-LLM headers (mobile/desktop register their own — the module can't import either); `credentials: "include"` for the web cookie path.
- [x] **Response:** parses the tRPC envelope, returns null when there's no product, and uses the canonical stored product (Phase 793) so a re-discovery dedups.
- [x] No code change; tree unchanged from Phase 869 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 871: Price-source/server-prices audit (clean)

- [x] **`price-source.ts`:** device scrapes bounded by a 3-slot semaphore; rejects implausible prices (Phase 739); server-first with a freshness gate; a stale/absent server snapshot falls through to a device scrape (returning the stale snapshot silently missed the distributor); a stale server snapshot still beats nothing.
- [x] **`server-prices.ts`:** the backgrounded path bypasses the tRPC batch loader (whose `setTimeout` dispatch freezes) and hits the HTTP endpoint via the native-timeout `backgroundFetch`; the foreground path races a 4s timeout with the timer cleared in `finally`; `uploadServerHistory` returns a boolean so callers can distinguish success.
- [x] No code change; tree unchanged from Phase 870 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 872: Server notification index audit (clean)

- [x] **`pullPendingEvents`:** selects + marks-delivered in **one transaction with `FOR UPDATE`** (two overlapping pulls can't deliver the same rows twice); bounds the page (`PULL_MAX_EVENTS = 200`) so a 30-day backlog can't return thousands at once; memory branch mirrors the semantics.
- [x] **`upsertDeviceConfig`:** only overwrites quiet hours when the client sent them (an older client must not wipe a newer one's setting); an explicit `null` clears it; preserves the existing user binding when the caller sends none (the health-event path needs it, or events are dropped in DB mode).
- [x] **`purgeOldNotificationEvents`:** 30-day retention, batched (1000 × 10/tick) so a large table never holds a long lock.
- [x] No code change; tree unchanged from Phase 871 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 873: Server sync-db audit (clean)

- [x] **`shouldAcceptSyncWrite`:** legacy rows without a client stamp fall back to the server-stamped comparison (not unconditional accept).
- [x] **`listChangedItems`:** composite `(effectiveStamp, collection, id)` cursor makes the page order total (a stamp-only cursor would loop forever on bulk edits); `SYNC_COLLECTION_ORDER` must match the router's sort (documented); `GREATEST(updatedAtMs, COALESCE(deletedAtMs, 0))`; per-collection cap (5000).
- [x] **`upsertSyncItem`:** the LWW verdict is snapshotted into `@__lww_ok` on first evaluation — MySQL evaluates `ON DUPLICATE KEY UPDATE` assignments left-to-right with intermediate values visible, so a bare per-column condition would read the just-overwritten `clientUpdatedAtMs` and silently drop deletes; the acceptance check re-reads the row.
- [x] No code change; tree unchanged from Phase 872 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 874: Server sync router audit (clean)

- [x] **`pull`:** captures `lastSyncedAt` before the SELECT (writes committed during the query aren't missed); detects a full resync when the client cursor predates the tombstone window (an incremental pull would omit untouched live rows and the client would delete them); pages with the composite cursor (inclusive at the boundary so no item is skipped; the client dedupes); sorts the merged list by the same `(stamp, collection, id)` key the cursor uses; `SYNC_PULL_MAX_ITEMS + 1` detects `hasMore`.
- [x] **Rate limit:** 60/min.
- [x] No code change; tree unchanged from Phase 873 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 875: Fresh-DB verification (clean)

- [x] Created a brand-new database, ran `pnpm db:push` (all migrations), and ran the DB-gated suite: **8 files / 30 tests pass** — the suite works against a clean schema, not just the accumulated audit DB.
- [x] Confirmed the DB tests genuinely exercise the DB: `sync-e2e.test.ts` runs 6 tests with `RUN_DB_TESTS=1` and **skips all 6** without it (no silent pass).
- [x] No code change; tree unchanged from Phase 874 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 876: Server sync push audit (clean)

- [x] **Payload caps:** `SYNC_PUSH_MAX_ITEMS` on the array and a 5MB total-bytes cap (200 × 100KB would force ~20MB of upserts); a cyclic payload throws → `BAD_REQUEST`.
- [x] **Stamp clamping:** a future stamp (`> now + 5min`) is clamped to `now` rather than rejected (rejecting wedged sync permanently — the client re-sends the same future stamp every retry).
- [x] **Concurrency:** `mapWithConcurrency(items, 8)` bounds the INSERT+SELECT round trips while preserving order (the stamped/rejected arrays stay index-aligned).
- [x] **Rate limit:** 30/min; tombstone purge is interval-gated.
- [x] No code change; tree unchanged from Phase 875 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 877: Server devices audit (clean)

- [x] **`assertDeviceAccess`:** enforces per-user ownership (unbound or same-user allowed, else FORBIDDEN).
- [x] **`unbindDevice`:** ownership-checked; removes config/tokens/deliveries/events/labels (labels have no FK, so a re-bound deviceId would inherit the previous owner's label); clears the device + user digest buffers.
- [x] **`unrevokeDevice`:** lifts the user's wildcard on sign-in (proving current credentials).
- [x] **`cleanupStaleDevices` / `purgeOldRevokedDevices`:** 30-day idle cleanup; revoked rows purged in batches (1000 × 10/tick) after 90 days.
- [x] **`isDeviceRevoked`:** matches the device-specific or wildcard revocation for the user.
- [x] No code change; tree unchanged from Phase 876 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 878: Server auth-flows audit (clean)

- [x] **Register/login:** per-IP + per-account rate limits (a distributed spray rotates IPs); a fresh login from a signed-out device unrevokes it; session cookie set.
- [x] **Reset:** consumes + applies the token in one transaction (a failure after consumption would burn the one-time token); revokes all devices (a reset is the recovery path for a compromised account).
- [x] **Change-password:** per-IP + per-account throttle; verifies the current password; bumps `credentialsChangedAt` (rejects every prior session, including unregistered device ids); revokes other devices but re-mints the caller's own session under the new epoch and returns it for Bearer clients.
- [x] No code change; tree unchanged from Phase 877 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 879: OAuth flow audit (clean)

- [x] **`/start`:** rate-limited; validates the provider; sanitizes `redirectUri` before signing the state envelope (defense in depth).
- [x] **Callback:** rate-limited; verifies the signed state; the web flow must echo the nonce cookie (login-CSRF guard) while native flows are bound by the device-scoped ticket; clears the cookie; links an existing email account only when the provider vouches for the email (linking on an unverified email lets an attacker pre-register a victim's address — the pre-hijack fix).
- [x] **`/consume`:** rate-limited; single-use ticket; unrevokes the device; mints a session with the credential epoch.
- [x] No code change; tree unchanged from Phase 878 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 880: Auth endpoints audit (clean)

- [x] **`delete-account`:** device-allowed check; requires `confirm === "DELETE"`; deletes the user and clears the cookie.
- [x] **`resend-verification`:** per-IP + per-account throttle; device-allowed; short-circuits when already verified; stores only the token hash.
- [x] **`verify`:** per-IP throttle; consumes the hashed token.
- [x] **`forgot`:** per-IP + per-target throttle (rotating IPs must not bomb one inbox); **no enumeration** — always returns `{ success: true }` whether or not the email exists; stores only the token hash, sends the plaintext only by email.
- [x] No code change; tree unchanged from Phase 879 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 881: DB token-helper audit (clean)

- [x] **`consumePasswordResetToken` / `resetPasswordWithToken`:** consume + apply in one transaction with `FOR UPDATE` (a failure after consumption can't burn the token without changing the password); the memory fallback only triggers when the DB has **no row at all** — a row that exists but is used/expired stays rejected (a dual-stored token can't be consumed twice).
- [x] **`resetPasswordWithToken`:** sets `credentialsChangedAt` in the same transaction (the credential epoch).
- [x] **`purgeExpiredAuthTokens`:** purges both token tables.
- [x] No code change; tree unchanged from Phase 880 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 882: SDK session/token audit (clean)

- [x] **`createSessionToken`/`signSession`:** HS256 JWT with the `cca` (credential epoch) claim; `deviceId` only when present.
- [x] **`verifySession`:** requires `openId`+`appId` (not `name` — an OAuth account with no profile name would otherwise mint tokens the server rejects, locking the user out); a pre-claim token carries no `cca` → treated as epoch 0 so it's invalidated once the account changes credentials.
- [x] **`authenticateRequest`:** Bearer or cookie; rejects a token whose `cca` predates the user's `credentialsChangedAt` (the only check that reaches unregistered device ids); throttles the `lastSignedIn` write (60s).
- [x] No code change; tree unchanged from Phase 881 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 883: Server entry/middleware-order audit (clean)

- [x] **Ordering:** `trust proxy` → security headers → CORS → `/api` no-store → body parsers → storage proxy → OAuth → health → tRPC → well-known → SPA (after `/api/*`).
- [x] **Body limits:** the sync.push limit is mounted for that procedure only, before the small default — a global 50mb limit let concurrent unauthenticated POSTs inflate memory before the rate limit (which runs inside the handler, after buffering).
- [x] **`/api/healthz`:** logs the DB error server-side and returns a generic 503 (driver errors can leak host/user/schema to an unauthenticated caller).
- [x] **Port:** production fails fast on the preferred port (silently binding another makes the health check fail with no clear cause); dev finds an available port.
- [x] No code change; tree unchanged from Phase 882 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 884: HTTP middleware audit (clean)

- [x] **CORS:** allowlisted origins only (exact match; credentials never granted to an unknown origin); `X-LLM-*` headers allowed (else the preflight blocks BYO-LLM calls).
- [x] **Security headers:** `nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Referrer-Policy` (keeps the `/w/<token>` out of the Referer), HSTS, a CSP whose `connect-src` includes the configured API origin (a separate api host would otherwise be blocked), `X-Powered-By` removed.
- [x] **`resolveTrustProxy`:** defaults to 1 hop; overridable (number/false/true/IPs).
- [x] **Body parsers:** the 10mb limit is scoped to the sync.push procedure **exactly** (a prefix match would grant unauthenticated 10mb buffering to `/api/trpc/sync.pushX`); handles the comma-batched shape; mounted before the 256kb default.
- [x] No code change; tree unchanged from Phase 883 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 885: Desktop health events missing the lowercased id

- [x] **Gap found:** the desktop's `emitHealthEvent` pushed pending health events **without an `id`**. The upload layer synthesizes a fallback id (`health-${distributorId}-${status}-${createdAt}`) that is **not lowercased**, while the locally-recorded event id **is** (`health-${distributorId.toLowerCase()}-...`). For a mixed-case distributor id the server event would not dedupe against the local one → a duplicate notification. (Mobile sends the lowercased id.)
- [x] **Fix:** include `id: eventId` (the already-lowercased local id) in the pending event, matching mobile. Added a guard to `desktop/tests/health-probe.test.tsx` asserting every pending event carries a lowercased id. Proven non-vacuous: removing the id fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2679 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 72, clippy 0, fmt clean.

## Phase 886: Desktop notification-lib audit (clean)

- [x] **`notification-permission.ts`:** web checks/requests the Notification permission; Tauri (no `Notification` API) falls through to granted.
- [x] **`push-unregister.ts`:** 5s timeout, returns false on failure (the caller keeps the pending flag).
- [x] **`share.ts`:** clipboard with a `execCommand` fallback; PNG export.
- [x] **`server-notifications.ts`:** single-flight sync; a pending unregister retries and clears on success; master-switch off retracts the server config and drops the health buffer (intentional suppression); sends the model number for every referenced product (manually-added/rediscovered products get server-side notifications); health events carry the lowercased id (Phase 885).
- [x] No code change; tree unchanged from Phase 885 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 887: Desktop ProductDetail audit (clean)

- [x] **`loadProduct`:** generation guard (`loadIdRef`); `Promise.all` of the four reads; seeds every alert-currency field from the display currency (the main Set Alert modal was left at "USD", so a EUR/GBP user's alert was created in the wrong currency).
- [x] **Derived memos:** `bestListing`/`isLowestEver`/`trendSignal` convert to the display currency and skip unconvertible points (mapping them to Infinity made an all-unconvertible history claim "lowest ever"); `bestListing` skips unconvertible listings rather than matching the raw price.
- [x] **Note/edit:** cancellation flag; `handleSaveEdit` requires non-empty name + model (a blank model silently kept the old one while the UI implied it changed).
- [x] No code change; tree unchanged from Phase 886 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 888: Desktop Search/Watchlist audit (clean)

- [x] **`Search.tsx`:** `handleDiscover`/`handleManualParse` guard double-submit; `handleBulkImport` uses `Promise.allSettled` and counts only fulfilled `true` (a duplicate resolves `false`, which the fulfilled-status check used to count as an import); marks newly-tracked ids so the catalog row stops offering "Add".
- [x] **`Watchlist.tsx`:** six effects (load, storage subscription, interval, etc.) with cleanup; the tag-count fallback is a deliberate loading-state fallback.
- [x] No code change; tree unchanged from Phase 887 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 889: Remaining lib-module audit (clean)

- [x] **`alert.ts`:** web fallback; Android's 3-button limit handled with a "More…" sequential choice (extras are otherwise silently dropped).
- [x] **`navigation.ts`:** `goBackOrHome` falls back to replace when there's no history (a deep link / cold start).
- [x] **`product-notes.ts`:** module-local write chain (callers inject their own store, so the storage enqueue doesn't fit); the chain never stays rejected.
- [x] **`search-preview.ts`:** unscored ids tie at 0 and keep input order (no fake scores).
- [x] **`share-text.ts`:** web Web-Share-API with a clipboard fallback (react-native-web's Share rejects on desktop browsers); reports the outcome.
- [x] **`toast-colors.ts`:** success pairs a light bg with dark text (white-on-foreground is unreadable in dark mode).
- [x] **`watchlist-share.ts`:** correct pluralization; `formatPrice` in the display currency.
- [x] No code change; tree unchanged from Phase 888 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 890: Hooks/constants/shared audit (clean)

- [x] **`use-search-data.ts`:** per-read `.catch`; prunes selected tag ids that no longer exist.
- [x] **`use-server-config.ts` / `use-color-scheme.ts` / `use-colors.ts`:** memoized; the web color-scheme hook has a hydration guard (returns "light" until hydrated) to avoid a hydration mismatch.
- [x] **`shared/src/log.ts`:** `LOG_ERROR` is a no-op in production (`__DEV__` guard).
- [x] **`constants/oauth.ts`:** static `process.env.EXPO_PUBLIC_*` access (Expo's env plugin only inlines literals); the web redirect is the SPA route (not a nonexistent API path); the device header is omitted on web (it would force the native ticket branch, no cookie).
- [x] No code change; tree unchanged from Phase 889 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 891: Settings-section components audit (clean)

- [x] **`connection-section.tsx`:** uses the shared `useConnection` hook; the refresh button is disabled while refreshing; haptics guarded to native.
- [x] **`notifications-section.tsx`:** the web-notifications toggle is permission-gated (`setWebNotificationsEnabled` returns the permission; the switch only stays on when granted) and shows a hint on denial; persists via `updateSetting`.
- [x] **`data-section.tsx` / `about-section.tsx` / `device-management-section.tsx`:** audited in earlier phases (JSON backup import, empty privacy-URL guard, device list).
- [x] No code change; tree unchanged from Phase 890 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 892: UI-primitive components audit (clean)

- [x] **`cross-platform-date-picker.tsx`:** web renders a native `<input type="date">` (the community picker renders null on web, making the pickers a dead end); constructs the Date from local Y/M/D parts (not a UTC parse).
- [x] **`toast.tsx`:** timer cleared on each new toast and on unmount; the exit animation only hides when `finished` (starting a new toast during the exit stops the animation, and an unconditional hide swallowed the new toast).
- [x] **`empty-state-view.tsx` / `skeleton.tsx` / `icon-action-button.tsx`:** typed `IconSymbolName` (Phase 717).
- [x] No code change; tree unchanged from Phase 891 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 893: Search components / distributor-analysis audit (clean)

- [x] **`catalog-product-card.tsx` / `recent-searches.tsx`:** memoized; haptics guarded to native.
- [x] **`distributor-analysis.ts`:** filters to in-stock, positive, convertible listings; uses the cheapest per product (deterministic); guards a non-finite `taxRate` (`??` doesn't sanitize NaN, which would render the row as `$NaN`); sorted by total cost.
- [x] No code change; tree unchanged from Phase 892 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 894: Error-boundary audit (clean)

- [x] **`AppErrorBoundary` / `RouteErrorBoundary`:** `getDerivedStateFromError` never throws (a throw would crash the boundary itself and show a blank screen); grapheme-safe truncation via `Intl.Segmenter` with a code-point fallback (a raw `.slice` could split a surrogate pair); logs to AsyncStorage; themed fallback with retry + home/back.
- [x] No code change; tree unchanged from Phase 893 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 895: Notification-center / tag-sheet / onboarding audit (clean)

- [x] **`notification-center.tsx`:** functional unread decrement (two quick taps used to read the same stale closure and under-count); storage subscription; refresh control.
- [x] **`tag-picker-sheet.tsx`:** `loadFailed` state (a failed load doesn't render an empty picker as if there were no tags); keyboard-height handling; save try/catch.
- [x] **`onboarding-screen.tsx`:** index state, no async races.
- [x] No code change; tree unchanged from Phase 894 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 896: Remaining app-screen audit (clean)

- [x] **`distributor-analysis.tsx` / `restock-watches.tsx`:** explicit error state; catch handling.
- [x] **`privacy.tsx`:** static content.
- [x] **`w/[token].tsx`:** join/leave mutations with `isPending` guards (buttons disabled while pending) and user-facing error alerts; display-currency read with a catch.
- [x] No code change; tree unchanged from Phase 895 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 897: Product re-exports / rates / share-card audit (clean)

- [x] **`app/product/_components.tsx`:** re-export barrel.
- [x] **`fx-rate-grid.tsx` / `fx-sparkline-card.tsx`:** grid layout; per-currency fallbacks (`?? 1`, `?? 0`, `?? []`).
- [x] **`stats-share-card.tsx`:** `forwardRef` for image capture; correct pluralization; display-currency formatting.
- [x] No code change; tree unchanged from Phase 896 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 898: Product-detail components audit (clean)

- [x] **`price-alert-modal.tsx`:** presentational (state in the parent); currency chips from `EXCHANGE_RATES`.
- [x] **`edit-product-sheet.tsx`:** `canSave` requires non-empty name + model (matching the storage contract); disabled state + a11y.
- [x] **`distributor-listing-section.tsx`:** receives pre-sorted listings; effects with cleanup; best-listing selection skips out-of-stock.
- [x] No code change; tree unchanged from Phase 897 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 899: Flakiness/stability audit (clean)

- [x] Ran the full suite 3× — identical results each time (**2679 passed / 27 skipped**), no flakiness.
- [x] The `stderr` stack traces in the output are expected: tests that deliberately exercise error paths (restock storage failure, warmer step isolation, login failure, FX provider failure) log via `console.error`. No test failed.
- [x] No code change; tree unchanged from Phase 898 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 900: Cross-suite stability audit (clean)

- [x] Desktop suite 3×: **289 passed** each time. `cargo test` 3×: **72 passed** each time. DB suite 3×: **30 passed** each time. No flakiness across any suite.
- [x] No code change; tree unchanged from Phase 899 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 901: Desktop Vite bundle browser smoke (clean)

- [x] Built the desktop Vite production bundle and loaded it in headless Chromium (seeded localStorage so screens render real content). The app mounts and renders the full nav (Home/Watchlist/Alerts/Restock Watches/Search/Rates/Stats/Health/Settings) — **937 chars, zero non-Tauri errors**.
- [x] No code change; tree unchanged from Phase 900 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 902: Web-export secret/leak audit (clean)

- [x] Built the web export and scanned it: **no source maps**, no server-only env names (`RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `JWT_SECRET`, `DATABASE_URL`, `SPEND_BUDGET_*`, `TRUST_PROXY`, `EMAIL_FROM`), no absolute local paths (`/home/...`), and no API-key-shaped strings. Bundle is 4.8 MB.
- [x] No code change; tree unchanged from Phase 901 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 903: Server-bundle leak audit (clean)

- [x] Built the server bundle (360 KB) and scanned it: **no actual `require`/`import` of client modules** (`react-native`, `expo-router`, `react-native-web`, `@react-navigation`) — the single `react-native` match is a code comment; no API-key-shaped secrets. `tests/server-bundle-purity.test.ts` passes.
- [x] No code change; tree unchanged from Phase 902 (`tsc 0`, lint 0 errors / 157 warnings, `2679 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 904: Interactive-element a11y audit (2 gaps fixed)

- [x] **Gap found:** two tappable controls lacked an accessible name — the Settings "Share watchlist" button and the reschedule-modal backdrop (tap-to-dismiss). Screen readers would announce them as unlabeled buttons.
- [x] **Fix:** added `accessibilityLabel`/`accessibilityRole` (and `accessibilityState` for the disabled share button). Added `tests/interactive-a11y.test.ts`, which scans the **full** opening tag of every `Touchable*`/`Pressable` with a real `onPress` (excluding `stopPropagation` containers) and fails on a missing label. Proven non-vacuous: removing a label fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2680 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 905: Desktop icon-only button a11y (5 gaps fixed)

- [x] **Gap found:** five desktop close buttons rendered only an `<X>` icon with no `aria-label` — screen readers announced them as unlabeled buttons. (The desktop uses plain `<button>`; a text child is a valid name, so only genuinely icon-only buttons are affected.)
- [x] **Fix:** added `aria-label="Close"` to all five. Extended `tests/interactive-a11y.test.ts` with a desktop case that flags any `<button>` whose only child is a single self-closing component and lacks `aria-label`/`title`. Proven non-vacuous: removing a label fails the guard.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2681 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 72, clippy 0, fmt clean.

## Phase 906: Desktop form-control a11y (1 gap fixed)

- [x] **Gap found:** the reminder "Distributor" `<select>` had a visual `<label>` but no programmatic association (`htmlFor`/`id`/`aria-label`), so screen readers announced it as an unnamed combobox.
- [x] **Fix:** added `aria-label="Distributor"`. Extended `tests/interactive-a11y.test.ts` with a desktop case flagging any `<input>`/`<select>` (excluding hidden/checkbox/radio/submit/button/range/file) lacking `aria-label`/`aria-labelledby`/`placeholder`/`id`. Proven non-vacuous: removing the label fails the guard. (All other desktop inputs already had an `aria-label` or `placeholder`.)
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2682 passed**; desktop `tsc 0`, **289 passed**; `cargo test` 72, clippy 0, fmt clean.

## Phase 907: Mobile TextInput a11y audit (clean)

- [x] Scanned every `<TextInput>` in `app/` and `components/` (full opening tag) for `accessibilityLabel`/`aria-label`/`placeholder`. All have one — the single hit was a false positive (`useRef<TextInput | null>` type annotation).
- [x] No code change; tree unchanged from Phase 906 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 908: Tab-layout / badge / tag-component audit (clean)

- [x] **`(tabs)/_layout.tsx`:** safe-area-aware tab bar height; alert badge only when > 0.
- [x] **`haptic-tab.tsx`:** haptics guarded to iOS (`EXPO_OS`); forwards `onPressIn`.
- [x] **`stock-badge.tsx`:** unknown status falls back to the "Unknown" config.
- [x] **`tag-filter-row.tsx` / `bulk-tag-sheet.tsx` / `tag-manage-sheet.tsx`:** no async races.
- [x] No code change; tree unchanged from Phase 907 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 909: Scripts-directory audit (clean)

- [x] **`android-keystore.sh` / `android-release.sh`:** keystore stored outside `android/` (prebuild --clean would delete it); release script bakes the production API URL and forces the bundle task to re-run (Gradle cached the localhost bundle).
- [x] **`setup-test-db.sh`:** idempotent; reads container credentials.
- [x] **`generate-fixtures.ts`:** regenerates the per-parser fixtures from the registry.
- [x] **`reset-project.js`:** template reset (documented as removable).
- [x] No code change; tree unchanged from Phase 908 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 910: Design-spec/plan docs audit (clean)

- [x] `docs/superpowers/` holds 338 dated design specs and implementation plans. They are **historical artifacts** (each describes the state at its date), so the stale counts they contain are expected — AGENTS.md describes them as "design specs + implementation plans for recent phases", not live references, and no live doc points to them as current.
- [x] No code change; tree unchanged from Phase 909 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 911: Server process-lifecycle audit (clean)

- [x] **Graceful shutdown:** SIGTERM/SIGINT stop the warmer, drain in-flight requests (`server.close` with a 5s unref'd timeout) **before** closing the DB pool (closing the pool first made drain-window requests fail), then exit 0.
- [x] **`server.on("error")`:** a bind failure exits 1.
- [x] **`unhandledRejection`:** logged, process stays up (a transient rejection shouldn't kill the server).
- [x] **`uncaughtException`:** logged, exits 1 (state is unknown).
- [x] **`startServer().catch`:** a startup failure exits non-zero (a logged-and-swallowed failure previously exited 0, which a platform could treat as a healthy deploy).
- [x] No code change; tree unchanged from Phase 910 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 912: Rate-limit/spend-budget coverage audit (clean)

- [x] **Every tRPC procedure is rate-limited** (30+ `checkRateLimit` calls across `routers.ts`, `discovery.ts`, `trending.ts`), with tighter limits on expensive/abuse-prone endpoints (`sync.push` 30/min, `health.check` 5/min, `products.parse` 10/min, `trending.refresh` 2/min).
- [x] **Every LLM/image/parse endpoint consumes the spend budget:** `discovery.discover` (server-funded only), `trending.refresh`, `llm.test` (server-funded only), `insights.get` (server-funded only), `images.get`, `products.parseUrl`. A BYO-LLM key skips the budget (the user pays).
- [x] **Public share endpoint** has a dual limit (per-IP + per-token).
- [x] No code change; tree unchanged from Phase 911 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 913: Server core/mappers audit (clean)

- [x] **`_core/context.ts`:** auth is optional (only a 403 is swallowed); the `x-device-id` header is clamped to the column width (128) so an oversized value is a clean reject, not a 500; the session-claim device id wins over the header.
- [x] **`_core/cookies.ts`:** `Secure` is only trusted from `X-Forwarded-Proto` when `trust proxy` is enabled; a host-only cookie is used unless a parent domain is explicitly configured (guessing breaks on public-suffix hosts).
- [x] **`_core/env.ts`:** production requires `JWT_SECRET`; otherwise an ephemeral per-process random secret (a hard-coded fallback let anyone forge sessions).
- [x] **`_core/heartbeat.ts`:** callback paths must start with `/api/scheduled/`.
- [x] **`notifications/mappers.ts`:** preserves the client's `utcOffsetMinutes` (dropping it evaluated quiet hours in the server timezone).
- [x] No code change; tree unchanged from Phase 912 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 914: Server core-scaffolding audit (clean)

- [x] **`_core/storageProxy.ts`:** `isValidStorageKey` rejects traversal, absolute paths, URLs, backslashes, control chars, and empty/`.`/`..` segments (without it the proxy forwards an attacker-controlled `path` to the forge presign endpoint and 307-redirects to the result); `fetchWithTimeout`.
- [x] **`_core/systemRouter.ts`:** `notifyOwner` is `adminProcedure`-gated.
- [x] **`_core/dataApi.ts` / `_core/voiceTranscription.ts`:** unreachable framework scaffolding (no callers) — hands-off per AGENTS.md.
- [x] No code change; tree unchanged from Phase 913 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 915: Config-reference resolution audit (clean)

- [x] Every `require`/preset/plugin in `metro.config.js`, `babel.config.js`, and `tailwind.config.js` resolves: `expo/metro-config`, `nativewind/metro`, `./scripts/metro-resolver`, `babel-preset-expo`, `nativewind/babel`, `react-native-worklets/plugin`, `nativewind/preset`, `./theme.config`. The cheerio browser build and the `browser.web.ts` stub both exist.
- [x] `tailwind.config.js` content globs cover `app/`, `components/`, `lib/`, `hooks/`; `theme.config.js` exports `themeColors`/`spacing`/`radius`.
- [x] No code change; tree unchanged from Phase 914 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 916: Full-stack browser integration (clean)

- [x] Built the web export + server bundle, migrated a fresh DB, and drove the SPA in headless Chromium against the **real API server** (same-origin). **7/7 passed:** SPA shell renders, browser register → login → `/api/auth/me` authenticated, `sync.push` → `sync.pull` round-trip, and **zero JS errors** during the flow.
- [x] Two earlier "failures" were harness mismatches, not bugs: the bundle baked `localhost:3000` from `.env` while the test server ran on another port, and the **CSP correctly blocked the cross-origin call** (`connect-src 'self' <configured API>`). Re-running same-origin passed cleanly. Also re-confirmed the documented `expo export --clear` gotcha (a stale `127.0.0.1:4650` from a prior build's Metro cache).
- [x] No code change; tree unchanged from Phase 915 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 917: Rust merge/import audit (clean)

- [x] **`merge_listings`:** compares parsed instants (`parse_iso_to_epoch_ms`), not strings; `listing_distributor_id` returns `None` (not `""`) for a missing id so two id-less listings don't collide; keeps id-less and disk-only listings.
- [x] **`merge_watchlist`:** merges by product id, keeping the disk listings' newer checks (the poller refreshed them after the UI snapshot).
- [x] **`is_allowed_storage_key`:** allowlists the six mirrored keys.
- [x] **`export_watchlist`:** normalizes a never-written collection (Null → `[]`) so the app can restore its own export on a fresh profile; strips the device-local BYO-LLM key.
- [x] No code change; tree unchanged from Phase 916 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 918: Rust helper audit (clean)

- [x] **`parse_iso_to_epoch_ms`:** Howard Hinnant civil-date conversion; validates separators and month/day ranges; returns None for anything unparseable. (It ignores a timezone offset suffix, but every internal writer emits `Z`/`.mmmZ`, and `sanitizeHistoryPoints` enforces the canonical form server-side.)
- [x] **`export_to_csv`:** returns `Err("CSV export not yet implemented")` — but it is **unreachable**: the desktop CSV export runs in the renderer (`watchlistToCsv` in `Settings.tsx`), and nothing invokes `export_watchlist` with `format: "csv"` (only `format: "json"` in `import-export.ts`). Dead stub, not a bug.
- [x] **`strip_device_local_settings` / `array_or_empty` / `object_or_empty`:** tested.
- [x] No code change; tree unchanged from Phase 917 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 919: CI workflow / doc-count sync (clean)

- [x] **CI service config matches the tests:** the MySQL service (`psf_test`, root/root, 3306) matches both `DATABASE_URL` and `TEST_DATABASE_URL`; `scripts/test-db.mjs` discovers every `RUN_DB_TESTS` file; the `rust` job installs the GTK/WebKit headers and runs test/fmt/clippy.
- [x] **Stale counts fixed:** the `rust` job comment said "71 tests" (now 72) and AGENTS.md said "~2670 tests" (now 2682). Both corrected; the AGENTS.md drift guard still passes.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2682 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 920: tRPC client audit (clean)

- [x] **Mobile + desktop `trpc.ts`:** `byoLlmHeaders` clamps the provider to the server-accepted union (the value comes from persisted/imported settings, so it isn't guaranteed); returns `{}` for Forge or unreadable settings; `trpcHeaders` carries `Authorization: Bearer` + `x-device-id`; the `revokedDeviceLink` detects `DEVICE_REVOKED_ERR_MSG` and signs out.
- [x] **Mobile timeouts:** 4s background / 15s foreground (an unreachable server would otherwise hang until the OS TCP timeout).
- [x] **Desktop `api-base.ts`:** `VITE_API_BASE_URL` with a trailing-slash strip.
- [x] No code change; tree unchanged from Phase 919 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 921: Parser/fixture parity audit (clean)

- [x] `tests/scrapers/model-gate-conformance.test.ts` already enforces **exact** parser↔fixture parity: `withFixtures.map(id).sort()` must equal `PARSERS.map(id).sort()` (fixtures are named `<distributorId>-<region>.html`). 25 parsers ↔ 25 fixtures, no orphans. (An ad-hoc scan comparing parser variable names to distributor ids was misleading; the guard is authoritative.)
- [x] No code change; tree unchanged from Phase 920 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 922: Logging-hygiene audit (clean)

- [x] **No stray `console.log` in production paths:** the only mobile one is `debugLog` (guarded by `__DEV__`); the server logs are startup/port messages.
- [x] **No sensitive values logged:** storage warnings log only the key name (never the payload); auth logs are generic (`"Missing session cookie"`, `"Session verification failed"`, `"change-password failed"`) — no password/token/secret values.
- [x] No code change; tree unchanged from Phase 921 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 923: Android release-config audit (clean)

- [x] **Custom plugins registered + exist:** `with-android-release-signing` (persists the release signingConfig across `expo prebuild --clean`) and `with-android-cleartext-traffic`; both have tests.
- [x] **Cleartext trade-off:** the plugin sets `android:usesCleartextTraffic="true"` globally. Production bakes an HTTPS API URL (`scripts/android-release.sh`), so the app makes no cleartext request in production; the flag also supports the BYO-LLM `ollama-local` feature (a user's `http://192.168.x.x` URL). The comment's "only relaxes dev" is slightly loose but the practical effect is dev/local-only.
- [x] **`expo-background-task` plugin** injects the iOS background modes (without it `registerTaskAsync` silently no-ops on release builds).
- [x] No code change; tree unchanged from Phase 922 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 924: Incomplete-work-marker audit (clean)

- [x] Only three markers exist: a leftover template `// TODO: add feature queries here` at the end of `server/db.ts` (removed — dead guidance in a mature codebase), and two Rust CSV stubs (`import`/`export` "not yet implemented"). Both Rust stubs are **unreachable**: the desktop CSV import/export runs in the renderer (`lib/csv.ts`), and nothing invokes `import_watchlist`/`export_watchlist` with `format: "csv"`.
- [x] No `FIXME`/`HACK`/`@deprecated`/`unimplemented` in the app code.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2682 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 925: `lib/_core` contract audit (clean)

- [x] **`_core/auth.ts`:** native uses `SecureStore`, web uses cookie auth (returns null); logs token *presence*, never the value; `setSessionToken` rethrows on failure (callers must know).
- [x] **`_core/api.ts`:** `apiCall`/`exchangeOAuthCode`/`logout`/`getMe`/`establishSession` — the app's `use-auth` wraps these with the device header.
- [x] Hands-off per AGENTS.md; the app-side wrappers were audited in earlier phases.
- [x] No code change; tree unchanged from Phase 924 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 926: Rust dependency security audit — 2 vulnerabilities fixed

- [x] `cargo audit` found **2 vulnerabilities** (both transitive via Tauri's HTTP stack): `h2` 0.4.15 (unbounded empty DATA frames, DoS) and `rustls` 0.23.43 (TLS 1.3 handshake messages accepted across encryption-level boundaries). Plus 9 unmaintained/yanked warnings.
- [x] **Fixed** via `cargo update -p h2 --precise 0.4.16` and `cargo update -p rustls --precise 0.23.45` (rustls-webpki also bumped). `cargo audit` now reports **0 vulnerabilities**.
- [x] Verified: `cargo test` **72 passed**, clippy 0 warnings, fmt clean; desktop `tsc 0`, **289 passed**.

## Phase 927: `shared/` audit (clean)

- [x] **`shared/_core/errors.ts`:** `HttpError` + convenience constructors (hands-off).
- [x] **`shared/const.ts`:** all client/server payload caps live here (AGENTS.md rule) — `MAX_UPLOAD_*`, `SYNC_PUSH_*`, `MAX_UPLOAD_HISTORY_POINTS`, `MAX_DISCOVERY_QUERY`, `MAX_PLAUSIBLE_PRICE`/`isPlausiblePrice`.
- [x] **`shared/oauth-state.ts`:** a client-side base64 state helper — **test-only dead code** (the server signs its own state envelope in `_core/oauth.ts`); no production importer.
- [x] No code change; tree unchanged from Phase 926 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 928: Desktop top-level module audit (clean)

- [x] **`background.ts`:** poller start/stop + typed event listeners (`listing-updated`, `prices-checked`, `price-drops-triggered`) returning `UnlistenFn`.
- [x] **`notifications.ts`:** Tauri `send_notification` with a web-display fallback that reports whether the browser **actually** displayed it (returning `true` unconditionally made callers consume state for an unseen notification); `onNotificationActivated` validates the route starts with `/`.
- [x] No code change; tree unchanged from Phase 927 (`tsc 0`, lint 0 errors / 157 warnings, `2682 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 929: Coverage-provider crash (local node_modules residue)

- [x] **Gap found:** `vitest --coverage` crashed with `TypeError: (0, brace_expansion_1.expand) is not a function` in `@vitest/coverage-v8`'s `getUntestedFiles`. Root cause: a **stale nested `node_modules/@vitest/coverage-v8/node_modules`** left over from the Phase-834 override bisecting — the override was removed, but the broken `brace-expansion@2.0.2` copy (which the bundled `minimatch` needs at `^5.0.2`) persisted locally.
- [x] **Fix:** removed the stale nested directory and re-ran `pnpm install`. `pnpm-lock.yaml` was already correct (only `brace-expansion@1.1.21` and `5.0.12`), so a fresh CI install is unaffected. Coverage now runs and writes `coverage-summary.json`.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2682 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 930: Coverage-driven gap — clearDistributorBreaker untested

- [x] **Gap found:** coverage showed `lib/scrapers/breaker-clear.ts` at **0%** — `clearDistributorBreaker` (the Settings "Re-enable" action) was only referenced by source-scan tests, never exercised behaviorally. Its doc comment warns that clearing the wrong store leaves the real breaker in cooldown, yet nothing verified the clear.
- [x] **Fix:** added `tests/breaker-clear.test.ts` (clears the given adapter's entry + persisted list; no-op for an unknown distributor). Proven non-vacuous: removing the `store.clear` call fails the test.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2684 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 931: Coverage config scanned Rust build artifacts

- [x] **Gap found:** `vitest.config.ts` had no `coverage.exclude`, so `coverage.all` walked the whole tree including `desktop/src-tauri/target/**` (thousands of generated Rust/doc/Playwright files) — the report was unusable and `getUntestedFiles` was slow/fragile.
- [x] **Fix:** added a `coverage.exclude` for `desktop/**`, `node_modules/**`, `dist*/**`, `coverage/**`, `*.config.*`, `*.d.ts`. The report is now 733 app files (no Rust artifacts); the 130 zero-coverage files are React components/screens (integration-tested via the browser click-through, not unit tests).
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2684 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 932: Partial-coverage audit (clean)

- [x] **`lib/backup-files.ts` (38%):** a platform wrapper (web download / native DocumentPicker); the untested branch is the native one, exercised only on device.
- [x] **`shared/src/fx.ts` (49%):** the pure stub module; `lib/fx.ts` overrides `loadFxRates`/`refreshFxRates`/`maybeRefreshFxRates` with persistence, and `tests/fx-client.test.ts` covers them thoroughly (timeout, malformed response, fresh/stale skip, single-flight dedup, keep-last-known).
- [x] No code change; tree unchanged from Phase 931 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 933: Desktop hooks audit (clean)

- [x] **`use-storage.ts`:** `loadedRef` distinguishes the first-load spinner from later refreshes (the Rust poller emits `listing-updated` per scraped listing, so resetting `loading` each time blanked the page N times per sweep); the listener is unlistened on unmount.
- [x] **`use-connection.ts`:** probes the dependency-free `/api/health` (probing `fx.get` made connectivity depend on a rate-limited query); 3s timeout cleared in `finally`; 60s refetch + window-focus refetch.
- [x] **`use-toast.ts`:** clears the previous timer on each new toast.
- [x] No code change; tree unchanged from Phase 932 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 934: Desktop components audit (clean)

- [x] **`ConnectionBadge` / `TimeRangeChips` / `TagFilterRow`:** `aria-label`/`role` on every control (radiogroup, tag select/deselect, match-mode, clear).
- [x] **`Sidebar`:** alerts badge effect with catch; `aria-label` per nav item.
- [x] **`TrendingSection`:** `loadError` state with a retry button; `addedIds` set; aria-labels per card action.
- [x] **`search-chrome.tsx`:** recent-search persistence with try/catch and a cap.
- [x] **`EmptyState` / `LoadingSpinner` / `StockBadge`:** presentational.
- [x] No code change; tree unchanged from Phase 933 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 935: Desktop Health/SharedWatchlist/Stats audit (clean)

- [x] **`Health.tsx`:** `testingRef` double-submit guard; progress clamped to `[0,100]` and finite; Tauri event listener unlistened in `finally`; server-side fallback when Tauri is unavailable; stats persistence best-effort.
- [x] **`SharedWatchlist.tsx`:** `adding` guard; `addedIds` set; display-currency read with catch.
- [x] **`Stats.tsx`:** lazy-loaded cards with `Suspense`; null-products loading state.
- [x] No code change; tree unchanged from Phase 934 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 936: Expo config / doctor audit (clean)

- [x] `npx expo config --type public` resolves with no errors/warnings; `web.output: "single"` (as AGENTS.md requires); the custom plugins and asset paths resolve.
- [x] `npx expo-doctor` — **18/18 checks passed, no issues detected**.
- [x] No code change; tree unchanged from Phase 935 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 937: Skipped-test audit (clean)

- [x] No `it.skip`/`describe.skip`/`it.todo`/`xit` anywhere — the only skips are 8 `describe.skipIf(!runDbTests)` blocks (DB-gated).
- [x] With `RUN_DB_TESTS=1`: **2711 passed, 0 skipped**; without: **2684 passed, 27 skipped** — the 27 are exactly the DB-gated tests, all of which run when the DB is available. No silently disabled coverage.
- [x] No code change; tree unchanged from Phase 936 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 938: Mutation pass — sync collection-rank cursor gap

- [x] A mutation batch on the server notification/sync logic found `SYNC_COLLECTION_ORDER` (the composite cursor's collection rank) untested: emptying it survived, because the existing `listChangedItems` tests use distinct server stamps where the rank never matters.
- [x] **Fix:** added a DB test that inserts one row per collection with an **identical** stamp (so the rank decides order) and drains with a page size of 1, asserting every item is delivered exactly once in the deterministic `(stamp, collection, id)` order. Proven non-vacuous: emptying `SYNC_COLLECTION_ORDER` fails the test.
- [x] The other mutations (evaluate blocking, digest hold, dedup bucket, pull cap) were killed.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2684 passed**; DB suite **8 files / 31 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 939: tRPC auth-coverage audit (clean)

- [x] **`protectedProcedure`** on every mutating/user-scoped route: `deleteAccount`, `sync.pull`/`push`, `prices.uploadHistory`, `notifications.*`, `devices.*`, `sharedWatchlists.*` (except the public `get`), `discovery.discover`.
- [x] **`adminProcedure`** on `trending.refresh` and `system.notifyOwner`.
- [x] **Intentionally public** (read-only, rate-limited, budget-capped): `auth.me`/`logout`, `prices.get`, `health.check`, `fx.get`, `insights.get`, `images.get`, `products.parse`, `llm.test`, `sharedWatchlists.get`, `trending.get`. Each has a `checkRateLimit`; the LLM/image/parse ones also consume the spend budget (server-funded only).
- [x] **`sharedWatchlists.get`:** dual rate limit (IP + token); expiry enforced (row deleted); `membersOnly` requires owner/member.
- [x] No code change; tree unchanged from Phase 938 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; DB 8/31; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 940: DB-suite flake observation (no repro)

- [x] One `RUN_DB_TESTS=1 pnpm test` run showed 2 DB-test failures, but the suite then passed **70+ consecutive runs** (both `pnpm test:db` and the full `RUN_DB_TESTS=1 pnpm test`) with no reproduction. The failure was transient (likely DB contention during the first run after adding a new DB test, which inserts rows directly).
- [x] The new `sync-db` cursor test passed 8/8 targeted runs and 20+ full-suite runs.
- [x] No code change; tree unchanged from Phase 939 (`tsc 0`, lint 0 errors / 157 warnings, `2684 passed`; DB 8/31; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 941: Untested-module scan — testLlmConnection

- [x] **Gap found:** a scan for `lib/` modules not referenced by any test found exactly one — `lib/server-llm.ts` (`testLlmConnection`, used by both settings screens to probe the BYO-LLM key). It had no test.
- [x] **Fix:** added `tests/server-llm.test.ts` (unconfigured → null without a client; success; auth failure; throw → null). Proven non-vacuous: removing the `isServerConfigured` guard fails a case.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2688 passed**; desktop `289`; `cargo test` 72, clippy 0, fmt clean.

## Phase 942: Server-module coverage scan (clean)

- [x] Every `server/*.ts` module is referenced by at least one test; `server/notifications/*` (7) and `server/routers/*` (3) are all covered.
- [x] The 5 untested `server/_core/*` files (`dataApi`, `heartbeat`, `notification`, `systemRouter`, `voiceTranscription`) are hands-off framework scaffolding; `heartbeat` and `system.notifyOwner` are unreachable from app code.
- [x] No code change; tree unchanged from Phase 941 (`tsc 0`, lint 0 errors / 157 warnings, `2688 passed`; DB 8/31; desktop `289`; `cargo test` 72, clippy 0, fmt clean).

## Phase 943: Desktop untested-module scan — checkNotificationPermission

- [x] **Gap found:** a scan for `desktop/src/lib/` modules not referenced by any test found `notification-permission.ts` (`checkNotificationPermission`, used by the ProductDetail and Compare alert/watch flows to gate notification-backed records). The other two hits are stubs.
- [x] **Fix:** added `desktop/tests/notification-permission.test.ts` (granted, denied, request→granted, request→denied, Tauri fallthrough). Proven non-vacuous: removing the denied check fails a case.
- [x] Verified: root `tsc 0`, lint 0 errors / 157 warnings, **2688 passed**; desktop `tsc 0`, **294 passed**; `cargo test` 72, clippy 0, fmt clean.
