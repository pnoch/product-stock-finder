use super::{
    fetch_html, infer_stock_status, parse_price_from_text, parse_price_page, text_mentions_model,
    ScrapeResult,
};
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

/// The nearest ancestor (or self) that is a `<td>`, then its column index.
fn cell_column_index(el: &ElementRef) -> usize {
    let cell = std::iter::once(*el)
        .chain(el.ancestors().filter_map(ElementRef::wrap))
        .find(|n| n.value().name() == "td");
    match cell {
        Some(td) => column_index(&td),
        None => column_index(el),
    }
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
                target_col = Some(cell_column_index(&a));
                break;
            }
        }
        let Some(col) = target_col else { continue };
        let price_el_sel = Selector::parse(".price").map_err(|e| e.to_string())?;
        for td in table.select(&price_sel) {
            if cell_column_index(&td) != col {
                continue;
            }
            // Prefer the `.price` element: the cell also carries a
            // `products_data[<id>].quantity` script whose id would otherwise be
            // read as the price.
            let price_text = td
                .select(&price_el_sel)
                .next()
                .map(|p| p.text().collect::<String>())
                .unwrap_or_else(|| td.text().collect::<String>());
            let Some(price) = parse_price_from_text(&price_text) else {
                continue;
            };
            let text = td.text().collect::<String>();
            let stock_status = match text
                .split("quantity")
                .nth(1)
                .and_then(|s| s.split('=').nth(1))
                .and_then(|n| n.trim().split(|c: char| !c.is_ascii_digit()).next())
            {
                Some(n) if !n.is_empty() => {
                    if n.parse::<u64>().map(|q| q > 0).unwrap_or(false) {
                        "in_stock".to_string()
                    } else {
                        "out_of_stock".to_string()
                    }
                }
                _ => infer_stock_status(&text),
            };
            return Ok(ScrapeResult {
                price,
                currency: "USD".to_string(),
                stock_status,
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
