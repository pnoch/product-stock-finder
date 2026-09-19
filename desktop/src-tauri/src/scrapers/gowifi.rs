use super::{ScrapeResult, fetch_html, parse_price_page};
use crate::scrapers::browser::fetch_with_browser;

pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let url = format!("https://gowifi.co.nz/search?q={}", urlencoding::encode(model));
    // Browser-first with a plain fallback (mirrors mobile's resilient.ts
    // escalation): a browser failure must not lose the plain-HTML path.
    let html = if use_browser {
        match fetch_with_browser(&url, Some(".product-price, .price"), Some(30000)).await {
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

fn parse_html(html: &str, url: &str, model: &str) -> Result<ScrapeResult, String> {
    parse_price_page(
        html,
        url,
        model,
        "NZD",
        ".product-price, .price, [data-product-price]",
        ".stock-status, .availability, .product-stock",
    )
}
