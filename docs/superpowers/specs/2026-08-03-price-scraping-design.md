# Price Scraping Design Spec

**Date:** 2026-08-03
**Status:** Approved
**Scope:** Real-time price scraping from 25 global electronics distributors

## Overview

Implement real price scraping so the app shows live prices, stock status, and price history instead of seeded sample data. Scraping runs client-side on both desktop (Rust) and mobile (TypeScript), with one parser per distributor, configurable check intervals (default 1 hour), and graceful degradation when sites are unavailable.

## Architecture

### Approach: Parallel Independent Scrapers

Each platform implements its own set of 25 parsers independently:

- **Desktop:** Rust with `reqwest` + `scraper` crate
- **Mobile:** TypeScript with `fetch` + `cheerio`

This follows the existing StorageAdapter pattern (platform-specific implementations with shared types).

### Directory Structure

```
lib/scrapers/               Shared types and registry
  types.ts                  ScrapeResult, ScraperConfig, ParserFn types
  registry.ts               Maps distributor IDs to parser configs
  utils.ts                  Currency detection, stock status inference

desktop/src-tauri/src/scrapers/   Desktop Rust scrapers
  mod.rs                   Module exports
  server2u.rs              One file per distributor
  linitx.rs
  interprojekt.rs
  ... (25 total)

lib/scrapers/mobile/        Mobile TypeScript scrapers
  server2u.ts              One file per distributor
  linitx.ts
  interprojekt.ts
  ... (25 total)
```

## Data Model

### ScrapeResult

```typescript
interface ScrapeResult {
  price: number;
  currency: string; // "USD", "EUR", "GBP", "MYR", etc.
  stockStatus: StockStatus; // "in_stock" | "back_order" | "out_of_stock"
  expectedDate?: string; // "Sept 15, 2026" if back_order
  url: string; // product page URL
}
```

### DistributorParser (shared config)

```typescript
interface DistributorParser {
  id: string; // "server2u-my"
  baseUrl: string; // "https://server2u.com"
  buildSearchUrl: (model: string) => string;
  parsePrice: (html: string) => ScrapeResult | null;
  rateLimitMs: number; // min ms between requests
}
```

### Data Flow

```
Background trigger
  → Scraper fetches URL (with rate limiting)
  → Parses HTML with CSS selectors
  → Returns ScrapeResult
  → Updates DistributorListing (price, stock, lastChecked)
  → Appends PricePoint to priceHistory
  → Price alert check runs
  → UI refreshes
```

## Parser Interface

Each distributor parser is a function: `(productId, modelNumber) => Promise<ScrapeResult | null>`

### Desktop (Rust)

```rust
pub async fn scrape(model: &str) -> Result<ScrapeResult, ScrapeError> {
    let url = format!("https://server2u.com/search?q={}", model);
    let html = fetch_with_rate_limit(&url, 2000).await?;
    parse_html(&html)
}

fn parse_html(html: &str) -> Result<ScrapeResult, ScrapeError> {
    let document = scraper::Html::parse_document(html);
    // CSS selectors specific to this distributor
}
```

### Mobile (TypeScript)

```typescript
export async function scrapeServer2U(
  model: string,
): Promise<ScrapeResult | null> {
  const url = `https://server2u.com/search?q=${model}`;
  const html = await fetchWithRateLimit(url, 2000);
  return parseHtml(html);
}

function parseHtml(html: string): ScrapeResult | null {
  const $ = cheerio.load(html);
  const price = parseFloat(
    $(".product-price")
      .text()
      .replace(/[^0-9.]/g, ""),
  );
  const stock = $(".stock-status").text().includes("In Stock")
    ? "in_stock"
    : "out_of_stock";
  return { price, currency: "MYR", stockStatus: stock, url: "..." };
}
```

## Background Task Integration

### Desktop (Rust)

- `check_all_prices` Tauri command — fetches all watched products across all distributors
- Called by: system tray "Check Now", background timer (configurable interval)
- Runs sequentially with per-distributor rate limiting (2-5s pauses)
- Updates localStorage via Tauri's `invoke` → JS bridge
- On completion: updates tray badge, fires price alerts

### Mobile (TypeScript/Expo)

- `background-price-check.ts` already defines `PRICE_CHECK_TASK`
- Updated flow: fetch → parse → update (instead of just comparing existing prices)
- Respects `checkInterval` setting (15m/1h/6h/manual)
- Guards `Platform.OS === "web"` (no background tasks on web)

### Scheduling

1. App launch → run check immediately if >1 hour since last check
2. Background task → runs at configured interval
3. Manual → user taps "Check Now" button
4. Each check: iterate watched products → for each product, iterate distributors → fetch + parse → update listing

### Concurrency

- Products processed in parallel (up to 3 concurrent fetches)
- Within each product, distributors are checked sequentially (avoid hammering one site)
- Per-distributor rate limit enforced via semaphore/delay

## Data Update Flow

For each product + distributor combination:

1. Fetch HTML, parse → get `ScrapeResult`
2. Find existing `DistributorListing` by `distributorId` + `productId`
3. Update fields: `price`, `stockStatus`, `expectedDate`, `lastChecked`, `url`
4. Append new `PricePoint` to `priceHistory`:
   ```typescript
   {
     date: (now.toISOString(), price, currency, stockStatus);
   }
   ```
5. If `priceHistory.length > 90` → trim to 90 days
6. Save updated product back to storage

### Price History Deduplication

- If today's price matches yesterday's price exactly → don't append duplicate
- If price changed → always append
- Stock status change → always append (even if price same)

### Last-Refreshed Tracking

- `Product.lastRefreshed` updated on each successful scrape cycle
- UI shows "Last refreshed: 2 hours ago" for transparency

## Rate Limiting & Anti-Blocking

### Rate Limits

- Per-distributor delay: 2-5 seconds between requests
- Global cap: max 3 concurrent fetches
- Respect `robots.txt` — check before first scrape, cache for 24h
- 429 response → exponential backoff (2s → 4s → 8s → skip)

### User-Agent Rotation

- Cycle through 5-6 common browser user-agents
- Random selection per request

### Request Headers

- Standard browser headers: `Accept`, `Accept-Language`, `Accept-Encoding`
- `Referer` set to distributor's homepage
- No cookies/sessions needed (public product pages)

### Failure Escalation

```
Attempt 1: normal request
Attempt 2: wait 2x longer, retry
Attempt 3: wait 4x longer, retry
Attempt 4+: skip this distributor this cycle, log warning
```

### Error Handling

- Failed fetch → log warning, keep last known price, continue
- Parse failure → same as above
- After 3 consecutive failures → mark as "temporarily unavailable", skip next cycle
- All failures → app continues with stale data, shows "last checked X ago"
- User can disable specific distributors in settings

## UI Integration

### New UI Elements

1. **"Check Now" button** (desktop: tray context menu, mobile: watchlist header)
   - Triggers immediate scrape
   - Shows spinner while running
   - Disables button during check

2. **Last-refreshed indicator** on product cards
   - "Checked 5m ago" / "Checked 2h ago" / "Checked yesterday"
   - Color: green (<1h), yellow (1-6h), red (>6h), gray (never)

3. **Scraper status dashboard** (Settings → Advanced)
   - Each distributor: ✅ OK / ⚠️ Stale / ❌ Failed
   - Last successful check time per distributor
   - Button to manually re-enable failed distributor

4. **Scrape progress indicator**
   - Desktop: tray tooltip "Checking 3/12 products..."
   - Mobile: subtle progress bar under watchlist header

### Existing UI Updates

- `StockBadge` reflects real-time data
- `PriceSparkline` charts populate with real price history
- Compare screen shows live cross-distributor prices

## Testing Strategy

### Unit Tests (per parser)

- Given saved HTML fixture → extract correct price, stock status, currency
- Given empty/broken HTML → return null gracefully
- Rate limit delay is respected

### Integration Tests

- Mock HTTP responses → test full scrape cycle
- Error handling: network failure, 404, 429, parse failure
- Price history append + deduplication logic
- Concurrent scraping with rate limiting

### Platform-Specific Tests

- Desktop (Rust): `cargo test` for each parser module
- Mobile (TypeScript): vitest for each parser + storage update logic

### Fixture Generation

- Script to save real HTML from each distributor (manual one-time capture)
- Store in `tests/fixtures/scrapers/{distributor-id}.html`
- Update fixtures when sites redesign

## Implementation Phases

### Phase 1: Shared Scraping Foundation

- Create `lib/scrapers/types.ts`, `registry.ts`, `utils.ts`
- Define parser interface and shared types
- Add scraper status to `AppSettings` type

### Phase 2: Desktop Rust Scrapers

- Add `reqwest`, `scraper` crates to Cargo.toml
- Implement 25 distributor parsers
- Add `check_all_prices` Tauri command
- Integrate with system tray and background timer

### Phase 3: Mobile TypeScript Scrapers

- Add `cheerio` dependency
- Implement 25 distributor parsers
- Update `background-price-check.ts` to use real scrapers
- Add "Check Now" trigger

### Phase 4: UI Integration

- Add last-refreshed indicator to product cards
- Add scraper status dashboard in Settings
- Add scrape progress indicator
- Update StockBadge and PriceSparkline with live data

### Phase 5: Testing & Hardening

- Write HTML fixtures for all 25 distributors
- Unit tests for each parser
- Integration tests for scrape cycle
- Rate limiting and error handling tests

## Distributors (25 total)

| ID                | Name                 | Country        | Region        | Website               |
| ----------------- | -------------------- | -------------- | ------------- | --------------------- |
| server2u-my       | Server2U             | Malaysia       | Asia-Pacific  | server2u.com          |
| linitx-uk         | Linitx               | UK             | Europe        | linitx.com            |
| interprojekt-pl   | Inter Projekt        | Poland         | Europe        | interprojekt.pl       |
| nasstore-eu       | NAS Store EU         | EU             | Europe        | nasstore.eu           |
| aerial-gr         | Aerial.net           | Greece         | Europe        | aerial.net            |
| mikrotikstore-de  | MikroTik Store EU    | Germany        | Europe        | mikrotik-store.eu     |
| miro-za           | MiRO Distribution    | South Africa   | Africa        | miro.co.za            |
| gearup-ae         | Gear-Up.me           | UAE            | Middle East   | gear-up.me            |
| balticnetworks-us | Baltic Networks      | US             | North America | balticnetworks.com    |
| linktechs-us      | Link Technologies    | US             | North America | shop.linktechs.net    |
| Winncom           | Winncom              | US             | North America | winncom.com           |
| bhphoto-us        | B&H Photo Video      | US             | North America | bhphotovideo.com      |
| duxtel-au         | DuxTel               | Australia      | Asia-Pacific  | store.duxtel.com      |
| wisp-au           | WISP                 | Australia      | Asia-Pacific  | wisp.net.au           |
| pbtech-nz         | PB Tech              | New Zealand    | Asia-Pacific  | pbtech.co.nz          |
| gowifi-nz         | GoWiFi               | New Zealand    | Asia-Pacific  | gowifi.co.nz          |
| getic-gr          | Getic                | Greece         | Europe        | getic.com             |
| 100mega-cz        | 100MEGA Distribution | Czech Republic | Europe        | b2b.100mega.com       |
| hellascom-gr      | HellasCom            | Greece         | Europe        | hellascom.gr          |
| rocnoc-us         | ROC-NOC              | US             | North America | roc-noc.com           |
| networkdevices-us | Network Devices Inc  | US             | North America | networkdevicesinc.com |
| flytec-us         | Flytec Computers     | US             | North America | flyteccomputers.com   |
| mbsiwav-ca        | MBS I-WAV            | Canada         | North America | mbsiwav.com           |
| multilink-us      | Multilink            | US             | North America | shop.multilink.us     |
| neobits-us        | Neobits              | US             | North America | neobits.com           |
