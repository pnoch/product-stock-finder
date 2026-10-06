# ROC-NOC Matrix-Table Parser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ROC-NOC return prices by adding a matrix-table parse path (products are columns, attributes are rows) and correcting its search URL, on mobile and desktop.

**Architecture:** `lib/scrapers/rocnoc.ts` gains `parseMatrixTable` (tried before the existing card path) and a corrected `buildSearchUrl`. `desktop/src-tauri/src/scrapers/rocnoc.rs` mirrors both. A minimal matrix fixture makes the tests non-vacuous.

**Tech Stack:** TypeScript, cheerio, Rust, scraper crate, vitest, cargo.

**Spec:** `docs/superpowers/specs/2026-10-05-rocnoc-matrix-parser-design.md`

---

## File Structure

- Modify `lib/scrapers/rocnoc.ts` — URL + `parseMatrixTable`.
- Modify `desktop/src-tauri/src/scrapers/rocnoc.rs` — URL + `parse_matrix_table`.
- Create `tests/fixtures/scrapers/rocnoc-us-search.html` — a two-column matrix table.
- Tests: `tests/scrapers/rocnoc.test.ts`.

---

### Task 1: ROC-NOC search URL

**Files:** Modify `lib/scrapers/rocnoc.ts:42-43`; Modify `desktop/src-tauri/src/scrapers/rocnoc.rs:5-8`; Test `tests/scrapers/rocnoc.test.ts:12-15`

- [ ] **Step 1: Update the failing test**

In `tests/scrapers/rocnoc.test.ts`, replace the `buildSearchUrl` assertion:

```ts
    const url = rocnocParser.buildSearchUrl("hAP ac3");
    expect(url).toBe(
      "https://www.roc-noc.com/search.php?mode=search&substring=hAP%20ac3",
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/rocnoc.test.ts`
Expected: FAIL — the URL still uses `search.php?keywords=`.

- [ ] **Step 3: Implement (mobile + Rust)**

In `lib/scrapers/rocnoc.ts`:

```ts
  buildSearchUrl: (model) =>
    `https://www.roc-noc.com/search.php?mode=search&substring=${encodeURIComponent(model)}`,
```

In `desktop/src-tauri/src/scrapers/rocnoc.rs`:

```rust
    let url = format!(
        "https://www.roc-noc.com/search.php?mode=search&substring={}",
        urlencoding::encode(model)
    );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scrapers/rocnoc.test.ts tests/desktop-scraper-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/rocnoc.ts desktop/src-tauri/src/scrapers/rocnoc.rs tests/scrapers/rocnoc.test.ts
git commit -m "fix(scrapers): use ROC-NOC's search.php?mode=search&substring= endpoint"
```

---

### Task 2: Mobile matrix-table parser

**Files:** Modify `lib/scrapers/rocnoc.ts`; Create `tests/fixtures/scrapers/rocnoc-us-search.html`; Test `tests/scrapers/rocnoc.test.ts`

- [ ] **Step 1: Create the fixture**

Create `tests/fixtures/scrapers/rocnoc-us-search.html`:

```html
<html><body>
<table class="products products-table width-100">
<tbody>
<tr class="first product-name-row">
<td class="highlight first product-cell" style="width: 20%;"><a href="https://www.roc-noc.com/mikrotik/switch/CRS326-24G-2SplusRM.html" class="product-title">Mikrotik Cloud Router Switch CRS326-24G-2S+RM complete 2 SFP+ cages plus 24 port 10/100/1000 layer 3 switch and router assembled with 1U RM case and power supply - New!</a></td>
<td class="product-cell" style="width: 20%;"><a href="https://www.roc-noc.com/mikrotik/switch/CRS326-24Splus2QplusRM.html" class="product-title">Mikrotik Cloud Router Switch CRS326-24S+2Q+RM SFP switch, 24 - 10 Gpbs SFP+ ports with 2 - 40 Gpbs QSFP+ ports in a 1U rack mount case - New!</a></td>
</tr>
<tr class="first">
<td class="highlight first product-cell"><div class="sku">SKU: CRS326-24G-2S+RM</div></td>
<td class="product-cell"><div class="sku">SKU: CRS326-24S+2Q+RM</div></td>
</tr>
<tr class="first">
<td class="highlight first product-cell product-cell-price">
<div class="buy-now">
<script type="text/javascript">//<![CDATA[
products_data[850].quantity = 78;
//]]></script>
<span class="price"><span class="currency">$209.00</span></span>
</div>
</td>
<td class="product-cell product-cell-price">
<div class="buy-now">
<script type="text/javascript">//<![CDATA[
products_data[933].quantity = 0;
//]]></script>
<span class="price"><span class="currency">$599.00</span></span>
</div>
</td>
</tr>
</tbody>
</table>
</body></html>
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/scrapers/rocnoc.test.ts` (add `import * as fs from "fs";` and `import * as path from "path";` at the top if not already present, and `const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");`):

```ts
describe("ROC-NOC matrix table", () => {
  const html = () =>
    fs.readFileSync(path.join(FIXTURES_DIR, "rocnoc-us-search.html"), "utf-8");

  it("reads the price from the model's column", () => {
    const result = rocnocParser.parsePrice(html(), "CRS326-24G-2S+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(209);
    expect(result!.currency).toBe("USD");
    expect(result!.stockStatus).toBe("in_stock");
  });

  it("reads the out-of-stock quantity in a different column", () => {
    const result = rocnocParser.parsePrice(html(), "CRS326-24S+2Q+RM");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(599);
    expect(result!.stockStatus).toBe("out_of_stock");
  });

  it("returns null when no column names the model", () => {
    expect(rocnocParser.parsePrice(html(), "CRS804-4DDQ-hRM")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/rocnoc.test.ts`
Expected: FAIL — the matrix tests return null (the card path cannot correlate the price with the title).

- [ ] **Step 4: Implement**

In `lib/scrapers/rocnoc.ts`, add `matchesModel` to the imports from `./utils`, then add the helper and call it first in `parseHtml`:

```ts
function parseMatrixTable(
  $: cheerio.CheerioAPI,
  model: string | undefined,
): ScrapeResult | null {
  if (!model) return null;
  let found: ScrapeResult | null = null;
  $("table.products-table").each((_, table) => {
    if (found) return;
    const $t = $(table);
    let targetCol = -1;
    $t.find("a.product-title").each((_, a) => {
      if (targetCol >= 0) return;
      if (matchesModel($(a).text(), model)) targetCol = $(a).closest("td").index();
    });
    if (targetCol < 0) return;
    $t.find("td.product-cell-price").each((_, td) => {
      if (found) return;
      const $td = $(td);
      if ($td.index() !== targetCol) return;
      const price = parsePriceFromText($td.find(".price").text() || $td.text());
      if (!price) return;
      const qty = $td.text().match(/quantity\s*=\s*(\d+)/);
      const stockStatus: StockStatus = qty
        ? Number(qty[1]) > 0
          ? "in_stock"
          : "out_of_stock"
        : inferStockStatus($td.text());
      found = {
        price,
        currency: "USD",
        stockStatus,
        url: "",
        taxRate: getTaxRate("United States"),
      };
    });
  });
  return found;
}
```

Update `parseHtml` to try the matrix path first:

```ts
function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const matrix = parseMatrixTable($, model);
  if (matrix) return { ...matrix, url };

  const $price = findPriceElement($, ".price, .product-price, td:contains('$')", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".stock, .availability, .product-stock, .stock-status")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
    taxRate: getTaxRate("United States"),
  };
}
```

Add `StockStatus` to the type imports: `import { StockStatus } from "../types";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scrapers/rocnoc.test.ts`
Expected: PASS (existing card tests + 3 new matrix tests).

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/rocnoc.ts tests/fixtures/scrapers/rocnoc-us-search.html tests/scrapers/rocnoc.test.ts
git commit -m "feat(scrapers): parse ROC-NOC's matrix-table search results"
```

---

### Task 3: Rust matrix-table parser

**Files:** Modify `desktop/src-tauri/src/scrapers/rocnoc.rs`

- [ ] **Step 1: Implement**

Replace `desktop/src-tauri/src/scrapers/rocnoc.rs` with:

```rust
use super::{fetch_html, infer_stock_status, parse_price_from_text, parse_price_page, text_mentions_model, ScrapeResult};
use crate::scrapers::browser::fetch_with_browser;
use scraper::{ElementRef, Html, Selector};

pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let url = format!(
        "https://www.roc-noc.com/search.php?mode=search&substring={}",
        urlencoding::encode(model)
    );
    // Browser-first with a plain fallback (mirrors mobile's resilient.ts
    // escalation): a browser failure must not lose the plain-HTML path.
    let html = if use_browser {
        match fetch_with_browser(&url, None, Some(30000)).await {
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

/// Zero-based column index of an element among its element siblings.
fn column_index(el: &ElementRef) -> usize {
    el.prev_siblings()
        .filter(|n| n.value().is_element())
        .count()
}

/// ROC-NOC's search results are a matrix table: each product is a column and
/// each attribute (title, SKU, price) is a row, so the shared card-based
/// `parse_price_page` cannot correlate a price with a product name. Find the
/// column whose title names the model, then read the price cell in that column.
fn parse_matrix_table(html: &str, url: &str, model: &str) -> Result<ScrapeResult, String> {
    let document = Html::parse_document(html);
    let table_sel = Selector::parse("table.products-table").map_err(|e| e.to_string())?;
    let title_sel = Selector::parse("a.product-title").map_err(|e| e.to_string())?;
    let price_sel = Selector::parse("td.product-cell-price").map_err(|e| e.to_string())?;
    for table in document.select(&table_sel) {
        let mut target_col: Option<usize> = None;
        for a in table.select(&title_sel) {
            if text_mentions_model(&a.text().collect::<String>(), model) {
                target_col = Some(column_index(&a));
                break;
            }
        }
        let Some(col) = target_col else { continue };
        for td in table.select(&price_sel) {
            if column_index(&td) != col {
                continue;
            }
            let text = td.text().collect::<String>();
            let Some(price) = parse_price_from_text(&text) else {
                continue;
            };
            let stock_status = match text
                .split("quantity")
                .nth(1)
                .and_then(|s| s.split('=').nth(1))
                .and_then(|n| n.trim().split(|c: char| !c.is_ascii_digit()).next())
            {
                Some(n) if !n.is_empty() => {
                    if n.parse::<u64>().map(|q| q > 0).unwrap_or(false) {
                        "in_stock"
                    } else {
                        "out_of_stock"
                    }
                }
                _ => infer_stock_status(&text),
            };
            return Ok(ScrapeResult {
                price,
                currency: "USD".to_string(),
                stock_status: stock_status.to_string(),
                expected_date: None,
                url: url.to_string(),
            });
        }
    }
    Err("no matrix-table match".to_string())
}

fn parse_html(html: &str, url: &str, model: &str) -> Result<ScrapeResult, String> {
    parse_matrix_table(html, url, model).or_else(|_| {
        parse_price_page(
            html,
            url,
            model,
            "USD",
            ".price, .product-price, td:contains('$')",
            ".stock, .availability, .product-stock, .stock-status",
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const MATRIX: &str = r#"<html><body>
      <table class="products products-table width-100"><tbody>
      <tr class="first product-name-row">
        <td class="highlight first product-cell"><a href="/mikrotik/switch/CRS326-24G-2SplusRM.html" class="product-title">Mikrotik Cloud Router Switch CRS326-24G-2S+RM complete 2 SFP+ cages</a></td>
        <td class="product-cell"><a href="/mikrotik/switch/CRS326-24Splus2QplusRM.html" class="product-title">Mikrotik Cloud Router Switch CRS326-24S+2Q+RM SFP switch</a></td>
      </tr>
      <tr class="first">
        <td class="highlight first product-cell product-cell-price"><div class="buy-now">
          <script>//<![CDATA[
          products_data[850].quantity = 78;
          //]]></script>
          <span class="price"><span class="currency">$209.00</span></span>
        </div></td>
        <td class="product-cell product-cell-price"><div class="buy-now">
          <script>//<![CDATA[
          products_data[933].quantity = 0;
          //]]></script>
          <span class="price"><span class="currency">$599.00</span></span>
        </div></td>
      </tr>
      </tbody></table></body></html>"#;

    #[test]
    fn matrix_table_reads_the_model_column_price() {
        let r = parse_matrix_table(MATRIX, "https://www.roc-noc.com/x", "CRS326-24G-2S+RM")
            .expect("matching column must parse");
        assert_eq!(r.price, 209.0);
        assert_eq!(r.stock_status, "in_stock");
    }

    #[test]
    fn matrix_table_reads_out_of_stock_in_another_column() {
        let r = parse_matrix_table(MATRIX, "https://www.roc-noc.com/x", "CRS326-24S+2Q+RM")
            .expect("matching column must parse");
        assert_eq!(r.price, 599.0);
        assert_eq!(r.stock_status, "out_of_stock");
    }

    #[test]
    fn matrix_table_errors_when_no_column_matches() {
        assert!(parse_matrix_table(MATRIX, "https://www.roc-noc.com/x", "CRS804-4DDQ-hRM").is_err());
    }
}
```

- [ ] **Step 2: Run the Rust tests**

Run: `pnpm test:rust`
Expected: PASS (the 3 new matrix tests plus the existing suite).

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/scrapers/rocnoc.rs
git commit -m "feat(desktop): parse ROC-NOC's matrix-table search results"
```

---

### Task 4: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`
Expected: exit 0 (root tests, desktop, cargo all green).

- [ ] **Step 2: Document**

Add a `todo.md` phase entry (next number 1108): the ROC-NOC matrix-table parser (mobile + Rust), the corrected search URL, the measured evidence (`$209.00` USD), and the note that HellasCom remains.

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "docs: ROC-NOC matrix-table parser (Phase 1108)"
```

---

## Self-Review

- **Spec coverage:** URL (Task 1), mobile matrix path (Task 2), Rust matrix path (Task 3), verify + docs (Task 4). HellasCom is out of scope per the spec.
- **Placeholders:** none.
- **Type consistency:** `parseMatrixTable($, model)` / `parse_matrix_table(html, url, model)`; `column_index`; `StockStatus`; `matchesModel` / `text_mentions_model`; the card fallback selector string is unchanged on both platforms (parity guard).
