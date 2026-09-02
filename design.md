# Product Stock Finder — Design Document

## App Overview

A professional mobile app for tracking product availability and prices across 25 global electronics distributors (15 live parsers + 10 degraded/JS-heavy — health dashboard/classifyFetchStatus surfaces live status; resilientFetch escalates plain→browser with circuit breakers). Target users are IT professionals, procurement teams, and electronics enthusiasts who need to monitor hard-to-find products globally.

## Brand Identity

- **App Name:** Product Stock Finder
- **Tagline:** "Never miss a deal. Never miss a restock."
- **Primary Color:** #0F52BA (Sapphire Blue) — professional, trustworthy
- **Accent Color:** #00C896 (Emerald Green) — in-stock status, positive signals
- **Warning Color:** #F59E0B (Amber) — price changes, back-order
- **Error Color:** #EF4444 (Red) — out of stock
- **Background:** #0A0E1A (Deep Navy) dark / #F8FAFC light
- **Surface:** #131929 dark / #FFFFFF light
- **Typography:** System font (SF Pro on iOS, Roboto on Android)

## Screen List

### 1. Home / Dashboard (index)

- Summary cards: Total tracked items, In-stock count, Price alerts triggered
- Recent activity feed (stock changes, price drops)
- Quick-add product button (FAB)
- Pull-to-refresh for live updates

### 2. Watchlist (watchlist)

- All tracked products in a filterable list
- Each card shows: product name, best price, stock status badge, distributor count
- Sort by: name, price, date added, stock status
- Swipe to delete, tap to view details

### 3. Product Detail (product/[id])

- Product header with image, name, model number
- Stock status across all distributors (table view)
- Price history chart (sparkline)
- Set price alert button
- Open in browser button for each distributor
- Share product button

### 4. Search / Add Product (search)

- Search by model number or product name
- Pre-loaded catalog of popular networking/electronics products
- Manual add via AI paste (URL, model number, or free-text paragraph — `ManualAddSheet` + `products.parse` LLM extraction, then `discoverListings` live price discovery)
- Bulk import (CSV/paste)
- Recent searches

### 5. Alerts (alerts)

- List of all active price/stock alerts
- Toggle alerts on/off
- Alert history (triggered alerts)
- Notification settings

### 6. Settings (settings)

- App theme (light/dark/auto)
- Notification preferences
- Check interval (manual / hourly / daily)
- Currency display preference
- About / version info
- Rate the app
- Privacy policy

### 7. Rates — FX Rates (`app/(tabs)/rates.tsx`)

- `FxRateGrid` — 2-column grid of `FxSparklineCard` per currency (flag + current rate + % change + sparkline from `history`).
- Data: `getFxHistory()` (AsyncStorage `fx_rates` history), `EXCHANGE_RATES` fallback, `getFxChange(history)` for 24h delta; pull-to-refresh calls `refreshFxRates()` then reloads history.
- Header shows `Last updated …` via `formatLastRefreshed`; empty state "No data yet — rates update hourly".
- Live FX: server `fx.get` (1h TTL, single-flight) → `loadFxRates`/`maybeRefreshFxRates` at launch + Settings refresh; `setExchangeRates` overlay.

### 8. Statistics (`app/stats.tsx`)

- Entry: "View statistics" from Watchlist `SummaryCard`; back button + share (Text/Image via `StatsShareCard` capture).
- 7 cards: `MoversCard` (top 5 drops/gainers by |%|, window 7/30/All via `computeMovers`), `BasketValueCard` (sum of cheapest in-stock per product in display currency, `basketAlertThreshold` + `BasketAlertSheet`), `StockHealthCard` (`inStockPct`, fully out-of-stock / back-order-only counts), `DataFreshnessCard` (avg history points, stale >7d, never-checked, oldest check), `DigestCard` (weekly/daily `computeDigest` — value delta, movers, new/removed), `InsightsCard` (`computeProductInsights` — all-time lows, streaks, volatility), `DropCalendarCard` (30-day heatmap via `computeDropCalendar`).
- States: loading spinner, `loadError` retry, empty watchlist CTA to `/search`.
- FX-aware: all price math converts via `convertPrice` (skips when FX missing).

### 9. Health (`app/(tabs)/health.tsx` + `app/health/[id].tsx`)

- Dashboard (`health.tsx`): filter chips (All/Working/Blocked/Error), `Test All` (concurrency 3, progress bar), rows show `uptime%`, trend glyph `▲/▼/–`, and status sparkline (`computeHealthStats` over capped `distributor_health_history`); tappable → drill-down.
- Drill-down (`health/[id].tsx`): summary card (count, first/last probe `computeHealthSummary`, avg response time, timeline strip `timelineSegments`), day-grouped sample list (`groupSamplesByDay` — newest day first, per-day working %).
- Probe scheduling: `HEALTH_PROBE_TASK` (expo-background-task) on `checkInterval` (hourly/daily, manual unregisters) via `registerHealthProbeTask` / `syncBackgroundTasks`; `testAllDistributors` upgraded to `resilientFetch` with shared `createStorageBreakerStore` (`distributor_breaker`).
- Circuit breaker: `resilientFetch` (retry/backoff, plain→browser escalation, `BrowserUnavailableError` fast-fail, blocked cooldown 30m×1.5ⁿ capped 2h, transient cooldown after 3 failures; `classifyFetchStatus`/`BLOCKED_MARKERS` single source); `classifyResult` → `classifyFetchStatus`, `classifyProbeOutcome` maps `FetchOutcome` (ok/blocked/skipped/error) → `HealthStatus` (working/blocked/error).
- History: rolling 30-day / 720-sample cap (`pruneHealthHistory`), per-distributor probe model (`CRS804-4DDQ-hRM` / `CRS326-24S+2Q+RM` via `getProbeModel`).
- Alerts: `detectHealthAlert` (3× non-working after working) + `detectHealthRecovery` (working after 3× non-working) → `scheduleHealthAlert`/`scheduleHealthRecovery` (local + web + history `notification_history`, server mirrored via `PENDING_HEALTH_EVENTS`); gated by `healthAlerts` setting + in-app Notification Center (health type) + web push.

## Key User Flows

### Flow 1: Add a Product to Watchlist

Home → FAB (+) → Search screen → Type model number → Select from results → Product added to watchlist → Confirmation toast

### Flow 2: Check Stock Status

Watchlist → Tap product card → Product Detail screen → View all distributors with stock status → Tap distributor → Opens in browser

### Flow 3: Set a Price Alert

Product Detail → "Set Alert" button → Enter target price → Confirm → Alert saved → Notification when price drops below threshold

### Flow 4: View Price History

Product Detail → Scroll to price chart → View 7/30/90 day history → Identify best buying time

## Navigation Structure

Bottom Tab Bar (5 tabs):

1. **Home** (house icon) — Dashboard
2. **Watchlist** (list icon) — All tracked products
3. **Alerts** (bell icon) — Notifications & alerts (Alerts / Reminders / Notifications)
4. **Rates** (dollarsign icon) — FX rates history (`FxRateGrid`)
5. **Settings** (gear icon) — App settings

Stack screens (outside tabs): `product/[id]` (detail), `compare/[id]` (multi-distributor chart), `search` (add product + bulk/manual), `stats` (Statistics — 7 cards), `health` (Health dashboard) + `health/[id]` drill-down, `oauth/callback`, `dev/theme-lab`.

## Component Design

### Product Card

- Rounded corners (12px), subtle shadow
- Left: product thumbnail or category icon
- Center: product name (bold), model number (muted), best price (large, colored)
- Right: stock status badge (green/amber/red pill)
- Bottom row: distributor count, last checked timestamp

### Distributor Row

- Distributor name + country flag emoji
- Price in local currency + converted THB
- Stock status badge
- "Visit" button (external link)

### Stock Status Badge

- ✅ Green pill: "In Stock"
- 🟡 Amber pill: "Back Order" + expected date
- 🔴 Red pill: "Out of Stock"
- ⚪ Gray pill: "Unknown"

## Pre-loaded Distributor Database (25 sites)

Regions covered: USA, Europe (UK, Germany, Poland, Greece, EU), Asia-Pacific (Malaysia, Singapore, Hong Kong, Australia), Middle East (UAE), Africa (South Africa)

Key distributors pre-loaded:

- Server2U (Malaysia)
- Linitx (UK)
- Inter Projekt (Poland)
- NAS Store EU
- Aerial.net (Greece)
- MikroTik Store EU (Germany)
- MiRO (South Africa)
- Gear-Up.me (UAE)
- Baltic Networks (USA/Canada)
- Link Technologies (USA)
- Winncom (USA)
- B&H Photo (USA)
- DuxTel (Australia)
- WISP (Australia)
- PB Tech (New Zealand)
- GoWiFi (New Zealand)
- Getic (Greece)
- 100MEGA (Czech Republic)
- HellasCom (Greece)
- ROC-NOC (USA)

## Pre-loaded Product Catalog

Initial catalog focused on MikroTik and networking equipment:

- MikroTik CRS804-4DDQ-hRM (400G Switch)
- MikroTik CCR2216-1G-12XS-2XQ
- MikroTik CRS518-16XS-2XQ
- MikroTik RB5009UG+S+IN
- MikroTik hEX S
- Ubiquiti UniFi Dream Machine Pro
- Ubiquiti UniFi Switch Pro 48
- Intel X710-DA2 NIC
- Mellanox ConnectX-6
