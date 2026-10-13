use super::browser::fetch_with_browser;
use super::ScrapeResult;
use regex::Regex;
use std::sync::OnceLock;

// eBay US marketplace parser. Mirrors lib/scrapers/ebay.ts: the model key is
// `ebay-us-{itemId}`, the canonical product URL is
// `https://www.ebay.com/itm/{itemId}`, and the price comes from the page's
// JSON-LD Product (rendered as an array) guarded by item identity.
// Browser-first (mirrors mobile `useBrowser: true`): a datacenter plain fetch is
// answered with an error page, so only fall back to it when no browser is
// available. No wait selector (deliberately None): the price is embedded
// JSON-LD, not a rendered element.
pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let item_id = split_model(model)
        .ok_or_else(|| format!("Not an eBay US model key: {}", model))?;
    let url = format!("https://www.ebay.com/itm/{}", item_id);
    let html = if use_browser {
        fetch_with_browser(&url, None, Some(25000)).await?
    } else {
        super::fetch_html(&url, 3000)
            .await
            .map_err(|e| format!("Fetch failed: {}", e))?
    };
    parse_html(&html, &url, item_id)
}

fn split_model(model: &str) -> Option<&str> {
    let rest = model.strip_prefix("ebay-us-")?;
    // Matches the shared `^ebay-us-([1-9]\d{0,19})$`: digits only, no leading
    // zero, at most 20 digits.
    if rest.is_empty() || rest.len() > 20 { return None; }
    if rest.starts_with('0') { return None; }
    if !rest.bytes().all(|b| b.is_ascii_digit()) { return None; }
    Some(rest)
}

fn strip_wbr(value: &str) -> String {
    static WBR_RE: OnceLock<Regex> = OnceLock::new();
    let re = WBR_RE.get_or_init(|| Regex::new(r"(?i)<wbr\s*/?>").expect("wbr regex"));
    re.replace_all(value, "").into_owned()
}

// Mirrors the shared `Number(offers.price)`: a JSON number or a numeric string.
fn json_number(value: &serde_json::Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|s| s.parse::<f64>().ok()))
}

// `title`/`condition` are extracted for parity with the shared EbayPrice and
// asserted in the tests; the desktop ScrapeResult carries neither, so they are
// dead on the non-test target.
#[allow(dead_code)]
struct JsonLdProduct {
    price: f64,
    currency: String,
    title: Option<String>,
    in_stock: bool,
    condition: Option<String>,
}

// Finds the first Product in the page's JSON-LD, accepting the array form eBay
// renders. Mirrors the shared `parseJsonLdProduct`: a non-object `offers` (or a
// missing/non-positive price, or no currency) is skipped, not treated as a
// match — the loop moves on to the next product/block.
fn parse_json_ld_product(html: &str) -> Option<JsonLdProduct> {
    static LD_RE: OnceLock<Regex> = OnceLock::new();
    let re = LD_RE.get_or_init(|| {
        Regex::new(r#"(?is)<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>"#)
            .expect("ld+json regex")
    });
    for cap in re.captures_iter(html) {
        let Some(raw) = cap.get(1) else { continue };
        let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw.as_str()) else {
            continue;
        };
        let items: Vec<&serde_json::Value> = match &parsed {
            serde_json::Value::Array(arr) => arr.iter().collect(),
            other => vec![other],
        };
        for item in items {
            if item.get("@type").and_then(|t| t.as_str()) != Some("Product") {
                continue;
            }
            let Some(offers) = item.get("offers").filter(|o| o.is_object()) else {
                continue;
            };
            let Some(price) = offers.get("price").and_then(json_number) else {
                continue;
            };
            let Some(currency) = offers.get("priceCurrency").and_then(|c| c.as_str()) else {
                continue;
            };
            if !price.is_finite() || price <= 0.0 || currency.is_empty() {
                continue;
            }
            let availability = offers
                .get("availability")
                .and_then(|a| a.as_str())
                .unwrap_or("");
            let condition = offers
                .get("itemCondition")
                .and_then(|c| c.as_str())
                .and_then(|c| {
                    if c.contains("NewCondition") {
                        Some("New".to_string())
                    } else if c.contains("UsedCondition") {
                        Some("Used".to_string())
                    } else {
                        None
                    }
                });
            return Some(JsonLdProduct {
                price,
                currency: currency.to_string(),
                title: item.get("name").and_then(|n| n.as_str()).map(strip_wbr),
                in_stock: availability.contains("InStock"),
                condition,
            });
        }
    }
    None
}

fn is_error_page(head: &str) -> bool {
    static ERROR_RE: OnceLock<Regex> = OnceLock::new();
    let re = ERROR_RE
        .get_or_init(|| Regex::new(r"(?i)Sign in or register|Error Page").expect("error regex"));
    re.is_match(head)
}

fn parse_html(html: &str, url: &str, item_id: &str) -> Result<ScrapeResult, String> {
    // Identity guard: the page must reference our item.
    let id_path = format!("/itm/{}", item_id);
    let id_json = format!("\"itemId\":\"{}\"", item_id);
    if !html.contains(&id_path) && !html.contains(&id_json) {
        return Err("No eBay US price found".to_string());
    }
    // Login wall / error pages are only trusted when they still carry JSON-LD.
    let head: String = html.chars().take(4000).collect();
    if is_error_page(&head) && parse_json_ld_product(html).is_none() {
        return Err("eBay error page".to_string());
    }
    let Some(found) = parse_json_ld_product(html) else {
        return Err("No eBay US price found".to_string());
    };
    Ok(ScrapeResult {
        price: found.price,
        currency: found.currency,
        stock_status: if found.in_stock { "in_stock".to_string() } else { "out_of_stock".to_string() },
        expected_date: None,
        url: url.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const ITEM: &str = "178212205608";
    const URL: &str = "https://www.ebay.com/itm/178212205608";

    // Realistic minimal page modeled on the real rendered eBay item: JSON-LD is
    // an array-of-Product with the THB-converted price, the title carries eBay's
    // <wbr/> break, and the DOM shows the USD price + qty availability.
    fn fixture(price: &str, currency: &str, availability: &str, condition: &str) -> String {
        format!(
            r#"<html><head>
<link rel="canonical" href="https://www.ebay.com/itm/{item}" />
<script type="application/ld+json">[{{"@context":"https://schema.org","@type":"Product","name":"MikroTik<wbr/>CRS812-8DS-2DQ-2DDQ-RM Cloud Router Switch","brand":{{"@type":"Brand","name":"MikroTik"}},"offers":{{"@type":"Offer","price":"{price}","priceCurrency":"{currency}","availability":"{availability}","itemCondition":"{condition}","url":"https://www.ebay.com/itm/{item}"}}}}]</script>
</head><body>
<span class="ux-textspans">US $3,114.00</span>
<span class="x-price-approx__price">THB104,670.88</span>
<span class="qtyAvailability">5 available</span>
</body></html>"#,
            item = ITEM,
            price = price,
            currency = currency,
            availability = availability,
            condition = condition,
        )
    }

    fn good() -> String {
        fixture(
            "104670.88",
            "THB",
            "https://schema.org/InStock",
            "https://schema.org/NewCondition",
        )
    }

    #[test]
    fn splits_valid_model_keys() {
        assert_eq!(split_model("ebay-us-178212205608"), Some("178212205608"));
        assert_eq!(split_model("CRS804"), None);
        assert_eq!(split_model("ebay-us-0123"), None);
        assert_eq!(split_model("ebay-us-"), None);
        assert_eq!(split_model("ebay-us-12a"), None);
    }

    #[test]
    fn extracts_the_json_ld_array_product() {
        let out = parse_html(&good(), URL, ITEM).unwrap();
        assert_eq!(out.price, 104670.88);
        assert_eq!(out.currency, "THB");
        assert_eq!(out.stock_status, "in_stock");

        let product = parse_json_ld_product(&good()).unwrap();
        assert_eq!(
            product.title.as_deref(),
            Some("MikroTikCRS812-8DS-2DQ-2DDQ-RM Cloud Router Switch")
        );
        assert_eq!(product.condition.as_deref(), Some("New"));
        assert!(product.in_stock);
    }

    #[test]
    fn accepts_a_bare_object_product_and_a_numeric_price() {
        let html = r#"<html><head><script type="application/ld+json">{"@type":"Product","name":"X","offers":{"price":3114,"priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script></head></html>"#;
        let out = parse_json_ld_product(html).unwrap();
        assert_eq!(out.price, 3114.0);
        assert_eq!(out.currency, "USD");
    }

    #[test]
    fn rejects_pages_that_do_not_reference_the_item() {
        let other = good().replace(ITEM, "999999999999");
        assert!(parse_html(&other, URL, ITEM).is_err());
    }

    #[test]
    fn rejects_an_error_page_without_json_ld() {
        let html = format!(
            "<html><head><title>Error Page | eBay</title></head><body>Sign in or register <a href=\"/itm/{ITEM}\">x</a></body></html>"
        );
        assert!(parse_html(&html, URL, ITEM).is_err());
    }

    #[test]
    fn keeps_the_price_but_reports_out_of_stock() {
        let html = fixture(
            "104670.88",
            "THB",
            "https://schema.org/OutOfStock",
            "https://schema.org/NewCondition",
        );
        let out = parse_html(&html, URL, ITEM).unwrap();
        assert_eq!(out.price, 104670.88);
        assert_eq!(out.stock_status, "out_of_stock");
    }

    #[test]
    fn accepts_a_usd_price_as_is() {
        let html = fixture(
            "3114.00",
            "USD",
            "https://schema.org/InStock",
            "https://schema.org/NewCondition",
        );
        let out = parse_html(&html, URL, ITEM).unwrap();
        assert_eq!(out.price, 3114.0);
        assert_eq!(out.currency, "USD");
    }

    #[test]
    fn maps_used_condition_and_leaves_unknown_null() {
        let used = fixture(
            "10.00",
            "USD",
            "https://schema.org/InStock",
            "https://schema.org/UsedCondition",
        );
        assert_eq!(
            parse_json_ld_product(&used).unwrap().condition.as_deref(),
            Some("Used")
        );
        let other = fixture(
            "10.00",
            "USD",
            "https://schema.org/InStock",
            "https://schema.org/DamagedCondition",
        );
        assert_eq!(parse_json_ld_product(&other).unwrap().condition, None);
    }

    #[test]
    fn reads_the_identity_from_the_json_item_id_marker() {
        // Some layouts carry the id only as `"itemId":"…"`, with no `/itm/` path.
        let html = format!(
            r#"<html><head><script type="application/ld+json">[{{"@type":"Product","name":"X","offers":{{"price":"5.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}}}]</script></head><body><script>window.__X={{"itemId":"{ITEM}"}};</script></body></html>"#
        );
        let out = parse_html(&html, URL, ITEM).unwrap();
        assert_eq!(out.price, 5.0);
    }

    #[test]
    fn parses_the_shipped_fixture() {
        // End-to-end against the same file the TS model-gate conformance sweep
        // reads, so the Rust port and the fixture cannot drift apart.
        const SHIPPED: &str = include_str!("../../../../tests/fixtures/scrapers/ebay-us.html");
        let out = parse_html(SHIPPED, URL, ITEM).unwrap();
        assert_eq!(out.currency, "THB");
        assert!(out.price > 0.0);
        assert_eq!(out.stock_status, "in_stock");
        assert!(split_model("__NO_SUCH_MODEL__").is_none());
    }
}
