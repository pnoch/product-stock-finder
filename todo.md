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
- [x] Known pre-existing (out of scope): `desktop/tests/settings-webtoggle.test.tsx` 2 failures — empty Settings render, fails on clean tree, no dependency on touched files
