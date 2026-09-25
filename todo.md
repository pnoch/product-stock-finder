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
