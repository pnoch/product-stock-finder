use super::{ScrapeResult, fetch_html, parse_price_page};
use crate::scrapers::browser::fetch_with_browser;
use scraper::{Html, Selector};

async fn fetch(url: &str, use_browser: bool) -> Result<String, String> {
    if use_browser {
        match fetch_with_browser(url, Some(".product-price, .price"), Some(30000)).await {
            Ok(html) => Ok(html),
            Err(_) => fetch_html(url, 3000)
                .await
                .map_err(|e| format!("Fetch failed: {}", e)),
        }
    } else {
        fetch_html(url, 3000)
            .await
            .map_err(|e| format!("Fetch failed: {}", e))
    }
}

/// The search page is JS-rendered and ignores the query, so the caller must hop
/// to a product page before parsing (mirrors mobile's `resolveProductUrl`).
/// Accessory slugs embed the model they fit, so they are penalized.
pub fn resolve_product_url(html: &str, model: &str) -> Option<String> {
    let wanted: String = model
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    if wanted.is_empty() {
        return None;
    }
    let model_tokens: Vec<String> = tokenize(&wanted);
    if model_tokens.is_empty() {
        return None;
    }
    const ACCESSORY_MARKERS: [&str; 12] = [
        "power-supply",
        "psu",
        "adapter",
        "mount",
        "bracket",
        "cable",
        "antenna",
        "case",
        "rack",
        "fan",
        "poe-injector",
        "accessory",
    ];
    let document = Html::parse_document(html);
    let link_sel = Selector::parse("a[href]").ok()?;
    let mut best: Option<String> = None;
    let mut best_score = f64::NEG_INFINITY;
    for el in document.select(&link_sel) {
        let Some(href) = el.value().attr("href") else {
            continue;
        };
        if !href.contains("/en/mikrotik-") && !href.contains("/en/switches/") {
            continue;
        }
        let slug = href.rsplit('/').next().unwrap_or("");
        let normalized: String = slug
            .to_lowercase()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();
        let slug_tokens = tokenize(&normalized);
        let matched = model_tokens
            .iter()
            .filter(|t| {
                slug_tokens.iter().any(|s| {
                    s == *t
                        || (t.len() >= 2 && s.contains(t.as_str()))
                        || (s.len() >= 2 && t.contains(s.as_str()))
                })
            })
            .count();
        let coverage = matched as f64 / model_tokens.len() as f64;
        if coverage < 0.4 {
            continue;
        }
        let lower_slug = slug.to_lowercase();
        let accessory = ACCESSORY_MARKERS.iter().any(|m| lower_slug.contains(m));
        let score = coverage * 1000.0 - if accessory { 500.0 } else { 0.0 }
            - normalized.len() as f64 * 0.1;
        if score > best_score {
            best_score = score;
            best = Some(href.to_string());
        }
    }
    best
}

fn tokenize(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    for c in s.chars() {
        if c.is_ascii_alphanumeric() {
            cur.push(c);
        } else if !cur.is_empty() {
            out.push(std::mem::take(&mut cur));
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let search_url = format!(
        "https://mikrotik-store.eu/en/search?q={}",
        urlencoding::encode(model)
    );
    let search_html = fetch(&search_url, use_browser).await?;
    let mut url = resolve_product_url(&search_html, model)
        .ok_or_else(|| "No matching product link".to_string())?;
    // The search page may land on a category page; follow one more hop.
    if !is_product_page(&url) {
        if let Ok(cat_html) = fetch(&url, use_browser).await {
            if let Some(product) = resolve_product_url(&cat_html, model) {
                url = product;
            }
        }
    }
    let product_html = fetch(&url, use_browser).await?;
    parse_html(&product_html, &url, model)
}

/// Category pages are exactly `/en/switches/<category>` (nothing after);
/// everything else matched by `resolve_product_url` is a product page.
fn is_product_page(url: &str) -> bool {
    let trimmed = url.trim_end_matches('/');
    let segments: Vec<&str> = trimmed.split('/').filter(|s| !s.is_empty()).collect();
    // ["https:", "mikrotik-store.eu", "en", "switches", "<category>"]
    !(segments.len() == 5 && segments[2] == "en" && segments[3] == "switches")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_prefers_the_product_over_an_accessory() {
        let html = r#"
          <a href="/en/mikrotik-up1302c-12-power-supply-for-ccr1036r2-crs326-24s2qrm">PSU</a>
          <a href="/en/mikrotik-crs326-24s2qrm">CRS326-24S+2Q+RM</a>
        "#;
        let url = resolve_product_url(html, "CRS326-24S+2Q+RM").unwrap();
        assert_eq!(url, "/en/mikrotik-crs326-24s2qrm");
    }

    #[test]
    fn is_product_page_distinguishes_category_pages() {
        assert!(!is_product_page("https://mikrotik-store.eu/en/switches/ethernet"));
        assert!(is_product_page("https://mikrotik-store.eu/en/mikrotik-crs326-24s2qrm"));
    }
}

fn parse_html(html: &str, url: &str, model: &str) -> Result<ScrapeResult, String> {
    parse_price_page(
        html,
        url,
        model,
        "EUR",
        ".price-tag, .product-price, .product-detail-price, [itemprop='price']",
        ".product-detail-delivery-status, .delivery-status, .availability, .stock-status",
    )
}
