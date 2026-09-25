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
use regex::Regex;
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
    // Negative markers must win over substring matches like "available" in
    // "unavailable" or "in stock" in "not in stock" (mirrors the mobile
    // inferStockStatus ordering).
    if lower.contains("out of stock")
        || lower.contains("not in stock")
        || lower.contains("unavailable")
        || lower.contains("not available")
        || lower.contains("sold out")
    {
        return "out_of_stock".to_string();
    }
    if lower.contains("back order")
        || lower.contains("backorder")
        || lower.contains("pre-order")
        || lower.contains("preorder")
        // "Expected 15 Sept" is a back-order signal on mobile; omitting it made
        // desktop report unknown/in_stock for the same listing.
        || lower.contains("expected")
    {
        return "back_order".to_string();
    }
    if lower.contains("in stock") || lower.contains("available") || lower.contains("add to cart") {
        return "in_stock".to_string();
    }
    "unknown".to_string()
}

pub fn parse_price_from_text(text: &str) -> Option<f64> {
    // Mirror lib/scrapers/utils.ts: take only the FIRST number run, not every
    // digit in the element. Concatenating them turned "Was $100 Now $80" into
    // 10080 and corrupted any element containing a discount percentage.
    //
    // A space/NBSP/NNBSP between digits is a thousands separator ("R 12 345.67",
    // "1 234,56 Kč"), so it is kept; any other non-numeric char ends the run.
    let digits: String = {
        let mut out = String::new();
        let mut started = false;
        let mut pending_space = false;
        for c in text.chars() {
            if c.is_ascii_digit() || c == '.' || c == ',' {
                if pending_space && !out.is_empty() {
                    out.push(' ');
                }
                pending_space = false;
                started = true;
                out.push(c);
            } else if started && matches!(c, ' ' | '\u{00a0}' | '\u{202f}') {
                pending_space = true;
            } else if started {
                break;
            }
        }
        out
    };
    if digits.is_empty() {
        return None;
    }
    // Strip the grouping spaces now that the run is captured: "12 345.67" must
    // become "12345.67" before the separator logic runs.
    let digits = digits.replace([' ', '\u{00a0}', '\u{202f}'], "");
    let last_dot = digits.rfind('.');
    let last_comma = digits.rfind(',');
    let groups_of_three = |s: &str, sep: char| {
        let parts: Vec<&str> = s.split(sep).collect();
        parts.len() > 1
            && parts[0].len() >= 1
            && parts[0].len() <= 3
            && parts[1..].iter().all(|p| p.len() == 3)
    };
    let normalized = if let (Some(c), Some(d)) = (last_comma, last_dot) {
        if c > d {
            // Comma is the decimal separator ("1.234,56").
            digits.replace('.', "").replace(',', ".")
        } else {
            digits.replace(',', "")
        }
    } else if last_comma.is_some() {
        if groups_of_three(&digits, ',') {
            digits.replace(',', "")
        } else {
            digits.replace(',', ".")
        }
    } else if last_dot.is_some() && groups_of_three(&digits, '.') {
        digits.replace('.', "")
    } else {
        digits
    };
    let value = normalized.parse::<f64>().ok()?;
    if !value.is_finite() || value == 0.0 {
        None
    } else {
        Some(value)
    }
}

/// Normalizes for comparison: lowercase, with each run of non-alphanumerics
/// collapsed to a single space. Keeping a separator (rather than deleting it)
/// preserves token boundaries, so "CRS326" cannot match inside "CRS3260".
/// Commerce suffixes that legitimately follow a model which ends with a
/// separator, mirroring `COMMERCE_SUFFIXES` in lib/scrapers/utils.ts.
const COMMERCE_SUFFIXES: [&str; 13] = [
    "rm", "in", "us", "eu", "uk", "au", "nz", "za", "my", "ca", "ch", "sg", "jp",
];

fn is_commerce_suffix(s: &str) -> bool {
    COMMERCE_SUFFIXES.contains(&s.to_ascii_lowercase().as_str())
}

/// True when `text` contains the requested model as a whole token, with the same
/// semantics as the shared (cheerio) `matchesModel`:
///
/// * letters and digits in the model must appear literally (case-insensitively);
/// * separators in the model match any non-alphanumeric run (lazily), and a
///   *trailing* separator must match at least one character;
/// * a preceding LETTER is allowed — cards render the brand glued to the model
///   ("MikroTikCRS326-24G-2S+IN") — while a preceding DIGIT is not, because it
///   means a different number ("4032CRS804");
/// * a trailing 2-3 letter commerce suffix ("+RM", "-IN") is tolerated only
///   when the model itself ends with a separator.
///
/// A stricter rule here silently drops prices the server-side parser finds, so
/// this must stay in step with the shared corpus.
pub fn text_mentions_model(text: &str, model: &str) -> bool {
    let needle = model.trim();
    if needle.is_empty() || text.is_empty() {
        return false;
    }

    let chars: Vec<char> = needle.chars().collect();
    let mut pattern = String::new();
    for (i, ch) in chars.iter().enumerate() {
        if ch.is_ascii_alphanumeric() {
            // Alphanumerics are literal in the regex and need no escaping.
            pattern.push(*ch);
        } else if i + 1 == chars.len() {
            pattern.push_str("[^a-z0-9]+?");
        } else {
            pattern.push_str("[^a-z0-9]*?");
        }
    }

    let Ok(re) = Regex::new(&format!("(?i){pattern}")) else {
        return false;
    };
    let ends_with_separator = !chars
        .last()
        .map(|c| c.is_ascii_alphanumeric())
        .unwrap_or(true);

    for m in re.find_iter(text) {
        let before_ok = match text[..m.start()].chars().next_back() {
            None => true,
            Some(c) => !c.is_ascii_alphanumeric() || c.is_ascii_alphabetic(),
        };
        let after_is_alnum = text[m.end()..]
            .chars()
            .next()
            .map(|c| c.is_ascii_alphanumeric())
            .unwrap_or(false);
        if before_ok && !after_is_alnum {
            return true;
        }
        if before_ok && ends_with_separator {
            let tail: String = text[m.end()..]
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric())
                .collect();
            if (2..=3).contains(&tail.chars().count()) && is_commerce_suffix(&tail) {
                return true;
            }
        }
    }
    false
}

/// Specific product-card selectors, mirroring the mobile CARD_SELECTORS.
/// Preferred over the generic row selectors below: a single <tr>/<li> can wrap
/// SEVERAL product cards (Aerial puts its whole results grid in one <tr>), in
/// which case the row's text names every model and would validate any price.
const CARD_SELECTOR: &str = "article, .product, .product-item, .productitem, .product-item-details, .product-item-info, .product-card, .aerial-card, .ac-item, .item";
/// Generic row containers, used only when no specific card is found.
const ROW_SELECTOR: &str = "tr, li";

/// True when the price element's *own product card* names the model. Walking
/// past the card would reach page-level containers (a search-results header
/// naming the model, `<body>`) whose text would validate any price on the page.
fn price_element_matches_model(el: &ElementRef, model: &str) -> bool {
    for selector in [CARD_SELECTOR, ROW_SELECTOR] {
        if let Ok(sel) = Selector::parse(selector) {
            if let Some(container) = el
                .ancestors()
                .filter_map(ElementRef::wrap)
                .find(|a| sel.matches(a))
            {
                return text_mentions_model(&container.text().collect::<String>(), model);
            }
        }
    }
    // No container boundary: only the element and its immediate parent are safe.
    el.ancestors()
        .take(2)
        .filter_map(ElementRef::wrap)
        .any(|anc| text_mentions_model(&anc.text().collect::<String>(), model))
}
/// Translate a jQuery `:contains(text)` compound into a base selector plus a
/// text needle, so selector lists shared with the mobile parsers mean the same
/// thing here. The `scraper` crate cannot parse `:contains`.
fn split_contains(part: &str) -> (String, Option<String>) {
    let Some(idx) = part.find(":contains(") else {
        return (part.trim().to_string(), None);
    };
    let after = &part[idx + ":contains(".len()..];
    let Some(close) = after.find(')') else {
        return (part.trim().to_string(), None);
    };
    let needle = after[..close]
        .trim()
        .trim_matches(|c| c == '\'' || c == '"')
        .to_string();
    let base = format!("{}{}", &part[..idx], &after[close + 1..]);
    (base.trim().to_string(), Some(needle))
}

/// Evaluate a comma-separated selector list with cheerio-compatible
/// `:contains(text)` support. Parts the crate cannot parse are skipped instead
/// of changing the meaning of the whole list, and results are returned in
/// document order (deduplicated) like cheerio rather than by alternative.
fn select_selector_list<'a>(document: &'a Html, selector: &str) -> Vec<ElementRef<'a>> {
    let compiled: Vec<(Selector, Option<String>)> = selector
        .split(',')
        .filter_map(|part| {
            let (base, needle) = split_contains(part);
            Selector::parse(&base).ok().map(|sel| (sel, needle))
        })
        .collect();
    let mut found: Vec<ElementRef<'a>> = Vec::new();
    // Walk the tree once so results are in document order and each element is
    // considered only once, like cheerio's `$(list)`.
    for el in document.root_element().descendants().filter_map(ElementRef::wrap) {
        let matched = compiled.iter().any(|(sel, needle)| {
            if !sel.matches(&el) {
                return false;
            }
            match needle.as_deref() {
                Some(n) => el.text().collect::<String>().contains(n),
                None => true,
            }
        });
        if matched {
            found.push(el);
        }
    }
    found
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

    let mut price_text: Option<String> = None;
    for el in select_selector_list(&document, price_selector) {
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

    let stock_els = select_selector_list(&document, stock_selector);
    let stock_text = stock_els
        .first()
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
    fn text_mentions_model_requires_a_token_boundary() {
        // "CRS326" must not match inside "CRS3260" (a different product).
        assert!(!text_mentions_model("CRS3260-24G", "CRS326"));
        assert!(text_mentions_model("MikroTik CRS326 switch", "CRS326"));
        assert!(text_mentions_model("CRS326-24G-2S+", "CRS326"));
    }

    /// The shared parser's `matchesModel` test corpus (tests/scrapers/utils.test.ts).
    /// Both platforms must agree: a stricter desktop rule silently reports "no
    /// price found" for pages the server-side parser handles.
    fn shared_matches_model_cases() -> Vec<(&'static str, &'static str, bool)> {
        vec![
            ("MikroTik CRS804-4DDQ-hRM RouterOS7", "CRS804-4DDQ-hRM", true),
            ("hEX-S (RouterOS L4)", "hEX S", true),
            ("crs326 24g 2s+ rack switch", "CRS326-24G-2S+", true),
            ("RB5009UG+S+IN", "RB5009", false),
            ("hEX", "hEX S", false),
            ("xRB5009y", "RB5009", false),
            ("4032CRS804 kit", "CRS804", false),
            ("CRS3260-24G", "CRS326", false),
            // Aerial renders the brand glued to the model with no separator.
            ("MikroTikCRS326-24G-2S+IN", "CRS326-24G-2S+", true),
            ("MikroTikCRS326-24S+2Q+RM", "CRS326-24S+2Q+RM", true),
            ("MIKROTIK CRS804-4DDQ-HRM", "CrS804-4DdQ-hRm", true),
            ("RB5009UG+S+IN", "rb5009ug s in", true),
            ("xRB5009 y RB5009 z", "RB5009", true),
            ("MikroTik CRS326-24G-2S+RM switch", "CRS326-24G-2S+", true),
            ("CRS326-24G-2S+IN", "CRS326-24G-2S+", true),
            ("CRS326-24G-2S+XTX", "CRS326-24G-2S+", false),
            ("", "RB5009", false),
            ("some text", "", false),
            ("some text", "   ", false),
        ]
    }

    #[test]
    fn text_mentions_model_agrees_with_the_shared_parser() {
        for (text, model, expected) in shared_matches_model_cases() {
            assert_eq!(
                text_mentions_model(text, model),
                expected,
                "text_mentions_model({text:?}, {model:?})"
            );
        }
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
    fn parse_price_page_supports_jquery_contains_in_both_selectors() {
        // rocnoc's prices live in bare table cells (`td:contains('$')`) and
        // winncom marks stock in a cell (`td:contains('In Stock')`). The scraper
        // crate cannot parse `:contains`, and before this the whole selector list
        // silently fell back to a generic one, so the desktop missed prices and
        // stock the server-side (cheerio) parser found for the same page.
        let html = r#"
          <html><body><table><tr>
            <td>$480.00</td>
            <td><a href="/p/crs804">MikroTik CRS804-4DDQ-hRM</a></td>
            <td>In Stock</td>
          </tr></table></body></html>"#;
        let result = parse_price_page(
            html,
            "https://example.com",
            "CRS804-4DDQ-hRM",
            "USD",
            ".price, td:contains('$')",
            "td:contains('In Stock')",
        )
        .expect("contains selectors must work");
        assert_eq!(result.price, 480.0);
        assert_eq!(result.stock_status, "in_stock");
    }

    #[test]
    fn parse_price_page_skips_an_unparseable_selector_part() {
        // One alternative the crate cannot parse must not break the others.
        let html = r#"<html><body><div class="product"><span class="price">$42.00</span>
            <a href="/p/crs804">MikroTik CRS804-4DDQ-hRM</a></div></body></html>"#;
        let result = parse_price_page(
            html,
            "https://example.com",
            "CRS804-4DDQ-hRM",
            "USD",
            ".price, div:not-a-real-pseudo()",
            ".stock",
        )
        .expect("the valid alternative must still match");
        assert_eq!(result.price, 42.0);
    }

    #[test]
    fn parse_price_from_text_takes_only_the_first_number() {
        // "Was $100 Now $80" must be 100, not 10080.
        assert_eq!(parse_price_from_text("Was $100 Now $80"), Some(100.0));
        assert_eq!(parse_price_from_text("20% off $80"), Some(20.0));
    }

    #[test]
    fn parse_price_from_text_handles_space_grouping() {
        assert_eq!(parse_price_from_text("R 12 345.67"), Some(12345.67));
        assert_eq!(parse_price_from_text("1 234,56 Kč"), Some(1234.56));
    }

    #[test]
    fn parse_price_from_text_handles_eu_separators() {
        assert_eq!(parse_price_from_text("1.234,56"), Some(1234.56));
        assert_eq!(parse_price_from_text("1.299"), Some(1299.0));
        assert_eq!(parse_price_from_text("12,5"), Some(12.5));
        assert_eq!(parse_price_from_text("1,299.00"), Some(1299.0));
        assert_eq!(parse_price_from_text("no price"), None);
    }

    #[test]
    fn infer_stock_status_negatives_win() {
        assert_eq!(infer_stock_status("Not in stock"), "out_of_stock");
        assert_eq!(infer_stock_status("Unavailable"), "out_of_stock");
        assert_eq!(infer_stock_status("In stock"), "in_stock");
        assert_eq!(infer_stock_status("Back order"), "back_order");
    }

    #[test]
    fn infer_stock_status_treats_expected_as_back_order() {
        assert_eq!(infer_stock_status("Expected 15 Sept"), "back_order");
    }

    #[test]
    fn card_boundary_beats_a_shared_row() {
        // Two products inside ONE <tr>, each in its own card. The requested
        // model's card must win, not the first card in the row.
        let html = r#"
          <table><tr>
            <td><div class="aerial-card">
              <a href="/p/crs326-24g-2s-in">MikroTik CRS326-24G-2S+IN</a>
              <span class="ac-price">$154.76</span>
            </div></td>
            <td><div class="aerial-card">
              <a href="/p/crs326-4c-20g-2q-rm">MikroTik CRS326-4C+20G+2Q+RM</a>
              <span class="ac-price">$999.00</span>
            </div></td>
          </tr></table>"#;
        let result = parse_price_page(
            html,
            "https://example.com",
            "CRS326-4C+20G+2Q+RM",
            "EUR",
            ".ac-price",
            ".stock",
        )
        .expect("should find the matching card");
        assert_eq!(result.price, 999.0);
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
