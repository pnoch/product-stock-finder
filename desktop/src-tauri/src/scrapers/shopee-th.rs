use super::browser::fetch_with_browser;
use super::ScrapeResult;

// Shopee Thailand marketplace parser. Mirrors lib/scrapers/shopee-th.ts:
// the model key is `shopee-th-{shopId}-{itemId}`, the canonical product URL is
// fetched in a real browser (datacenter plain HTTP is traffic-walled), and the
// price comes from embedded page state guarded by shop/item identity.
// Browser-first with no wait selector (deliberately None, matching mobile's
// omitted browserOptions): Shopee's price element classes are obfuscated.
pub async fn scrape(model: &str, use_browser: bool) -> Result<ScrapeResult, String> {
    let (shop_id, item_id) =
        split_model(model).ok_or_else(|| format!("Not a Shopee TH model key: {}", model))?;
    let url = format!("https://shopee.co.th/product/{}/{}", shop_id, item_id);
    // Browser-first (mirrors mobile `useBrowser: true`): plain fetch from a
    // datacenter is traffic-walled, so only fall back to it when no browser.
    let html = if use_browser {
        match fetch_with_browser(&url, None, Some(25000)).await {
            Ok(html) => html,
            Err(e) => return Err(e),
        }
    } else {
        super::fetch_html(&url, 3000)
            .await
            .map_err(|e| format!("Fetch failed: {}", e))?
    };
    parse_html(&html, &url, shop_id, item_id)
}

fn split_model(model: &str) -> Option<(&str, &str)> {
    let rest = model.strip_prefix("shopee-th-")?;
    let (shop, item) = rest.split_once('-')?;
    if shop.is_empty() || item.is_empty() {
        return None;
    }
    if !shop.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if !item.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if shop == "0" || item == "0" {
        return None;
    }
    Some((shop, item))
}

fn is_login_wall(html: &str) -> bool {
    html.contains("ต้องเข้าสู่ระบบ")
        || html.contains("verify/traffic")
        || html.contains("is_logged_in=false")
}

// Finds a {...} JSON object containing both ids and returns (price, stock,
// variant). Balanced-brace scan from each `"shopid"`/`"shopId"` occurrence;
// keeps the first object whose ids match.
fn find_state_object(
    html: &str,
    shop_id: &str,
    item_id: &str,
) -> Option<(f64, i64, Option<String>)> {
    for key in ["\"shopid\"", "\"shopId\""] {
        let mut search_from = 0;
        while let Some(pos) = html[search_from..].find(key).map(|p| p + search_from) {
            // Walk back to the enclosing '{'.
            let mut depth: i32 = 0;
            let mut start: Option<usize> = None;
            for (i, ch) in html[..pos].char_indices().rev() {
                if ch == '}' {
                    depth += 1;
                }
                if ch == '{' {
                    if depth == 0 {
                        start = Some(i);
                        break;
                    }
                    depth -= 1;
                }
            }
            if let Some(s) = start {
                // Walk forward balancing braces.
                let mut d: i32 = 0;
                let mut end: Option<usize> = None;
                for (i, ch) in html[s..].char_indices() {
                    if ch == '{' {
                        d += 1;
                    }
                    if ch == '}' {
                        d -= 1;
                        if d == 0 {
                            end = Some(s + i + ch.len_utf8());
                            break;
                        }
                    }
                }
                if let Some(e) = end {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&html[s..e]) {
                        let sid = v.get("shopid").or_else(|| v.get("shopId"));
                        let iid = v.get("itemid").or_else(|| v.get("itemId"));
                        let sid = sid.and_then(|x| {
                            x.as_u64()
                                .map(|n| n.to_string())
                                .or_else(|| x.as_str().map(|s| s.to_string()))
                        });
                        let iid = iid.and_then(|x| {
                            x.as_u64()
                                .map(|n| n.to_string())
                                .or_else(|| x.as_str().map(|s| s.to_string()))
                        });
                        if sid.as_deref() == Some(shop_id) && iid.as_deref() == Some(item_id) {
                            let price = v.get("price").and_then(|x| x.as_f64());
                            let pmin = v.get("price_min").and_then(|x| x.as_f64());
                            let pmax = v.get("price_max").and_then(|x| x.as_f64());
                            let stock = v.get("stock").and_then(|x| x.as_i64()).unwrap_or(1);
                            let variant = v
                                .get("selected_model")
                                .and_then(|m| m.get("name"))
                                .and_then(|n| n.as_str())
                                .map(|s| s.to_string());
                            // Range without a selected variant price: refuse to guess.
                            if let (Some(lo), Some(hi)) = (pmin, pmax) {
                                if (hi - lo).abs() > f64::EPSILON {
                                    let sel = v
                                        .get("selected_model")
                                        .and_then(|m| m.get("price"))
                                        .and_then(|x| x.as_f64());
                                    if let Some(p) = sel {
                                        return Some((p, stock, variant));
                                    }
                                    // Advance past this object: `continue`
                                    // would skip the search_from update below
                                    // and loop on the same match forever.
                                    search_from = pos + key.len();
                                    continue;
                                }
                            }
                            let p = price.or(pmin);
                            if let Some(p) = p {
                                if p > 0.0 {
                                    return Some((p, stock, variant));
                                }
                            }
                        }
                    }
                }
            }
            search_from = pos + key.len();
        }
    }
    None
}

fn parse_html(html: &str, url: &str, shop_id: &str, item_id: &str) -> Result<ScrapeResult, String> {
    if is_login_wall(html) {
        return Err("Shopee login required".to_string());
    }
    if let Some((price, stock, _variant)) = find_state_object(html, shop_id, item_id) {
        if price > 0.0 {
            return Ok(ScrapeResult {
                price,
                currency: "THB".to_string(),
                stock_status: if stock > 0 {
                    "in_stock".to_string()
                } else {
                    "out_of_stock".to_string()
                },
                expected_date: None,
                url: url.to_string(),
            });
        }
    }
    Err("No Shopee TH price found".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_valid_model_keys() {
        assert_eq!(
            split_model("shopee-th-1950119-28177881956"),
            Some(("1950119", "28177881956"))
        );
        assert_eq!(split_model("CRS804"), None);
        assert_eq!(split_model("shopee-th-abc-123"), None);
        assert_eq!(split_model("shopee-th-1950119-"), None);
    }

    #[test]
    fn rejects_the_login_wall() {
        let html = "<html><body>ต้องเข้าสู่ระบบ</body></html>";
        assert!(parse_html(html, "https://shopee.co.th", "1950119", "28177881956").is_err());
    }

    #[test]
    fn extracts_embedded_state_price() {
        let html = r#"<html><body><script>{"shopid":1950119,"itemid":28177881956,"price":1290,"stock":42}</script></body></html>"#;
        let out = parse_html(
            html,
            "https://shopee.co.th/product/1950119/28177881956",
            "1950119",
            "28177881956",
        )
        .unwrap();
        assert_eq!(out.price, 1290.0);
        assert_eq!(out.currency, "THB");
        assert_eq!(out.stock_status, "in_stock");
    }

    #[test]
    fn rejects_mismatched_ids_and_ranges() {
        let other = r#"<html><body><script>{"shopid":999,"itemid":888,"price":100,"stock":1};</script></body></html>"#;
        assert!(parse_html(other, "https://shopee.co.th", "1950119", "28177881956").is_err());
        let range = r#"<html><body><script>{"shopid":1950119,"itemid":28177881956,"price_min":899,"price_max":1299,"stock":10};</script></body></html>"#;
        assert!(parse_html(range, "https://shopee.co.th", "1950119", "28177881956").is_err());
    }
}
