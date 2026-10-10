# Price Drop Leaderboard — Design Spec

**Date:** 2026-10-09
**Status:** Approved
**Version:** 5.18.0 (planned)

---

## Overview

A leaderboard showing the biggest price drops across electronics distributors. Two data sources: **Your Drops** (products on your watchlist, computed locally from price history) and **Global Drops** (aggregated from the server's price cache across all tracked products). Surfaced as a Home section preview (top 5) and a dedicated full screen (top 20).

**Goal:** Give users a daily reason to open the app beyond alerts. Leverage the unique 25-scraper price data to create a viral, shareable surface.

---

## Data Model

### Server Endpoint

New tRPC query: `prices.topDrops`

**Input:**
```typescript
{
  window: "24h" | "7d" | "30d"   // time range for measuring drops
  limit: number                   // max items (default 20)
  sortBy: "pct" | "abs"          // sort by % or $ drop
}
```

**Output:**
```typescript
interface PriceDrop {
  productId: string;
  productName: string;
  modelNumber: string;
  distributorId: string;
  distributorName: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
  dropPct: number;       // (previous - current) / previous * 100
  dropAbs: number;       // previous - current
  droppedAt: string;     // ISO date of the older price point
}
```

**Source:** Query `priceHistory` table (not `priceCache` — cache only has the latest price, no history). For each `(distributorId, modelNumber)` pair:
1. Find the latest price point (most recent `date`)
2. Find the earliest price point within the window (`date >= cutoff`)
3. Compute drop: `previousPrice - currentPrice`
4. Filter: only pairs where `currentPrice < previousPrice`
5. Join with product catalog for product names
6. Sort by `dropPct` or `dropAbs` based on `sortBy`
7. Return top `limit` items

**Schema reference:** `priceHistory` table has `(distributorId, modelNumber, date, price, currency, stockStatus, fetchedAt)`. Primary key is `(distributorId, modelNumber, date)`. The `date` column is a string like `"2026-10-09"` (day granularity). Index on `date` for efficient window queries.

### Local Computation (Your Drops)

Pure function: `computeLocalDrops(products, window, currency): PriceDrop[]`

**Logic:**
1. For each product in the watchlist, iterate all listings
2. For each listing, sort `priceHistory` by date ascending
3. Find the biggest price drop within the selected window (compare current price vs price at start of window)
4. Convert drops to the user's display currency using `convertPrice`
5. Sort by the selected metric, return top 20

**File:** `lib/price-leaderboard.ts`

---

## Screen Structure

### Home Section

**Component:** `components/price-drop-leaderboard.tsx`

**Layout:**
- Header row: "Biggest Drops" title + time-range chips (24h / 7d / 30d) + rank toggle (% / $)
- 5 product rows, each showing:
  - Product name (truncated)
  - Distributor badge (colored chip)
  - Drop percentage (green text, e.g. "−23%")
  - Drop absolute (muted text, e.g. "−$45")
  - Trend arrow (down = green, flat = gray)
- Footer: "See all →" link to `/drops`
- Data source: local when signed out, server when signed in
- Refresh: pulls fresh data on Home screen pull-to-refresh

**Position:** Below the Trending section, above "Available Now" on the Home screen.

### Full Screen

**Route:** `app/drops.tsx`
**Desktop:** `desktop/src/pages/Drops.tsx`

**Layout:**
- Top bar: back button + "Price Drops" title + share button
- Time-range chips: 24h / 7d / 30d (default: 7d)
- Rank toggle: % / $ (default: %)
- Tab selector: "Your Drops" / "Global Drops" (when signed in; just "Your Drops" when signed out)
- 20 product rows in a `FlatList` / virtual list, each showing:
  - Product image (32×32)
  - Product name + brand/model
  - Distributor name badge
  - Old price → new price (with arrow)
  - Drop percentage + absolute (right-aligned)
  - Mini sparkline (last 10 price points)
- Tap row:
  - If product is on watchlist → navigate to `/product/[id]`
  - If product is not on watchlist (global tab) → navigate to search for that product
- Empty state:
  - "Your Drops" tab: "No drops this period — add products to your watchlist to track price changes"
  - "Global Drops" tab: "No significant drops in this window — try a longer time range"
- Loading skeleton: 5 placeholder rows with shimmer

**Desktop variant:** Same data and controls. Rendered as a full page with Tailwind table layout (no virtualizer needed for 20 rows). Sidebar entry: "Drops" with `TrendingDown` icon after "Alerts".

---

## Navigation

### Mobile
- Home section: visible on Home tab (below Trending, above Available Now)
- Full screen route: `/drops` — accessible via "See all" from Home section
- No new tab (leaderboard is a content surface, not a primary action)

### Desktop
- Sidebar: new "Drops" entry after "Alerts" with `TrendingDown` icon
- Route: `/drops` in the HashRouter

### Web (SPA)
- Route: `/drops` — accessible via deep link or Home section

---

## Sharing

### Clipboard Share
`buildDropShareText(drops, window, sortBy): string`

Format:
```
📉 Price Drops (7d, by %)
1. MikroTik CRS326-24G-2S+ — $89 → $65 (−27%)
2. Ubiquiti U7 Pro — $189 → $149 (−21%)
...
via Product Stock Finder
```

Uses existing `copyTextWithFallback` helper.

### Server Share Link
New tRPC mutation: `prices.createDropShare`

Creates a `/drops/:token` public URL (like shared watchlists). Stores the query parameters (window, sortBy) and the computed drop list in the `trendingProducts` or a new `sharedDropLists` table. Token expires after 7 days.

Public page: `app/drops/[token].tsx` — read-only view of the shared leaderboard with a "Track these products" CTA.

---

## Server Implementation

### Router Addition

**File:** `server/routers/prices.ts`

Add `topDrops` query:
- Reads from `priceHistory` table (has day-granularity price points per distributor/product)
- For each `(distributorId, modelNumber)` pair:
  - Get the latest price within the window (`ORDER BY date DESC LIMIT 1`)
  - Get the earliest price within the window (`ORDER BY date ASC LIMIT 1`)
  - Compute drop if `latest.price < earliest.price`
- Filter to drops only, sort by `dropPct` or `dropAbs`
- Join with product catalog for product names/models
- Returns top N results
- Cached for 5 minutes (same pattern as `prices.get`)

### Schema

No schema changes needed — `priceHistory` already has all required columns:
- `(distributorId, modelNumber, date, price, currency, stockStatus, fetchedAt)`
- Primary key: `(distributorId, modelNumber, date)`
- Index on `date` for efficient window queries
- `date` is a day-string like `"2026-10-09"`

### Rate Limiting

Same as existing `prices.get` — per-device rate limit, no additional restrictions needed.

---

## Client Implementation

### New Files

| File | Purpose |
|------|---------|
| `lib/price-leaderboard.ts` | `computeLocalDrops` pure function |
| `components/price-drop-leaderboard.tsx` | Home section component |
| `app/drops.tsx` | Full screen route |
| `app/drops/[token].tsx` | Shared drop list public page |
| `desktop/src/pages/Drops.tsx` | Desktop full screen |
| `tests/price-leaderboard.test.ts` | Unit tests for `computeLocalDrops` |
| `tests/drops-screen.test.tsx` | Screen rendering tests |

### Modified Files

| File | Change |
|------|--------|
| `app/(tabs)/index.tsx` | Add `<PriceDropLeaderboard>` section |
| `app/_layout.tsx` | Register `/drops` route (already handled by Expo Router file-based routing) |
| `server/routers/prices.ts` | Add `topDrops` query |
| `server/routers.ts` | Re-export (automatic via existing pattern) |
| `desktop/src/components/Sidebar.tsx` | Add "Drops" nav entry |
| `desktop/src/App.tsx` | Register `/drops` route |

---

## Error Handling

- **Server unavailable:** Fall back to local-only mode (Your Drops only). Show a subtle "Offline — showing your products only" banner.
- **Empty price history:** Products with fewer than 2 data points are excluded from drop computation.
- **Currency mismatch:** All prices converted to display currency using `convertPrice` before ranking.
- **Rate limit hit:** Show cached results with a "Last updated" timestamp. Don't retry immediately.

---

## Testing Strategy

- **Unit tests:** `computeLocalDrops` with various windows, currencies, edge cases (no history, single point, no drops, all drops)
- **Integration tests:** Server `topDrops` query against test DB
- **Screen tests:** Home section renders, full screen renders, tab switching, share button
- **Wiring guard:** Pin that Home imports the component, server router has the query
- **Desktop parity guard:** Pin that Drops page exists, sidebar has the entry

---

## Out of Scope

- Push notifications for leaderboard changes (not an alert — it's a browsing surface)
- Personalized recommendations ("you might also like...")
- Social features (likes, comments, follows)
- Historical leaderboard snapshots ("what were last month's biggest drops")
- Cart/checkout integration (app hands off to distributor sites)