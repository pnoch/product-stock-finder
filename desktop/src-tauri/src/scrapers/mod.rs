pub mod server2u;

use serde::{Deserialize, Serialize};

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
}

pub async fn fetch_html(url: &str, rate_limit_ms: u64) -> Result<String, reqwest::Error> {
    tokio::time::sleep(tokio::time::Duration::from_millis(rate_limit_ms)).await;
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .send()
        .await?;
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