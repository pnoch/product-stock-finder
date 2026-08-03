# Price Scraping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real price scraping from 25 electronics distributors so the app shows live prices, stock status, and price history instead of seeded sample data.

**Architecture:** Parallel independent scrapers — Rust (reqwest + scraper) for desktop, TypeScript (fetch + cheerio) for mobile. One parser per distributor, shared types via `lib/scrapers/`. Configurable check intervals (default 1 hour), graceful degradation.

**Tech Stack:** Rust: reqwest, scraper, serde. TypeScript: cheerio, expo-background-task. Testing: vitest (TS), cargo test (Rust).

---

## File Structure

### Shared Types (`lib/scrapers/`)
- `lib/scrapers/types.ts` — ScrapeResult, DistributorParser interfaces
- `lib/scrapers/registry.ts` — maps distributor IDs to parser configs
- `lib/scrapers/utils.ts` — currency detection, stock text inference, rate limit helper

### Desktop Rust Scrapers (`desktop/src-tauri/src/scrapers/`)
- `desktop/src-tauri/src/scrapers/mod.rs` — module exports + shared fetch/parse logic
- `desktop/src-tauri/src/scrapers/server2u.rs` — one file per distributor (25 total)
- `desktop/src-tauri/src/scrapers/linitx.rs`
- ... (25 files)
- `desktop/src-tauri/src/lib.rs` — add `check_all_prices` Tauri command

### Mobile TypeScript Scrapers (`lib/scrapers/`)
- `lib/scrapers/server2u.ts` — one file per distributor (25 total)
- `lib/scrapers/linitx.ts`
- ... (25 files)
- `lib/background-price-check.ts` — update to use real scrapers

### UI Updates
- `app/product/[id].tsx` — add last-refreshed indicator
- `app/(tabs)/watchlist.tsx` — add "Check Now" button + progress
- `app/(tabs)/settings.tsx` — add scraper status dashboard

### Tests
- `tests/scrapers/server2u.test.ts` — one test per distributor (25 total)
- `tests/fixtures/scrapers/server2u.html` — HTML fixtures (25 total)

---

## Task 1: Shared Scraping Types

**Files:**
- Create: `lib/scrapers/types.ts`
- Modify: `lib/types.ts` (add ScraperStatus to AppSettings)

- [ ] **Step 1: Create shared scraping types**

```typescript
// lib/scrapers/types.ts
import { StockStatus } from "@/lib/types";

export interface ScrapeResult {
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string;
  url: string;
}

export interface DistributorParser {
  id: string;
  baseUrl: string;
  buildSearchUrl: (model: string) => string;
  parsePrice: (html: string) => ScrapeResult | null;
  rateLimitMs: number;
}

export interface ScrapeJobResult {
  distributorId: string;
  productId: string;
  result: ScrapeResult | null;
  error?: string;
  durationMs: number;
}

export interface ScrapeStats {
  totalChecks: number;
  succeeded: number;
  failed: number;
  lastCheckTime: string;
  distributorStatuses: Record<string, {
    lastSuccess: string | null;
    lastError: string | null;
    consecutiveFailures: number;
  }>;
}
```

- [ ] **Step 2: Add ScraperStatus to AppSettings**

In `lib/types.ts`, add to AppSettings interface:

```typescript
export interface AppSettings {
  theme: "light" | "dark" | "auto";
  displayCurrency: string;
  checkInterval: "manual" | "hourly" | "daily";
  notificationsEnabled: boolean;
  stockAlerts: boolean;
  priceAlerts: boolean;
  enabledDistributors?: string[]; // all enabled if undefined
  lastScrapeTime?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/scrapers/types.ts lib/types.ts
git commit -m "feat: add shared scraping types and ScraperStatus to AppSettings"
```

---

## Task 2: Shared Scraping Utilities

**Files:**
- Create: `lib/scrapers/utils.ts`

- [ ] **Step 1: Create shared utilities**

```typescript
// lib/scrapers/utils.ts
import { StockStatus } from "@/lib/types";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function inferStockStatus(text: string): StockStatus {
  const lower = text.toLowerCase();
  if (lower.includes("in stock") || lower.includes("available") || lower.includes("add to cart")) {
    return "in_stock";
  }
  if (lower.includes("back order") || lower.includes("backorder") || lower.includes("pre-order") || lower.includes("expected")) {
    return "back_order";
  }
  if (lower.includes("out of stock") || lower.includes("unavailable") || lower.includes("sold out")) {
    return "out_of_stock";
  }
  return "unknown";
}

export function extractCurrency(text: string): string | null {
  const symbols: Record<string, string> = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "R": "ZAR",
    "A$": "AUD",
    "NZ$": "NZD",
    "C$": "CAD",
    "RM": "MYR",
    "د.إ": "AED",
    "S$": "SGD",
    "HK$": "HKD",
    "฿": "THB",
  };
  for (const [symbol, code] of Object.entries(symbols)) {
    if (text.includes(symbol)) return code;
  }
  return null;
}

export async function fetchWithRateLimit(
  url: string,
  rateLimitMs: number
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

export function parsePriceFromText(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function extractExpectedDate(text: string): string | undefined {
  const patterns = [
    /(?:expected|available|back in stock)[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/,
    /([A-Za-z]+\s+\d{1,2},?\s*\d{4})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scrapers/utils.ts
git commit -m "feat: add shared scraping utilities (rate limiting, stock inference, price parsing)"
```

---

## Task 3: Parser Registry

**Files:**
- Create: `lib/scrapers/registry.ts`

- [ ] **Step 1: Create parser registry**

```typescript
// lib/scrapers/registry.ts
import { DistributorParser } from "./types";

// Import all parsers
import { server2uParser } from "./server2u";
import { linitxParser } from "./linitx";
import { interprojektParser } from "./interprojekt";
import { nasstoreParser } from "./nasstore";
import { aerialParser } from "./aerial";
import { mikrotikstoreParser } from "./mikrotikstore";
import { miroParser } from "./miro";
import { gearupParser } from "./gearup";
import { balticnetworksParser } from "./balticnetworks";
import { linktechsParser } from "./linktechs";
import { winncomParser } from "./winncom";
import { bhphotoParser } from "./bhphoto";
import { duxtelParser } from "./duxtel";
import { wispParser } from "./wisp";
import { pbtechParser } from "./pbtech";
import { gowifiParser } from "./gowifi";
import { geticParser } from "./getic";
import { megaParser } from "./mega";
import { hellascomParser } from "./hellascom";
import { rocnocParser } from "./rocnoc";
import { networkdevicesParser } from "./networkdevices";
import { flytecParser } from "./flytec";
import { mbsiwavParser } from "./mbsiwav";
import { multilinkParser } from "./multilink";
import { neobitsParser } from "./neobits";

export const PARSERS: DistributorParser[] = [
  server2uParser,
  linitxParser,
  interprojektParser,
  nasstoreParser,
  aerialParser,
  mikrotikstoreParser,
  miroParser,
  gearupParser,
  balticnetworksParser,
  linktechsParser,
  winncomParser,
  bhphotoParser,
  duxtelParser,
  wispParser,
  pbtechParser,
  gowifiParser,
  geticParser,
  megaParser,
  hellascomParser,
  rocnocParser,
  networkdevicesParser,
  flytecParser,
  mbsiwavParser,
  multilinkParser,
  neobitsParser,
];

export function getParserByDistributorId(distributorId: string): DistributorParser | undefined {
  return PARSERS.find((p) => p.id === distributorId);
}

export function getAllParserIds(): string[] {
  return PARSERS.map((p) => p.id);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scrapers/registry.ts
git commit -m "feat: add parser registry with all 25 distributors"
```

---

## Task 4: First Desktop Parser (Server2U) — Template

**Files:**
- Create: `desktop/src-tauri/src/scrapers/mod.rs`
- Create: `desktop/src-tauri/src/scrapers/server2u.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create scrapers module with shared logic**

```rust
// desktop/src-tauri/src/scrapers/mod.rs
pub mod server2u;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeResult {
    pub price: f64,
    pub currency: String,
    pub stock_status: String,
    pub expected_date: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeJobResult {
    pub distributor_id: String,
    pub product_id: String,
    pub result: Option<ScrapeResult>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

pub async fn fetch_html(url: &str, rate_limit_ms: u64) -> Result<String, reqwest::Error> {
    tokio::time::sleep(tokio::time::Duration::from_millis(rate_limit_ms)).await;
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .send()
        .await?;
    resp.text().await
}

pub fn infer_stock_status(text: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("in stock") || lower.contains("available") || lower.contains("add to cart") {
        "in_stock".to_string()
    } else if lower.contains("back order") || lower.contains("backorder") || lower.contains("pre-order") {
        "back_order".to_string()
    } else if lower.contains("out of stock") || lower.contains("unavailable") || lower.contains("sold out") {
        "out_of_stock".to_string()
    } else {
        "unknown".to_string()
    }
}

pub fn parse_price_from_text(text: &str) -> Option<f64> {
    let cleaned: String = text.chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',')
        .collect();
    let cleaned = cleaned.replace(',', "");
    cleaned.parse::<f64>().ok()
}
```

- [ ] **Step 2: Create Server2U parser**

```rust
// desktop/src-tauri/src/scrapers/server2u.rs
use super::{ScrapeResult, fetch_html, infer_stock_status, parse_price_from_text};
use scraper::{Html, Selector};

pub async fn scrape(model: &str) -> Result<ScrapeResult, String> {
    let url = format!("https://server2u.com/search?q={}", model);
    let html = fetch_html(&url, 2000)
        .await
        .map_err(|e| format!("Fetch failed: {}", e))?;
    parse_html(&html, &url)
}

fn parse_html(html: &str, url: &str) -> Result<ScrapeResult, String> {
    let document = Html::parse_document(html);
    
    let price_selector = Selector::parse(".product-price, .price, [data-price]").map_err(|e| e.to_string())?;
    let stock_selector = Selector::parse(".stock-status, .availability, .stock").map_err(|e| e.to_string())?;
    
    let price_text = document.select(&price_selector)
        .next()
        .map(|el| el.text().collect::<String>())
        .ok_or("Price not found")?;
    
    let price = parse_price_from_text(&price_text)
        .ok_or_else(|| format!("Could not parse price: {}", price_text))?;
    
    let stock_text = document.select(&stock_selector)
        .next()
        .map(|el| el.text().collect::<String>())
        .unwrap_or_default();
    
    let stock_status = infer_stock_status(&stock_text);
    
    Ok(ScrapeResult {
        price,
        currency: "MYR".to_string(),
        stock_status,
        expected_date: None,
        url: url.to_string(),
    })
}
```

- [ ] **Step 3: Update lib.rs with check_all_prices command**

In `desktop/src-tauri/src/lib.rs`, add:

```rust
mod scrapers;

#[tauri::command]
async fn check_all_prices(watched_products: Vec<WatchedProduct>) -> Vec<ScrapeJobResult> {
    let mut results = Vec::new();
    for product in &watched_products {
        for distributor_id in &product.distributor_ids {
            let start = std::time::Instant::now();
            let result = match distributor_id.as_str() {
                "server2u-my" => scrapers::server2u::scrape(&product.model_number).await,
                _ => Err("Parser not implemented".to_string()),
            };
            let duration = start.elapsed().as_millis() as u64;
            results.push(ScrapeJobResult {
                distributor_id: distributor_id.clone(),
                product_id: product.id.clone(),
                result: result.ok(),
                error: result.err(),
                duration_ms: duration,
            });
        }
    }
    results
}
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cd desktop/src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/scrapers/ desktop/src-tauri/src/lib.rs
git commit -m "feat: add first desktop scraper (Server2U) with shared module structure"
```

---

## Task 5: First Mobile Parser (Server2U) — Template

**Files:**
- Create: `lib/scrapers/server2u.ts`

- [ ] **Step 1: Create Server2U mobile parser**

```typescript
// lib/scrapers/server2u.ts
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

async function parseHtml(html: string, url: string): Promise<ScrapeResult | null> {
  // Dynamic import cheerio to avoid bundling issues
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  
  const priceText = $(".product-price, .price, [data-price]").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;
  
  const stockText = $(".stock-status, .availability, .stock").first().text();
  const stockStatus = inferStockStatus(stockText);
  
  return {
    price,
    currency: "MYR",
    stockStatus,
    url,
  };
}

export const server2uParser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) => `https://server2u.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => null, // Will be async in practice
  rateLimitMs: 2000,
};

export async function scrapeServer2U(model: string): Promise<ScrapeResult | null> {
  const url = server2uParser.buildSearchUrl(model);
  const html = await fetchWithRateLimit(url, server2uParser.rateLimitMs);
  return parseHtml(html, url);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scrapers/server2u.ts
git commit -m "feat: add first mobile scraper (Server2U) template"
```

---

## Task 6: Remaining Desktop Parsers (Batch)

**Files:**
- Create: `desktop/src-tauri/src/scrapers/linitx.rs` through `neobits.rs` (24 files)

- [ ] **Step 1: Create all remaining desktop parsers**

Each parser follows the same pattern as Server2U but with site-specific CSS selectors. For each distributor, create a file like:

```rust
// desktop/src-tauri/src/scrapers/linitx.rs
use super::{ScrapeResult, fetch_html, infer_stock_status, parse_price_from_text};
use scraper::{Html, Selector};

pub async fn scrape(model: &str) -> Result<ScrapeResult, String> {
    let url = format!("https://linitx.com/search?q={}", model);
    let html = fetch_html(&url, 3000).await.map_err(|e| e.to_string())?;
    parse_html(&html, &url)
}

fn parse_html(html: &str, url: &str) -> Result<ScrapeResult, String> {
    let document = Html::parse_document(html);
    // Site-specific selectors
    let price_sel = Selector::parse(".product__price, .price--main").map_err(|e| e.to_string())?;
    let stock_sel = Selector::parse(".product__stock, .stock").map_err(|e| e.to_string())?;
    
    let price_text = document.select(&price_sel).next().map(|el| el.text().collect::<String>()).ok_or("No price")?;
    let price = parse_price_from_text(&price_text).ok_or("Bad price")?;
    let stock_text = document.select(&stock_sel).next().map(|el| el.text().collect::<String>()).unwrap_or_default();
    
    Ok(ScrapeResult {
        price,
        currency: "GBP".to_string(),
        stock_status: infer_stock_status(&stock_text),
        expected_date: None,
        url: url.to_string(),
    })
}
```

Create similar files for: `interprojekt.rs`, `nasstore.rs`, `aerial.rs`, `mikrotikstore.rs`, `miro.rs`, `gearup.rs`, `balticnetworks.rs`, `linktechs.rs`, `winncom.rs`, `bhphoto.rs`, `duxtel.rs`, `wisp.rs`, `pbtech.rs`, `gowifi.rs`, `getic.rs`, `mega.rs`, `hellascom.rs`, `rocnoc.rs`, `networkdevices.rs`, `flytec.rs`, `mbsiwav.rs`, `multilink.rs`, `neobits.rs`

- [ ] **Step 2: Update mod.rs to export all parsers**

```rust
// desktop/src-tauri/src/scrapers/mod.rs
pub mod server2u;
pub mod linitx;
pub mod interprojekt;
pub mod nasstore;
pub mod aerial;
pub mod mikrotikstore;
pub mod miro;
pub mod gearup;
pub mod balticnetworks;
pub mod linktechs;
pub mod winncom;
pub mod bhphoto;
pub mod duxtel;
pub mod wisp;
pub mod pbtech;
pub mod gowifi;
pub mod getic;
pub mod mega;
pub mod hellascom;
pub mod rocnoc;
pub mod networkdevices;
pub mod flytec;
pub mod mbsiwav;
pub mod multilink;
pub mod neobits;
```

- [ ] **Step 3: Update check_all_prices in lib.rs to use all parsers**

```rust
let result = match distributor_id.as_str() {
    "server2u-my" => scrapers::server2u::scrape(&product.model_number).await,
    "linitx-uk" => scrapers::linitx::scrape(&product.model_number).await,
    "interprojekt-pl" => scrapers::interprojekt::scrape(&product.model_number).await,
    // ... all 25 distributors
    _ => Err("Unknown distributor".to_string()),
};
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cd desktop/src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/scrapers/ desktop/src-tauri/src/lib.rs
git commit -m "feat: add all 25 desktop parsers with check_all_prices command"
```

---

## Task 7: Remaining Mobile Parsers (Batch)

**Files:**
- Create: `lib/scrapers/linitx.ts` through `neobits.ts` (24 files)

- [ ] **Step 1: Create all remaining mobile parsers**

Each parser follows the same pattern as Server2U but with site-specific CSS selectors and currencies. For each distributor:

```typescript
// lib/scrapers/linitx.ts
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

export const linitxParser: DistributorParser = {
  id: "linitx-uk",
  baseUrl: "https://linitx.com",
  buildSearchUrl: (model) => `https://linitx.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 3000,
};

export async function scrapeLinitx(model: string): Promise<ScrapeResult | null> {
  const url = linitxParser.buildSearchUrl(model);
  const html = await fetchWithRateLimit(url, linitxParser.rateLimitMs);
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  
  const priceText = $(".product__price, .price--main").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;
  
  const stockText = $(".product__stock, .stock").first().text();
  
  return {
    price,
    currency: "GBP",
    stockStatus: inferStockStatus(stockText),
    url,
  };
}
```

Create similar files for all 24 remaining distributors, each with:
- Correct base URL
- Correct currency (EUR for European, USD for US, etc.)
- Site-specific CSS selectors
- Appropriate rate limit (2-5 seconds)

- [ ] **Step 2: Update registry.ts imports**

The registry already imports all parsers — verify imports match.

- [ ] **Step 3: Commit**

```bash
git add lib/scrapers/
git commit -m "feat: add all 25 mobile parsers with site-specific selectors"
```

---

## Task 8: Desktop Background Task Integration

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src-tauri/src/main.rs` (if needed)

- [ ] **Step 1: Add WatchedProduct struct to lib.rs**

```rust
#[derive(Debug, Clone, serde::Deserialize)]
struct WatchedProduct {
    id: String,
    model_number: String,
    distributor_ids: Vec<String>,
}
```

- [ ] **Step 2: Register check_all_prices command in main.rs**

Ensure the command is registered in the Tauri builder.

- [ ] **Step 3: Add price comparison logic after scraping**

After `check_all_prices` completes, compare results against price alerts and fire notifications if triggered.

- [ ] **Step 4: Verify Rust compiles**

```bash
cd desktop/src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/
git commit -m "feat: integrate desktop scraping with background task and alerts"
```

---

## Task 9: Mobile Background Task Integration

**Files:**
- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Update background task to use real scrapers**

```typescript
// Update the existing checkPriceDropsNow function
import { PARSERS, getParserByDistributorId } from "./scrapers/registry";
import { scrapeServer2U } from "./scrapers/server2u";
import { scrapeLinitx } from "./scrapers/linitx";
// ... import all parsers

async function scrapeProduct(product: Product, distributorId: string): Promise<ScrapeResult | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  
  switch (distributorId) {
    case "server2u-my": return scrapeServer2U(product.modelNumber);
    case "linitx-uk": return scrapeLinitx(product.modelNumber);
    // ... all 25
    default: return null;
  }
}
```

- [ ] **Step 2: Update the main check function to scrape + compare**

- [ ] **Step 3: Commit**

```bash
git add lib/background-price-check.ts
git commit -m "feat: integrate mobile scraping with background price check task"
```

---

## Task 10: UI — Last-Refreshed Indicator

**Files:**
- Modify: `app/product/[id].tsx`

- [ ] **Step 1: Add last-refreshed indicator to product detail screen**

Show "Last refreshed: 2h ago" with color coding (green <1h, yellow 1-6h, red >6h, gray never).

- [ ] **Step 2: Add similar indicator to watchlist cards**

- [ ] **Step 3: Commit**

```bash
git add app/product/\[id\].tsx app/\(tabs\)/watchlist.tsx
git commit -m "feat: add last-refreshed indicator to product cards"
```

---

## Task 11: UI — Check Now Button

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Add "Check Now" button to watchlist header**

Show spinner while checking, disable button during check.

- [ ] **Step 2: Add progress indicator**

Show "Checking 3/12 products..." during scrape.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/watchlist.tsx
git commit -m "feat: add Check Now button with progress indicator"
```

---

## Task 12: UI — Scraper Status Dashboard

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add Scraper Status section to Settings**

Show each distributor with status (✅ OK / ⚠️ Stale / ❌ Failed) and last check time.

- [ ] **Step 2: Add distributor enable/disable toggles**

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/settings.tsx
git commit -m "feat: add scraper status dashboard in Settings"
```

---

## Task 13: HTML Fixture Generation

**Files:**
- Create: `tests/fixtures/scrapers/` directory
- Create: `scripts/generate-fixtures.ts`

- [ ] **Step 1: Create fixture generation script**

Script fetches each distributor's search page for CRS804 and saves HTML.

- [ ] **Step 2: Run fixture generation**

```bash
pnpm generate-fixtures
```

- [ ] **Step 3: Commit fixtures**

```bash
git add tests/fixtures/scrapers/
git commit -m "feat: add HTML fixtures for all 25 distributors"
```

---

## Task 14: Parser Unit Tests

**Files:**
- Create: `tests/scrapers/server2u.test.ts` through `neobits.test.ts` (25 files)
- Modify: `vitest.config.ts` (if needed)

- [ ] **Step 1: Write tests for first 5 parsers**

Each test:
- Loads HTML fixture
- Runs parser
- Asserts correct price, currency, stock status
- Tests graceful failure on bad HTML

- [ ] **Step 2: Write tests for remaining 20 parsers**

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add tests/scrapers/
git commit -m "feat: add unit tests for all 25 parsers"
```

---

## Task 15: Integration Tests

**Files:**
- Create: `tests/scraping-integration.test.ts`

- [ ] **Step 1: Write integration tests**

- Mock HTTP responses → test full scrape cycle
- Test error handling: network failure, 404, 429
- Test price history append + deduplication
- Test concurrent scraping with rate limiting

- [ ] **Step 2: Run integration tests**

```bash
pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add tests/scraping-integration.test.ts
git commit -m "feat: add scraping integration tests"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run all checks**

```bash
pnpm check && pnpm lint && pnpm test
pnpm --filter desktop check && pnpm --filter desktop test
cd desktop/src-tauri && cargo check && cargo test
```

- [ ] **Step 2: Build desktop app**

```bash
cd desktop/src-tauri && cargo tauri build
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "Checkpoint: price scraping complete. TypeScript: 0 errors. All tests passing."
```
