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
