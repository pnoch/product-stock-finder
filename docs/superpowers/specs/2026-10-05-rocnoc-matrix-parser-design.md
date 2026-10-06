# ROC-NOC Matrix-Table Parser — Design Spec

**Date:** 2026-10-05
**Goal:** Make ROC-NOC return prices by adding a matrix-table parse path (products are columns, attributes are rows) and correcting its search URL.

## Problem

Phase 1102 documented ROC-NOC as "JS-driven with no usable search endpoint." Direct recon on 2026-10-05 under the headed browser path shows the search works and the results contain prices — but the shared card-based parser cannot read them.

- **URL:** `search.php?keywords=<model>` returns 0 results. The real GET form is `search.php?mode=search&substring=<model>`, which returns the CRS326 products with prices.
- **Structure:** the results are a **matrix table** (`table.products-table`): each product is a *column*, and each attribute (image, title, SKU, price) is a *row*. `findPriceElement`/`modelMismatch` assume a product is a card/row container, so the price cell's walk-up never reaches the product title (which lives in a different `<tr>`). Result: `NO PRICE`.
- **Price cell:** `<td class="product-cell-price">` in the product's column, containing `<span class="price"><span class="currency">$209.00</span></span>` and a `products_data[<id>].quantity = N` script.

Verified: correlating the title's column index with the price cell's column index yields `$209.00` USD for CRS326-24G-2S+RM, and a non-matching model yields no column.

## Scope

**In scope:** a matrix-table parse path in `lib/scrapers/rocnoc.ts` and `desktop/src-tauri/src/scrapers/rocnoc.rs`, the corrected search URL (both platforms), and tests.

**Out of scope:** HellasCom (search mechanism still undiscovered) — a separate investigation.

## Architecture

### 1. Search URL — both platforms

```
https://www.roc-noc.com/search.php?mode=search&substring=<model>
```

### 2. Mobile matrix path — `lib/scrapers/rocnoc.ts`

Add `parseMatrixTable($, model)` and try it first; keep the existing card-based `findPriceElement` path as a fallback (the product-detail page has a normal `.price`, and the no-model case needs `.first()`):

```ts
function parseMatrixTable($: CheerioAPI, model?: string): ScrapeResult | null {
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
      const stockStatus = qty
        ? Number(qty[1]) > 0 ? "in_stock" : "out_of_stock"
        : inferStockStatus($td.text());
      found = { price, currency: "USD", stockStatus, url: "", taxRate: getTaxRate("United States") };
    });
  });
  return found;
}
```

`parseHtml` calls it first (filling in `url`), then falls back to the existing path.

### 3. Rust matrix path — `desktop/src-tauri/src/scrapers/rocnoc.rs`

Add `parse_matrix_table(html, url, model)` using the `scraper` crate's `NodeRef` traversal (`prev_siblings` for the column index), tried before `parse_price_page`:

```rust
fn column_index(el: &ElementRef) -> usize {
    el.prev_siblings().filter(|n| n.value().is_element()).count()
}

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
            let Some(price) = parse_price_from_text(&text) else { continue };
            let stock_status = match text.split("quantity").nth(1).and_then(|s| {
                s.split('=').nth(1).and_then(|n| n.trim().split(|c: char| !c.is_ascii_digit()).next())
            }) {
                Some(n) if !n.is_empty() => {
                    if n.parse::<u64>().map(|q| q > 0).unwrap_or(false) { "in_stock" } else { "out_of_stock" }
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
```

`scrape` calls `parse_matrix_table` first, falling back to `parse_price_page` on `Err`.

## Data Flow

1. `prices.get` → `resilientFetch` → browser path (headed in production).
2. `search.php?mode=search&substring=<model>` returns the matrix table.
3. The matrix path finds the model's column, reads the price cell in that column, and returns the price.

## Error Handling

- No matching column → the matrix path returns `null`/`Err`, and the existing card path runs (returns `null` for a miss, as today).
- No model passed → the matrix path is skipped (the card path handles `.first()`).

## Testing

- `tests/scrapers/rocnoc.test.ts` — update the `buildSearchUrl` assertion; add matrix cases: a two-product table where only one column names the model (extracts the right price; non-vacuous), an out-of-stock quantity (`quantity = 0` → `out_of_stock`), and a non-matching model → `null`.
- `tests/fixtures/scrapers/rocnoc-us-search.html` — a minimal two-column matrix table.
- Rust: a `parse_matrix_table` unit test in `rocnoc.rs` (matching column extracts the price; wrong model errors).
- `tests/desktop-scraper-parity.test.ts` — URL parity stays green; the card fallback keeps the shared selector identical on both platforms.

## Success Criteria

- ROC-NOC returns `$209.00` USD for CRS326-24G-2S+RM through the real parser path.
- `pnpm verify` stays green.
