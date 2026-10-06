# HellasCom (linkshop.gr) Parser Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point HellasCom's parser at its real storefront (`linkshop.gr`, CS-Cart), fix the search URL and price selector, and add card-scoped Greek stock inference, on mobile and desktop.

**Architecture:** The distributor `website` and Rust region table move to `linkshop.gr`; the parser gets the CS-Cart search URL + `.ty-grid-list__price` selector + card-scoped stock; `inferStockStatus` (and its Rust mirror) gain Greek markers.

**Tech Stack:** TypeScript, cheerio, Rust, scraper crate, vitest, cargo.

**Spec:** `docs/superpowers/specs/2026-10-05-hellascom-linkshop-parser-design.md`

---

## File Structure

- Modify `shared/src/distributors.ts` — HellasCom `website`.
- Modify `desktop/src-tauri/src/scrapers/browser.rs` — `HOST_REGIONS` entry.
- Modify `lib/scrapers/hellascom.ts` — host, URL, selector, card-scoped stock.
- Modify `desktop/src-tauri/src/scrapers/hellascom.rs` — mirror.
- Modify `lib/scrapers/utils.ts` + `desktop/src-tauri/src/scrapers/mod.rs` — Greek markers.
- Create `tests/fixtures/scrapers/hellascom-gr-search.html`.
- Tests: `tests/scrapers/hellascom.test.ts`, `tests/scraping-integration.test.ts`.

---

### Task 1: Greek stock markers

**Files:** Modify `lib/scrapers/utils.ts` (`inferStockStatus`); Modify `desktop/src-tauri/src/scrapers/mod.rs` (`infer_stock_status`); Test `tests/scraping-integration.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/scraping-integration.test.ts`, inside the `inferStockStatus should detect stock states` test, add:

```ts
      expect(inferStockStatus("Εκτός Παραγωγής")).toBe("out_of_stock");
      expect(inferStockStatus("Μη διαθέσιμο")).toBe("out_of_stock");
      expect(inferStockStatus("Διαθέσιμο με παραγγελία")).toBe("back_order");
      expect(inferStockStatus("Διαθέσιμο για παραγγελία")).toBe("back_order");
      expect(inferStockStatus("Διαθέσιμο")).toBe("in_stock");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scraping-integration.test.ts`
Expected: FAIL — Greek labels return `unknown`.

- [ ] **Step 3: Implement (mobile + Rust)**

In `lib/scrapers/utils.ts` `inferStockStatus`, add the Greek markers to each branch:

```ts
  if (
    lower.includes("out of stock") ||
    lower.includes("not in stock") ||
    lower.includes("unavailable") ||
    lower.includes("not available") ||
    lower.includes("sold out") ||
    lower.includes("εκτός παραγωγής") ||
    lower.includes("εξαντλήθηκε") ||
    lower.includes("μη διαθέσιμο")
  ) {
    return "out_of_stock";
  }
  if (
    lower.includes("back order") ||
    lower.includes("backorder") ||
    lower.includes("pre-order") ||
    lower.includes("preorder") ||
    lower.includes("expected") ||
    lower.includes("παραγγελία")
  ) {
    return "back_order";
  }
  if (
    lower.includes("in stock") ||
    lower.includes("available") ||
    lower.includes("add to cart") ||
    lower.includes("διαθέσιμο")
  ) {
    return "in_stock";
  }
```

In `desktop/src-tauri/src/scrapers/mod.rs` `infer_stock_status`, mirror exactly:

```rust
    if lower.contains("out of stock")
        || lower.contains("not in stock")
        || lower.contains("unavailable")
        || lower.contains("not available")
        || lower.contains("sold out")
        || lower.contains("εκτός παραγωγής")
        || lower.contains("εξαντλήθηκε")
        || lower.contains("μη διαθέσιμο")
    {
        return "out_of_stock".to_string();
    }
    if lower.contains("back order")
        || lower.contains("backorder")
        || lower.contains("pre-order")
        || lower.contains("preorder")
        || lower.contains("expected")
        || lower.contains("παραγγελία")
    {
        return "back_order".to_string();
    }
    if lower.contains("in stock")
        || lower.contains("available")
        || lower.contains("add to cart")
        || lower.contains("διαθέσιμο")
    {
        return "in_stock".to_string();
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scraping-integration.test.ts tests/desktop-scraper-parity.test.ts && pnpm test:rust`
Expected: PASS (the parity guard compares the marker lists, so both must match).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/utils.ts desktop/src-tauri/src/scrapers/mod.rs tests/scraping-integration.test.ts
git commit -m "feat(scrapers): infer Greek stock statuses (HellasCom)"
```

---

### Task 2: Distributor host → linkshop.gr

**Files:** Modify `shared/src/distributors.ts:335`; Modify `desktop/src-tauri/src/scrapers/browser.rs:91`

- [ ] **Step 1: Update the website + region table**

In `shared/src/distributors.ts`, change HellasCom's `website`:

```ts
    website: "https://www.linkshop.gr",
```

In `desktop/src-tauri/src/scrapers/browser.rs`, change the `HOST_REGIONS` entry:

```rust
    ("linkshop.gr", EUROPE),
```

- [ ] **Step 2: Run the guards**

Run: `pnpm exec vitest run tests/desktop-scraper-parity.test.ts tests/parser-host-parity.test.ts tests/distributors.test.ts`
Expected: `parser-host-parity` FAILS until Task 3 changes `baseUrl` (the parser still points at `hellascom.gr`). That is expected; proceed to Task 3 before re-running.

- [ ] **Step 3: Commit**

```bash
git add shared/src/distributors.ts desktop/src-tauri/src/scrapers/browser.rs
git commit -m "fix(distributors): point HellasCom at its linkshop.gr storefront"
```

---

### Task 3: Mobile parser — host, URL, selector, stock

**Files:** Modify `lib/scrapers/hellascom.ts`; Create `tests/fixtures/scrapers/hellascom-gr-search.html`; Test `tests/scrapers/hellascom.test.ts`

- [ ] **Step 1: Create the fixture**

Create `tests/fixtures/scrapers/hellascom-gr-search.html`:

```html
<html><body>
<div class="grid-list">
<div class="ty-column3">
<div class="ty-grid-list__item">
  <div class="ty-grid-list__item-name"><bdi><a href="https://www.linkshop.gr/wi-fi/mikrotik/switches/crs326-24s2qrm.html" class="product-title" title="MikroTik CRS326-24S+2Q+RM">MikroTik CRS326-24S+2Q+RM, 650MHz, 64MB, 24xSFP+, 2xQSFP+</a></bdi></div>
  <div class="ty-grid-list__stock-block clearfix">
    <div class="block_avail_status_label"><input type="hidden" name="product_data[1075][avail_status]" value="11"><div class="title"><b>Εκτός Παραγωγής</b></div><div class="descr">Επικοινωνήστε μαζί μας</div></div>
  </div>
  <div class="ty-grid-list__price clearfix"><span class="ty-price"><span class="ty-price-num">483.87</span>&nbsp;<span class="ty-price-num">€</span></span></div>
</div>
</div>
<div class="ty-column3">
<div class="ty-grid-list__item">
  <div class="ty-grid-list__item-name"><bdi><a href="https://www.linkshop.gr/wi-fi/mikrotik/switches/crs326-24g-2srm.html" class="product-title" title="MikroTik Routerboard CRS326-24G-2S+RM">MikroTik Routerboard CRS326-24G-2S+RM, 800MHz, 512MB, 24xGigabit, 2xSFP+</a></bdi></div>
  <div class="ty-grid-list__stock-block clearfix">
    <div class="block_avail_status_label"><input type="hidden" name="product_data[1776][avail_status]" value="14"><div class="title"><b>Διαθέσιμο με παραγγελία</b></div><div class="descr">Παράδοση 2 με 7 εργάσιμες</div></div>
  </div>
  <div class="ty-grid-list__price clearfix"><span class="ty-price"><span class="ty-price-num">177.42</span>&nbsp;<span class="ty-price-num">€</span></span></div>
</div>
</div>
</div>
</body></html>
```

- [ ] **Step 2: Update the failing tests**

In `tests/scrapers/hellascom.test.ts`, replace the config/URL assertions and add the grid cases:

```ts
  it("should have correct parser config", () => {
    expect(hellascomParser.id).toBe("hellascom-gr");
    expect(hellascomParser.baseUrl).toBe("https://www.linkshop.gr");
    expect(hellascomParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = hellascomParser.buildSearchUrl("hAP ac3");
    expect(url).toBe(
      "https://www.linkshop.gr/?dispatch=products.search&q=hAP%20ac3&search_performed=Y",
    );
  });
```

Append a new describe block:

```ts
describe("HellasCom linkshop.gr grid", () => {
  const html = () =>
    fs.readFileSync(path.join(FIXTURES_DIR, "hellascom-gr-search.html"), "utf-8");

  it("extracts the model's grid price and card-scoped stock", () => {
    const result = hellascomParser.parsePrice(html(), "CRS326-24G-2S+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(177.42);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("back_order");
  });

  it("reads the out-of-production status in another card", () => {
    const result = hellascomParser.parsePrice(html(), "CRS326-24S+2Q+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(483.87);
    expect(result!.stockStatus).toBe("out_of_stock");
  });

  it("returns null when no card names the model", () => {
    expect(hellascomParser.parsePrice(html(), "CRS804-4DDQ-hRM")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/hellascom.test.ts`
Expected: FAIL — the config/URL assertions and the grid tests fail.

- [ ] **Step 4: Implement**

Replace the parser config and `parseHtml` in `lib/scrapers/hellascom.ts`:

```ts
function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = findPriceElement(
    $,
    ".ty-grid-list__price, .ty-product-block__price-actual",
    model,
  );
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const card = $price.closest(".ty-grid-list__item, .ty-product-block");
  const stockText =
    card
      .find(".block_avail_status_label .title b, .product_availability_status .title b")
      .first()
      .text() ||
    $(".stock-status, .availability, .product-stock").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Greece"),
  };
}

export const hellascomParser: DistributorParser = {
  id: "hellascom-gr",
  baseUrl: "https://www.linkshop.gr",
  buildSearchUrl: (model) =>
    `https://www.linkshop.gr/?dispatch=products.search&q=${encodeURIComponent(model)}&search_performed=Y`,
  parsePrice: (html, model, url) =>
    parseHtml(html, url ?? "https://www.linkshop.gr", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".ty-grid-list__price, .ty-product-block__price-actual",
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scrapers/hellascom.test.ts tests/parser-host-parity.test.ts tests/desktop-scraper-parity.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/hellascom.ts tests/fixtures/scrapers/hellascom-gr-search.html tests/scrapers/hellascom.test.ts
git commit -m "fix(scrapers): parse HellasCom's linkshop.gr (CS-Cart) storefront"
```

---

### Task 4: Rust parser mirror

**Files:** Modify `desktop/src-tauri/src/scrapers/hellascom.rs`

- [ ] **Step 1: Implement**

Replace `desktop/src-tauri/src/scrapers/hellascom.rs` with:

```rust
use super::{fetch_html, infer_stock_status, parse_price_page, text_mentions_model, ScrapeResult};
use crate::scrapers::browser::fetch_with_browser;
use scraper::{Html, Selector};

pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let url = format!(
        "https://www.linkshop.gr/?dispatch=products.search&q={}&search_performed=Y",
        urlencoding::encode(model)
    );
    // Browser-first with a plain fallback (mirrors mobile's resilient.ts
    // escalation): a browser failure must not lose the plain-HTML path.
    let html = if use_browser {
        match fetch_with_browser(
            &url,
            Some(".ty-grid-list__price, .ty-product-block__price-actual"),
            Some(30000),
        )
        .await
        {
            Ok(html) => html,
            Err(_) => fetch_html(&url, 3000)
                .await
                .map_err(|e| format!("Fetch failed: {}", e))?,
        }
    } else {
        fetch_html(&url, 3000)
            .await
            .map_err(|e| format!("Fetch failed: {}", e))?
    };
    parse_html(&html, &url, model)
}

/// The availability label lives inside the product card, not at page level, so
/// the page-wide first match would report another product's status. Find the
/// card whose text names the model, then read its label.
fn card_stock_status(html: &str, model: &str) -> Option<String> {
    let document = Html::parse_document(html);
    let card_sel = Selector::parse(".ty-grid-list__item, .ty-product-block").ok()?;
    let label_sel = Selector::parse(".block_avail_status_label .title b, .product_availability_status .title b").ok()?;
    for card in document.select(&card_sel) {
        if !text_mentions_model(&card.text().collect::<String>(), model) {
            continue;
        }
        if let Some(text) = card.select(&label_sel).next().map(|b| b.text().collect::<String>()) {
            return Some(infer_stock_status(&text));
        }
    }
    None
}

fn parse_html(html: &str, url: &str, model: &str) -> Result<ScrapeResult, String> {
    let mut result = parse_price_page(
        html,
        url,
        model,
        "EUR",
        ".ty-grid-list__price, .ty-product-block__price-actual",
        ".stock-status, .availability, .product-stock",
    )?;
    if let Some(status) = card_stock_status(html, model) {
        result.stock_status = status;
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    const GRID: &str = r#"<html><body><div class="grid-list">
      <div class="ty-grid-list__item">
        <div class="ty-grid-list__item-name"><a href="/crs326-24s2qrm.html" class="product-title">MikroTik CRS326-24S+2Q+RM</a></div>
        <div class="block_avail_status_label"><div class="title"><b>Εκτός Παραγωγής</b></div></div>
        <div class="ty-grid-list__price"><span class="ty-price-num">483.87</span><span class="ty-price-num">€</span></div>
      </div>
      <div class="ty-grid-list__item">
        <div class="ty-grid-list__item-name"><a href="/crs326-24g-2srm.html" class="product-title">MikroTik Routerboard CRS326-24G-2S+RM</a></div>
        <div class="block_avail_status_label"><div class="title"><b>Διαθέσιμο με παραγγελία</b></div></div>
        <div class="ty-grid-list__price"><span class="ty-price-num">177.42</span><span class="ty-price-num">€</span></div>
      </div>
    </div></body></html>"#;

    #[test]
    fn grid_reads_the_model_price_and_card_stock() {
        let r = parse_html(GRID, "https://www.linkshop.gr/x", "CRS326-24G-2S+RM")
            .expect("matching card must parse");
        assert_eq!(r.price, 177.42);
        assert_eq!(r.stock_status, "back_order");
    }

    #[test]
    fn grid_reads_out_of_production_in_another_card() {
        let r = parse_html(GRID, "https://www.linkshop.gr/x", "CRS326-24S+2Q+RM")
            .expect("matching card must parse");
        assert_eq!(r.price, 483.87);
        assert_eq!(r.stock_status, "out_of_stock");
    }
}
```

- [ ] **Step 2: Run the Rust tests**

Run: `pnpm test:rust`
Expected: PASS (2 new tests + existing suite).

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/scrapers/hellascom.rs
git commit -m "fix(desktop): parse HellasCom's linkshop.gr (CS-Cart) storefront"
```

---

### Task 5: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0 (root tests, desktop, cargo all green).

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1109): the host correction (`hellascom.gr` corporate → `linkshop.gr` storefront), the CS-Cart search URL, the grid price selector, card-scoped Greek stock, and the measured evidence (`177.42` EUR). Note this closes the Phase-1102 "not fixable" list.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: HellasCom linkshop.gr parser fix (Phase 1109)"
```

---

## Self-Review

- **Spec coverage:** Greek markers (Task 1), host (Task 2), mobile parser (Task 3), Rust mirror (Task 4), verify + docs (Task 5).
- **Placeholders:** none.
- **Type consistency:** `baseUrl`/`buildSearchUrl`/`browserOptions.waitForSelector` match on both platforms; the price selector string is identical; `card_stock_status`/`card` scoping mirrors; Greek markers identical in `inferStockStatus`/`infer_stock_status` (parity guard).
- **Ordering:** Task 2 changes the distributor host before Task 3 changes the parser `baseUrl`, so `parser-host-parity` is red between them — noted explicitly in Task 2 Step 2.
