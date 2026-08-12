# Stock Tracker Pro — TODO

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

- [x] Create distributor database (30+ distributors)
- [x] Build distributor row component
- [x] Implement stock status badges
- [x] Add "Open in Browser" functionality
- [x] Add manual stock check (refresh) functionality

## Phase 5: Price Comparison, Alerts & History

- [x] Build Alerts screen
- [x] Implement price alert creation and management
- [ ] Build price history chart (sparkline)
- [x] Add price comparison table
- [x] Implement local notifications for alerts

## Phase 6: Polish & App Store

- [x] Add pull-to-refresh on all screens
- [x] Add loading states and skeleton screens
- [x] Add empty states for all screens
- [x] Add haptic feedback
- [ ] Add share functionality
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
- [x] Mobile: launch sync on start + auth change (app/_layout.tsx), Account section + sync status in Settings
- [x] Desktop: react-query/tRPC deps, api-base + OAuth portal helpers, localStorage auth hook (use-auth), tRPC client, Tauri start_oauth loopback command (127.0.0.1:3420), App providers + launch sync, Account section + sync status in Settings
