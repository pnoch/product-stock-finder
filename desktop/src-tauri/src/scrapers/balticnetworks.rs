use super::{ScrapeResult, fetch_html, parse_price_page};
use crate::scrapers::browser::fetch_with_browser;

pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let url = format!("https://balticnetworks.com/search?q={}", urlencoding::encode(model));
    let html = if use_browser {
        fetch_with_browser(&url, Some(".product-price, .price"), Some(30000)).await?
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
        "USD",
        ".price__current, [data-price-container]",
        ".stock-status, .availability, .stock",
    )
}
