use super::{ScrapeResult, fetch_html, parse_price_page};
use crate::scrapers::browser::fetch_with_browser;

pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let url = format!("https://linitx.com/search.php?keywords={}", urlencoding::encode(model));
    let html = if use_browser {
        match fetch_with_browser(&url, Some(".product__price, .price--main, .price"), Some(30000)).await {
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
        "GBP",
        ".prodprice, .product__price, .price",
        ".prodinfo-stock-view-status, .product__stock, .stock",
    )
}
