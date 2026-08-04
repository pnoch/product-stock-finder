# Headless Browser Scraping Design Spec

**Date:** 2026-08-03
**Status:** Approved
**Scope:** Add Playwright headless browser support for sites that require JavaScript rendering or have Cloudflare protection

## Overview

Add Playwright headless browser support so scrapers can handle sites that block simple HTTP requests (Cloudflare) or render content via JavaScript. Uses a `useBrowser` flag on parser config, a shared BrowserPool of 2-3 instances, and `fetchWithBrowser()` wrapper function.

## Architecture

### Approach: Wrapper Function with Flag

Add a `useBrowser` flag to `DistributorParser` config. When true, the parser uses Playwright instead of `fetchWithRateLimit`. A shared `BrowserPool` manages 2-3 browser instances.

**New files:**
- `lib/scrapers/browser.ts` — BrowserPool class + `fetchWithBrowser()` function
- `desktop/src-tauri/src/scrapers/browser.rs` — Rust equivalent for desktop

**Modified files:**
- `lib/scrapers/types.ts` — add `useBrowser?: boolean` and `browserOptions?` to DistributorParser
- `lib/scrapers/utils.ts` — add `fetchWithBrowser()` function
- 16 parser files — add `useBrowser: true` flag
- `desktop/src-tauri/Cargo.toml` — add playwright crate

### Data Flow

```
Parser.scrape(model)
  → if useBrowser: fetchWithBrowser(url) → returns HTML
  → else: fetchWithRateLimit(url) → returns HTML
  → parseHtml(html) → ScrapeResult
```

## BrowserPool

Manages Playwright browser instances:

```typescript
import { chromium, Browser } from "playwright";

class BrowserPool {
  private browsers: Browser[] = [];
  private maxPoolSize = 3;

  async acquire(): Promise<Browser> {
    if (this.browsers.length > 0) {
      return this.browsers.pop()!;
    }
    if (this.browsers.length < this.maxPoolSize) {
      return chromium.launch({ headless: true });
    }
    await new Promise(r => setTimeout(r, 100));
    return this.acquire();
  }

  release(browser: Browser): void {
    this.browsers.push(browser);
  }

  async shutdown(): Promise<void> {
    for (const b of this.browsers) {
      await b.close();
    }
    this.browsers = [];
  }
}

export const browserPool = new BrowserPool();
```

**Key behaviors:**
- Lazy initialization — first browser launches on first request
- Pool size: 3 concurrent browsers
- Auto-cleanup on app exit
- Each browser handles 10-20 pages before recycling

## fetchWithBrowser

Wrapper function that uses BrowserPool:

```typescript
export async function fetchWithBrowser(
  url: string,
  options?: { waitForSelector?: string; timeout?: number }
): Promise<string> {
  const browser = await browserPool.acquire();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: options?.timeout || 30000 });
    
    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }
    
    const html = await page.content();
    await page.close();
    return html;
  } finally {
    browserPool.release(browser);
  }
}
```

## Parser Config Update

```typescript
interface DistributorParser {
  // ... existing fields
  useBrowser?: boolean;
  browserOptions?: {
    waitForSelector?: string;
    timeout?: number;
  };
}
```

## Parser Updates

### Parsers with `useBrowser: true` (16 sites)

| Parser | Reason | browserOptions.waitForSelector |
|--------|--------|-------------------------------|
| nasstore | Cloudflare | `.product-price, .price` |
| winncom | Cloudflare | `.product-link, .price` |
| bhphoto | Cloudflare | `.price, [data-selenium]` |
| wisp | Cloudflare | `.product-price, .price` |
| pbtech | Cloudflare | `.price, .product-price` |
| gowifi | Cloudflare | `.product-price, .price` |
| getic | Cloudflare | `.price, [data-testid='price']` |
| mega | Cloudflare | `.product-price, .price` |
| aerial | Cloudflare | `.ac-price, .product-price` |
| linktechs | Cloudflare | `.product-price, .price` |
| miro | JS-rendered | `[itemprop='price']` |
| hellascom | JS-rendered | `.product-price, .price` |
| networkdevices | JS-rendered | `.product-price, .price` |
| mbsiwav | JS-rendered | `.product-views-price` |
| multilink | JS-rendered | `.product-price, .price` |
| aerial.net | JS-rendered | `.ac-price, .product-price` |

### Parsers that stay fetch-only (5 working)
- server2u, interprojekt, mikrotikstore, balticnetworks, duxtel

### Parsers that remain broken (DNS/other)
- linitx, rocnoc, flytec (DNS failure)
- gearup (404), neobits (timeout)

## Error Handling

- Browser launch failure → log warning, fall back to fetch
- Page timeout → close page, return error, try next browser in pool
- Cloudflare challenge detected → close page, mark parser as "blocked"
- Pool exhausted → wait with timeout, fail if no browser available

## Testing Strategy

- Unit test: BrowserPool acquire/release/shutdown
- Unit test: fetchWithBrowser with mocked Playwright
- Integration test: Full scrape cycle with browser parsers
- Manual test: Run against live sites to verify

## Desktop Rust Equivalent

- Use `playwright` crate for Rust
- Same BrowserPool pattern (3 instances)
- Same `useBrowser` flag in parser config
- Called from `check_all_prices` command

## Performance Considerations

- Browser launch: ~2-3 seconds (amortized across pool)
- Page navigation: ~5-10 seconds per site
- Memory: ~500MB per browser instance
- Total for 3 instances: ~1.5GB
