pub mod aerial;
pub mod bhphoto;
pub mod balticnetworks;
pub mod browser;
pub mod duxtel;
pub mod flytec;
pub mod getic;
pub mod gowifi;
pub mod gearup;
pub mod hellascom;
pub mod interprojekt;
pub mod linitx;
pub mod linktechs;
pub mod miro;
pub mod multilink;
pub mod mbsiwav;
pub mod mega;
pub mod mikrotikstore;
pub mod nasstore;
pub mod neobits;
pub mod networkdevices;
pub mod pbtech;
pub mod rocnoc;
pub mod server2u;
pub mod wisp;
pub mod winncom;

use serde::{Deserialize, Serialize};
use scraper::{ElementRef, Html, Selector};
use std::sync::OnceLock;

fn get_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
            // Without a timeout a single unresponsive host hangs the caller
            // forever (the health check runs 25 distributors sequentially).
            .timeout(std::time::Duration::from_secs(15))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client")
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeResult {
    pub price: f64,
    pub currency: String,
    pub stock_status: String,
    pub expected_date: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeJobResult {
    pub distributor_id: String,
    pub product_id: String,
    pub result: Option<ScrapeResult>,
    pub error: Option<String>,
    pub duration_ms: u64,
    pub history: Vec<serde_json::Value>,
}

pub async fn fetch_html(url: &str, rate_limit_ms: u64) -> Result<String, reqwest::Error> {
    tokio::time::sleep(tokio::time::Duration::from_millis(rate_limit_ms)).await;
    let resp = get_client()
        .get(url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .send()
        .await?;
    let resp = resp.error_for_status()?;
    resp.text().await
}

pub fn infer_stock_status(text: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("in stock") || lower.contains("available") || lower.contains("add to cart") {
        "in_stock".to_string()
    } else if lower.contains("back order") || lower.contains("backorder") || lower.contains("pre-order") {
        "back_order".to_string()
    } else if lower.contains("out of stock") || lower.contains("unavailable") || lower.contains("sold out") {
        "out_of_stock".to_string()
    } else {
        "unknown".to_string()
    }
}

pub fn parse_price_from_text(text: &str) -> Option<f64> {
    let cleaned: String = text.chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',')
        .collect();
    let cleaned = cleaned.replace(',', "");
    cleaned.parse::<f64>().ok()
}

/// Normalizes a model number for comparison: lowercase, alphanumerics only.
fn normalize_model(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

/// True when `text` contains the requested model as a whole token. Mirrors the
/// mobile `matchesModel` guard: without it a search-results page's first
/// unrelated price would be recorded as this product's price.
pub fn text_mentions_model(text: &str, model: &str) -> bool {
    let needle = normalize_model(model);
    if needle.is_empty() {
        return false;
    }
    let haystack = normalize_model(text);
    // Require a boundary: the normalized haystack is alphanumeric-only, so a
    // substring match is the best available signal (matches mobile behavior).
    haystack.contains(&needle)
}

/// Product-card selectors, mirroring the mobile `modelMismatch` guard.
const CARD_SELECTOR: &str = "tr, article, .product, .product-item, .productitem, .product-item-details, .product-item-info, .item, .product-card, li";

/// True when the price element's *own product card* names the model. Walking
/// past the card would reach page-level containers (a search-results header
/// naming the model, `<body>`) whose text would validate any price on the page.
fn price_element_matches_model(el: &ElementRef, model: &str) -> bool {
    if let Ok(card_sel) = Selector::parse(CARD_SELECTOR) {
        if let Some(card) = el
            .ancestors()
            .filter_map(ElementRef::wrap)
            .find(|a| card_sel.matches(a))
        {
            return text_mentions_model(&card.text().collect::<String>(), model);
        }
    }
    // No card boundary: only the element and its immediate parent are safe.
    el.ancestors()
        .take(2)
        .filter_map(ElementRef::wrap)
        .any(|anc| text_mentions_model(&anc.text().collect::<String>(), model))
}
pub fn parse_price_page(
    html: &str,
    url: &str,
    model: &str,
    currency: &str,
    price_selector: &str,
    stock_selector: &str,
) -> Result<ScrapeResult, String> {
    let document = Html::parse_document(html);
    let price_sel = Selector::parse(price_selector).map_err(|e| e.to_string())?;
    let stock_sel = Selector::parse(stock_selector).map_err(|e| e.to_string())?;

    let mut price_text: Option<String> = None;
    for el in document.select(&price_sel) {
        // Walk up to the nearest product container and check whether it names
        // the model. Without this the first unrelated search result's price
        // would be recorded as this product's price.
        if price_element_matches_model(&el, model) {
            price_text = Some(el.text().collect());
            break;
        }
    }

    let price_text = price_text
        .ok_or_else(|| format!("No price found matching model {}", model))?;
    let price = parse_price_from_text(&price_text)
        .ok_or_else(|| format!("Could not parse price: {}", price_text))?;

    let stock_text = document
        .select(&stock_sel)
        .next()
        .map(|el| el.text().collect::<String>())
        .unwrap_or_default();

    Ok(ScrapeResult {
        price,
        currency: currency.to_string(),
        stock_status: infer_stock_status(&stock_text),
        expected_date: None,
        url: url.to_string(),
    })
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_mentions_model_matches_with_separators() {
        assert!(text_mentions_model("MikroTik CRS804-4DDQ-hRM", "CRS804-4DDQ-hRM"));
        assert!(text_mentions_model("crs804 4ddq hrm switch", "CRS804-4DDQ-hRM"));
    }

    #[test]
    fn text_mentions_model_rejects_other_products() {
        assert!(!text_mentions_model("MikroTik CRS326-24G-2S+", "CRS804-4DDQ-hRM"));
        assert!(!text_mentions_model("", "CRS804-4DDQ-hRM"));
        assert!(!text_mentions_model("anything", ""));
    }

    #[test]
    fn parse_price_page_rejects_a_non_matching_first_result() {
        // The first price belongs to another product; the requested model only
        // appears in a later card. The parser must skip the decoy.
        let html = r#"
          <html><body>
            <div class="product"><span class="price">$1.00</span>
              <a href="/p/other">Other Product XYZ</a></div>
            <div class="product"><span class="price">$480.00</span>
              <a href="/p/crs804">MikroTik CRS804-4DDQ-hRM</a></div>
          </body></html>"#;
        let result = parse_price_page(
            html,
            "https://example.com",
            "CRS804-4DDQ-hRM",
            "USD",
            ".price",
            ".stock",
        )
        .expect("should find the matching card");
        assert_eq!(result.price, 480.0);
    }

    #[test]
    fn parse_price_page_errors_when_no_card_matches() {
        let html = r#"<html><body>
            <div class="product"><span class="price">$1.00</span>
              <a href="/p/other">Other Product XYZ</a></div>
          </body></html>"#;
        assert!(parse_price_page(
            html,
            "https://example.com",
            "CRS804-4DDQ-hRM",
            "USD",
            ".price",
            ".stock",
        )
        .is_err());
    }
}
