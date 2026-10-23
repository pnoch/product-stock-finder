use super::browser::fetch_with_browser;
use super::ScrapeResult;
use regex::Regex;
use std::sync::OnceLock;

// Lazada Thailand marketplace parser. Mirrors lib/scrapers/lazada-th.ts:
// the model key is `lazada-th-{itemId}-{skuId}`, the canonical product URL is
// fetched plain-first (the page renders server-side, so datacenter plain HTTP
// works — unlike Shopee's traffic wall), and the price comes from the embedded
// `pdt_price` guarded by item identity and the selected sku. No login wall was
// observed, so a missing price is a plain miss.
pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let (item_id, sku_id) =
        split_model(model).ok_or_else(|| format!("Not a Lazada TH model key: {}", model))?;
    let url = format!(
        "https://www.lazada.co.th/products/i{}-s{}.html",
        item_id, sku_id
    );
    // Plain-first (mirrors mobile's omitted `useBrowser`): escalate to the
    // browser only when the plain fetch fails, matching the shared
    // resilient.ts escalation. No wait selector (deliberately None): the price
    // is embedded state, not a rendered element.
    let html = if use_browser {
        fetch_with_browser(&url, None, Some(25000)).await?
    } else {
        match super::fetch_html(&url, 3000).await {
            Ok(html) => html,
            Err(_) => fetch_with_browser(&url, None, Some(25000)).await?,
        }
    };
    parse_html(&html, &url, item_id, sku_id)
}

fn split_model(model: &str) -> Option<(&str, &str)> {
    let rest = model.strip_prefix("lazada-th-")?;
    let (item, sku) = rest.split_once('-')?;
    if item.is_empty() || sku.is_empty() {
        return None;
    }
    if !item.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if !sku.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if item == "0" || sku == "0" {
        return None;
    }
    Some((item, sku))
}

fn sku_selected(html: &str, sku_id: &str) -> bool {
    // `_p_sku=<digits>` and `"pdt_simplesku":<digits>` (plus backslash-escaped
    // copies). The run is greedy, so a stored sku that is a digit-prefix of the
    // page's sku (or vice versa) never compares equal — the equivalent of the
    // shared `(?!\d)` guard (the regex crate has no look-ahead).
    static SKU_RES: OnceLock<[Regex; 2]> = OnceLock::new();
    let res = SKU_RES.get_or_init(|| {
        [
            Regex::new(r"_p_sku=([0-9]+)").expect("sku regex"),
            Regex::new(r#"pdt_simplesku\\?":([0-9]+)"#).expect("simplesku regex"),
        ]
    });
    res.iter()
        .flat_map(|re| re.captures_iter(html))
        .any(|cap| cap.get(1).is_some_and(|m| m.as_str() == sku_id))
}

fn price_text(html: &str) -> Option<&str> {
    // First `pdt_price` occurrence, plain (`"pdt_price":"…"`) or
    // backslash-escaped (`pdt_price\":\"…\"`).
    static PRICE_RES: OnceLock<[Regex; 2]> = OnceLock::new();
    let res = PRICE_RES.get_or_init(|| {
        [
            Regex::new(r#"pdt_price\\?":\\?"([^"\\]+)""#).expect("escaped price regex"),
            Regex::new(r#"pdt_price":"([^"]+)""#).expect("plain price regex"),
        ]
    });
    res.iter()
        .find_map(|re| re.captures(html))
        .and_then(|cap| cap.get(1).map(|m| m.as_str()))
}

// Mirrors the shared `parseThb`: ฿-prefixed figure, commas stripped, positive.
fn parse_thb(text: &str) -> Option<f64> {
    static THB_RE: OnceLock<Regex> = OnceLock::new();
    let re = THB_RE.get_or_init(|| Regex::new(r"฿\s*([0-9.]+)").expect("thb regex"));
    let cleaned = text.replace(',', "");
    let raw = re.captures(&cleaned)?;
    let n: f64 = raw.get(1)?.as_str().parse().ok()?;
    if n.is_finite() && n > 0.0 {
        Some((n * 100.0).round() / 100.0)
    } else {
        None
    }
}

fn is_out_of_stock(html: &str) -> bool {
    static OOS_RE: OnceLock<Regex> = OnceLock::new();
    let re = OOS_RE.get_or_init(|| {
        Regex::new(r#""availability"\s*:\s*"https?://schema\.org/OutOfStock""#).expect("oos regex")
    });
    re.is_match(html)
}

// Returns (price, in_stock). `og:title` is the product title, not the variant,
// so the variant stays user-entered (mirrors the shared `variantName: null`).
fn parse_price(html: &str, item_id: &str, sku_id: &str) -> Option<(f64, bool)> {
    // Identity guard: the page must reference our item.
    let id_ok = html.contains(&format!("{}_TH-{}", item_id, sku_id))
        || html.contains(&format!("_p_item={}", item_id));
    if !id_ok {
        return None;
    }
    // Selected-sku guard: refuse the price when the page's selected sku differs.
    if !sku_selected(html, sku_id) {
        return None;
    }
    let price = price_text(html).and_then(parse_thb)?;
    Some((price, !is_out_of_stock(html)))
}

fn parse_html(html: &str, url: &str, item_id: &str, sku_id: &str) -> Result<ScrapeResult, String> {
    if let Some((price, in_stock)) = parse_price(html, item_id, sku_id) {
        if price > 0.0 {
            return Ok(ScrapeResult {
                price,
                currency: "THB".to_string(),
                stock_status: if in_stock {
                    "in_stock".to_string()
                } else {
                    "out_of_stock".to_string()
                },
                expected_date: None,
                url: url.to_string(),
            });
        }
    }
    Err("No Lazada TH price found".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ITEM: &str = "16199450766";
    const SKU: &str = "127341978928";

    fn fixture(sku: &str, price: &str, availability: &str) -> String {
        format!(
            r#"<html><head>
<meta property="og:title" content="ASUS ROG Strix SCAR 18 (2026) gaming laptop" />
<script>window.__PRELOADED__={{"page":{{"xParams":"_p_typ=pdp&_p_ispdp=1&_p_item={item}_TH-{sku}&_p_prod={item}&_p_sku={sku}&_p_slr="}},"seller_name":"","pdt_simplesku":{sku},"pdt_name":"ASUS ROG Strix","pdt_price":"{price}"}};</script>
<script type="application/ld+json">{{"@type":"Product","name":"ASUS ROG Strix","offers":{{"price":"237290.00","priceCurrency":"THB","availability":"{availability}"}},"sku":"{item}_TH-{sku}"}}</script>
</head><body></body></html>"#,
            item = ITEM,
            sku = sku,
            price = price,
            availability = availability,
        )
    }

    fn good() -> String {
        fixture(SKU, "฿237,290.00", "https://schema.org/InStock")
    }

    #[test]
    fn splits_valid_model_keys() {
        assert_eq!(
            split_model("lazada-th-16199450766-127341978928"),
            Some(("16199450766", "127341978928"))
        );
        assert_eq!(split_model("CRS804"), None);
        assert_eq!(split_model("lazada-th-abc-123"), None);
        assert_eq!(split_model("lazada-th-16199450766-"), None);
    }

    #[test]
    fn extracts_pdt_price_with_matching_selected_sku() {
        let out = parse_html(
            &good(),
            "https://www.lazada.co.th/products/i16199450766-s127341978928.html",
            ITEM,
            SKU,
        )
        .unwrap();
        assert_eq!(out.price, 237290.0);
        assert_eq!(out.currency, "THB");
        assert_eq!(out.stock_status, "in_stock");
    }

    #[test]
    fn reads_the_opening_escaped_price_copy() {
        // Mirrors the shared first-branch regex (`pdt_price\?":…` with a plain
        // closing quote): the fully-escaped copy (`…\"`) is rejected on both
        // platforms, so only this spelling is locked here.
        let html = good().replace(
            "\"pdt_price\":\"฿237,290.00\"",
            r#"pdt_price\":"฿237,290.00""#,
        );
        let out = parse_html(&html, "https://www.lazada.co.th", ITEM, SKU).unwrap();
        assert_eq!(out.price, 237290.0);
    }

    #[test]
    fn rejects_mismatched_selected_sku() {
        // Page selected another variant's sku: the price belongs to it, not us.
        assert!(parse_html(
            &fixture("999", "฿100.00", "https://schema.org/InStock"),
            "https://www.lazada.co.th",
            ITEM,
            SKU
        )
        .is_err());
    }

    #[test]
    fn rejects_missing_identity_markers() {
        let html = "<html><body><p>pdt_price\":\"฿100.00\"</p></body></html>";
        assert!(parse_html(html, "https://www.lazada.co.th", ITEM, SKU).is_err());
    }

    #[test]
    fn out_of_stock_keeps_the_price_with_false_stock() {
        let html = fixture(SKU, "฿237,290.00", "https://schema.org/OutOfStock");
        let out = parse_html(&html, "https://www.lazada.co.th", ITEM, SKU).unwrap();
        assert_eq!(out.price, 237290.0);
        assert_eq!(out.stock_status, "out_of_stock");
    }

    #[test]
    fn rejects_non_thb_price_text() {
        let html = fixture(SKU, "$1,299.00", "https://schema.org/InStock");
        assert!(parse_html(&html, "https://www.lazada.co.th", ITEM, SKU).is_err());
    }
}
