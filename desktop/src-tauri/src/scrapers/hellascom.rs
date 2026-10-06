use super::{
    fetch_html, infer_stock_status, parse_price_page, text_mentions_model, ScrapeResult,
};
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
    let label_sel = Selector::parse(
        ".block_avail_status_label .title b, .product_availability_status .title b",
    )
    .ok()?;
    for card in document.select(&card_sel) {
        if !text_mentions_model(&card.text().collect::<String>(), model) {
            continue;
        }
        if let Some(text) = card
            .select(&label_sel)
            .next()
            .map(|b| b.text().collect::<String>())
        {
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
        ".ty-grid-list__price, .ty-product-block__price-actual, .product-price, .price",
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
