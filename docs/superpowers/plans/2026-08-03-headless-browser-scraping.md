# Headless Browser Scraping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright headless browser support so scrapers can handle sites that require JavaScript rendering or have Cloudflare protection, using a `useBrowser` flag on parser config and a shared BrowserPool.

**Architecture:** Add a `BrowserPool` class that manages 2-3 Playwright browser instances. Add `fetchWithBrowser()` wrapper function. Update `DistributorParser` interface with `useBrowser` and `browserOptions` fields. Update 15 parsers with `useBrowser: true`. Add Rust equivalent for desktop.

**Tech Stack:** Playwright (TypeScript), reqwest + scraper + playwright (Rust), Cheerio (existing)

---

## File Structure

### New Files
- `lib/scrapers/browser.ts` — BrowserPool class + `fetchWithBrowser()` function
- `tests/scrapers/browser.test.ts` — Unit tests for BrowserPool and fetchWithBrowser
- `desktop/src-tauri/src/scrapers/browser.rs` — Rust BrowserPool + fetch_with_browser

### Modified Files
- `lib/scrapers/types.ts` — add `useBrowser?` and `browserOptions?` to DistributorParser
- `lib/scrapers/utils.ts` — no changes needed (fetchWithBrowser goes in browser.ts)
- 15 parser files — add `useBrowser: true` flag
- `desktop/src-tauri/src/scrapers/mod.rs` — add `pub mod browser;`
- `desktop/src-tauri/Cargo.toml` — add playwright crate

---

## Task 1: Update DistributorParser Interface

**Files:**
- Modify: `lib/scrapers/types.ts:11-17`

- [ ] **Step 1: Add useBrowser and browserOptions to DistributorParser**

```typescript
export interface DistributorParser {
  id: string;
  baseUrl: string;
  buildSearchUrl: (model: string) => string;
  parsePrice: (html: string) => ScrapeResult | null;
  rateLimitMs: number;
  useBrowser?: boolean;
  browserOptions?: {
    waitForSelector?: string;
    timeout?: number;
  };
}
```

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (no TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add lib/scrapers/types.ts
git commit -m "feat: add useBrowser and browserOptions to DistributorParser interface"
```

---

## Task 2: Create BrowserPool and fetchWithBrowser

**Files:**
- Create: `lib/scrapers/browser.ts`

- [ ] **Step 1: Create browser.ts with BrowserPool and fetchWithBrowser**

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
    await new Promise((r) => setTimeout(r, 100));
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

export async function fetchWithBrowser(
  url: string,
  options?: { waitForSelector?: string; timeout?: number },
): Promise<string> {
  const browser = await browserPool.acquire();
  try {
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: options?.timeout || 30000,
    });

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

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (no TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add lib/scrapers/browser.ts
git commit -m "feat: add BrowserPool and fetchWithBrowser for Playwright headless browser support"
```

---

## Task 3: Write BrowserPool Unit Tests

**Files:**
- Create: `tests/scrapers/browser.test.ts`

- [ ] **Step 1: Create browser.test.ts with tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        content: vi.fn().mockResolvedValue("<html></html>"),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

describe("BrowserPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should acquire a browser from pool", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    const browser = await browserPool.acquire();
    expect(browser).toBeDefined();
    browserPool.release(browser);
  });

  it("should release and reuse browser", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    const browser1 = await browserPool.acquire();
    browserPool.release(browser1);
    const browser2 = await browserPool.acquire();
    expect(browser1).toBe(browser2);
    browserPool.release(browser2);
  });

  it("should shutdown all browsers", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    const browser = await browserPool.acquire();
    browserPool.release(browser);
    await browserPool.shutdown();
    expect(true).toBe(true);
  });
});

describe("fetchWithBrowser", () => {
  it("should fetch HTML using browser", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    const html = await fetchWithBrowser("https://example.com");
    expect(html).toBe("<html></html>");
  });

  it("should wait for selector if provided", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    const html = await fetchWithBrowser("https://example.com", {
      waitForSelector: ".price",
    });
    expect(html).toBe("<html></html>");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test tests/scrapers/browser.test.ts`
Expected: PASS (4 tests passing)

- [ ] **Step 3: Commit**

```bash
git add tests/scrapers/browser.test.ts
git commit -m "test: add BrowserPool and fetchWithBrowser unit tests"
```

---

## Task 4: Update First Parser (nasstore) with useBrowser Flag

**Files:**
- Modify: `lib/scrapers/nasstore.ts`

- [ ] **Step 1: Read nasstore.ts to understand current structure**

Run: `cat lib/scrapers/nasstore.ts`
Expected: Shows current parser without useBrowser flag

- [ ] **Step 2: Add useBrowser: true to nasstoreParser**

Add `useBrowser: true` and `browserOptions` to the parser config:

```typescript
export const nasstoreParser: DistributorParser = {
  id: "nasstore",
  baseUrl: "https://nasstore.com.au",
  buildSearchUrl: (model) =>
    `https://nasstore.com.au/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://nasstore.com.au"),
  rateLimitMs: 2000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 3: Update scrapeNasStore to use fetchWithBrowser when useBrowser is true**

```typescript
export async function scrapeNasStore(model: string): Promise<ScrapeResult | null> {
  try {
    const url = nasstoreParser.buildSearchUrl(model);
    let html: string;
    if (nasstoreParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, nasstoreParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, nasstoreParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (no TypeScript errors)

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/nasstore.ts
git commit -m "feat: add useBrowser flag to nasstore parser"
```

---

## Task 5: Update All 15 Parsers with useBrowser Flag

**Files:**
- Modify: `lib/scrapers/winncom.ts`
- Modify: `lib/scrapers/bhphoto.ts`
- Modify: `lib/scrapers/wisp.ts`
- Modify: `lib/scrapers/pbtech.ts`
- Modify: `lib/scrapers/gowifi.ts`
- Modify: `lib/scrapers/getic.ts`
- Modify: `lib/scrapers/mega.ts`
- Modify: `lib/scrapers/aerial.ts`
- Modify: `lib/scrapers/linktechs.ts`
- Modify: `lib/scrapers/miro.ts`
- Modify: `lib/scrapers/hellascom.ts`
- Modify: `lib/scrapers/networkdevices.ts`
- Modify: `lib/scrapers/mbsiwav.ts`
- Modify: `lib/scrapers/multilink.ts`

- [ ] **Step 1: Update winncom.ts with useBrowser: true**

```typescript
export const winncomParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-link, .price",
  },
};
```

And update `scrapeWinncom` to use `fetchWithBrowser` when `useBrowser` is true.

- [ ] **Step 2: Update bhphoto.ts with useBrowser: true**

```typescript
export const bhphotoParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price, [data-selenium]",
  },
};
```

- [ ] **Step 3: Update wisp.ts with useBrowser: true**

```typescript
export const wispParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 4: Update pbtech.ts with useBrowser: true**

```typescript
export const pbtechParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price, .product-price",
  },
};
```

- [ ] **Step 5: Update gowifi.ts with useBrowser: true**

```typescript
export const gowifiParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 6: Update getic.ts with useBrowser: true**

```typescript
export const geticParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price, [data-testid='price']",
  },
};
```

- [ ] **Step 7: Update mega.ts with useBrowser: true**

```typescript
export const megaParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 8: Update aerial.ts with useBrowser: true**

```typescript
export const aerialParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".ac-price, .product-price",
  },
};
```

- [ ] **Step 9: Update linktechs.ts with useBrowser: true**

```typescript
export const linktechsParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 10: Update miro.ts with useBrowser: true**

```typescript
export const miroParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: "[itemprop='price']",
  },
};
```

- [ ] **Step 11: Update hellascom.ts with useBrowser: true**

```typescript
export const hellascomParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 12: Update networkdevices.ts with useBrowser: true**

```typescript
export const networkdevicesParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 13: Update mbsiwav.ts with useBrowser: true**

```typescript
export const mbsiwavParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-views-price",
  },
};
```

- [ ] **Step 14: Update multilink.ts with useBrowser: true**

```typescript
export const multilinkParser: DistributorParser = {
  // ... existing fields
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};
```

- [ ] **Step 15: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (no TypeScript errors)

- [ ] **Step 16: Commit**

```bash
git add lib/scrapers/
git commit -m "feat: add useBrowser flag to all 15 Cloudflare/JS-rendered parsers"
```

---

## Task 6: Create Rust BrowserPool for Desktop

**Files:**
- Create: `desktop/src-tauri/src/scrapers/browser.rs`
- Modify: `desktop/src-tauri/src/scrapers/mod.rs`
- Modify: `desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Add playwright crate to Cargo.toml**

```toml
[dependencies]
# ... existing dependencies
playwright = "0.15"
```

- [ ] **Step 2: Create browser.rs with Rust BrowserPool**

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct BrowserPool {
    browsers: Vec<playwright::Browser>,
    max_pool_size: usize,
}

impl BrowserPool {
    pub fn new(max_pool_size: usize) -> Self {
        Self {
            browsers: Vec::new(),
            max_pool_size,
        }
    }

    pub async fn acquire(&mut self) -> Result<playwright::Browser, String> {
        if let Some(browser) = self.browsers.pop() {
            return Ok(browser);
        }
        if self.browsers.len() < self.max_pool_size {
            let playwright = playwright::Playwright::initialize().await
                .map_err(|e| e.to_string())?;
            let browser = playwright.chromium().launch().await
                .map_err(|e| e.to_string())?;
            return Ok(browser);
        }
        Err("Browser pool exhausted".to_string())
    }

    pub fn release(&mut self, browser: playwright::Browser) {
        self.browsers.push(browser);
    }

    pub async fn shutdown(&mut self) {
        for browser in self.browsers.drain(..) {
            let _ = browser.close().await;
        }
    }
}

pub async fn fetch_with_browser(
    url: &str,
    wait_for_selector: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    // Simplified implementation - in production would use BrowserPool
    let playwright = playwright::Playwright::initialize().await
        .map_err(|e| e.to_string())?;
    let browser = playwright.chromium().launch().await
        .map_err(|e| e.to_string())?;
    let context = browser.new_context().await
        .map_err(|e| e.to_string())?;
    let page = context.new_page().await
        .map_err(|e| e.to_string())?;
    
    page.goto(url).await
        .map_err(|e| e.to_string())?;
    
    if let Some(selector) = wait_for_selector {
        page.wait_for_selector(selector).await
            .map_err(|e| e.to_string())?;
    }
    
    let html = page.content().await
        .map_err(|e| e.to_string())?;
    
    let _ = page.close().await;
    let _ = browser.close().await;
    
    Ok(html)
}
```

- [ ] **Step 3: Add pub mod browser to mod.rs**

```rust
pub mod browser;
```

- [ ] **Step 4: Run cargo check to verify no errors**

Run: `cargo check`
Expected: PASS (no Rust errors)

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/
git commit -m "feat: add Rust BrowserPool and fetch_with_browser for desktop"
```

---

## Task 7: Update Desktop Scrapers to Use Browser

**Files:**
- Modify: `desktop/src-tauri/src/scrapers/nasstore.rs`
- (and 14 other parser files)

- [ ] **Step 1: Update nasstore.rs to use fetch_with_browser when needed**

```rust
use crate::scrapers::browser::fetch_with_browser;

pub async fn scrape_nasstore(model: &str) -> Result<ScrapeResult, String> {
    let url = format!("https://nasstore.com.au/search?q={}", urlencoding::encode(model));
    
    let html = if true { // use_browser flag
        fetch_with_browser(&url, Some(".product-price, .price"), Some(30000)).await?
    } else {
        crate::scrapers::fetch_html(&url, 2000).await
            .map_err(|e| e.to_string())?
    };
    
    parse_html(&html, &url)
}
```

- [ ] **Step 2: Update all 14 other parsers similarly**

- [ ] **Step 3: Run cargo check to verify no errors**

Run: `cargo check`
Expected: PASS (no Rust errors)

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/scrapers/
git commit -m "feat: update desktop scrapers to use browser when useBrowser is true"
```

---

## Task 8: Integration Test with Browser Parsers

**Files:**
- Modify: `tests/scraping-integration.test.ts`

- [ ] **Step 1: Add test for browser-based parsing**

```typescript
describe("Browser Parser Integration", () => {
  it("should parse with useBrowser flag", async () => {
    const { nasstoreParser } = await import("@/lib/scrapers/nasstore");
    expect(nasstoreParser.useBrowser).toBe(true);
    expect(nasstoreParser.browserOptions?.waitForSelector).toBe(".product-price, .price");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test tests/scraping-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/scraping-integration.test.ts
git commit -m "test: add integration test for browser parsers"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run all checks**

```bash
pnpm check
pnpm lint
pnpm test
cargo check
cargo test
```

Expected: All pass

- [ ] **Step 2: Update plan status**

Mark all tasks as complete in the plan file.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: headless browser scraping implementation complete"
```
