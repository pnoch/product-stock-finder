use super::{ScrapeResult, fetch_html, infer_stock_status, parse_price_from_text};
use crate::scrapers::browser::fetch_with_browser;
use scraper::{Html, Selector};

pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let url = format!("https://networkdevicesinc.com/search?q={}", urlencoding::encode(model));
    let html = if use_browser {
        fetch_with_browser(&url, Some(".product-price, .price"), Some(30000)).await?
    } else {
        fetch_html(&url, 3000)
            .await
            .map_err(|e| format!("Fetch failed: {}", e))?
    };
    parse_html(&html, &url)
}

fn parse_html(html: &str, url: &str) -> Result<ScrapeResult, String> {
    let document = Html::parse_document(html);

    let price_selector = Selector::parse(".product-price, .price, [data-price]")
        .map_err(|e| e.to_string())?;
    let stock_selector = Selector::parse(".stock-status, .availability, .stock")
        .map_err(|e| e.to_string())?;

    let price_text = document
        .select(&price_selector)
        .next()
        .map(|el| el.text().collect::<String>())
        .ok_or("Price not found")?;

    let price = parse_price_from_text(&price_text)
        .ok_or_else(|| format!("Could not parse price: {}", price_text))?;

    let stock_text = document
        .select(&stock_selector)
        .next()
        .map(|el| el.text().collect::<String>())
        .unwrap_or_default();

    let stock_status = infer_stock_status(&stock_text);

    Ok(ScrapeResult {
        price,
        currency: "USD".to_string(),
        stock_status,
        expected_date: None,
        url: url.to_string(),
    })
}
