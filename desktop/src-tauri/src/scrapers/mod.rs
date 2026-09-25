pub mod aerial;
pub mod bhphoto;
pub mod balticnetworks;
pub mod breaker;
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

/// Markers of an anti-bot interstitial, mirroring `BLOCKED_MARKERS` in
/// lib/scrapers/resilient.ts so the desktop classifies a block the same way.
/// Prefix of the error `fetch_html`/`fetch_with_browser` return for an
/// anti-bot interstitial, so callers (and the breaker) can classify it.
pub const BLOCKED_ERROR_PREFIX: &str = "Blocked by the site";

pub fn is_blocked_error(message: &str) -> bool {
    message.starts_with(BLOCKED_ERROR_PREFIX)
}

pub const BLOCKED_MARKERS: [&str; 9] = [
    "403 Forbidden",
    "Access Denied",
    "cf-browser-verification",
    "Checking your browser",
    // Cloudflare interstitial / Turnstile
    "Just a moment",
    "Attention Required",
    "/cdn-cgi/challenge-platform/scripts/jsd/main.js",
    // PerimeterX / DataDome
    "px-captcha",
    "captcha-delivery.com",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FetchClassification {
    Ok,
    Blocked,
    Error,
}

/// Mirrors the shared `classifyFetchStatus`: 403/429 or an interstitial marker
/// is a block, any other 4xx/5xx is an error, everything else is content.
pub fn classify_fetch_status(body: &str, http_status: Option<u16>) -> FetchClassification {
    match http_status {
        Some(403) | Some(429) => return FetchClassification::Blocked,
        Some(status) if status >= 400 => return FetchClassification::Error,
        _ => {}
    }
    if BLOCKED_MARKERS.iter().any(|marker| body.contains(marker)) {
        return FetchClassification::Blocked;
    }
    FetchClassification::Ok
}

/// One GET, returning the status alongside the body so the caller can classify
/// an interstitial (an error page still carries the block markers).
async fn fetch_once(url: &str) -> Result<(String, u16), reqwest::Error> {
    let resp = get_client()
        .get(url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .send()
        .await?;
    let status = resp.status().as_u16();
    let body = resp.text().await?;
    Ok((body, status))
}

pub async fn fetch_html(url: &str, rate_limit_ms: u64) -> Result<String, String> {
    // Mirror the shared resilient path: three attempts with 1s/2s linear
    // backoff for transient failures, but never retry a block (retrying makes
    // it worse) and never hand an interstitial back as content. A single
    // transient 503 used to drop the distributor for the whole refresh.
    const MAX_RETRIES: u32 = 2;
    let mut last_error = String::from("no attempt made");
    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            let backoff = 1000 * u64::from(attempt);
            tokio::time::sleep(tokio::time::Duration::from_millis(backoff)).await;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(rate_limit_ms)).await;
        match fetch_once(url).await {
            Ok((body, status)) => match classify_fetch_status(&body, Some(status)) {
                FetchClassification::Ok => return Ok(body),
                FetchClassification::Blocked => {
                    return Err(format!("{BLOCKED_ERROR_PREFIX} (HTTP {status})"));
                }
                FetchClassification::Error => last_error = format!("HTTP {status}"),
            },
            Err(e) => last_error = e.to_string(),
        }
    }
    Err(last_error)
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

/// Nearest ancestor (or the element itself) matching `selector`, mirroring
/// jQuery's `closest`.
fn closest_matching<'a>(el: &ElementRef<'a>, selector: &str) -> Option<ElementRef<'a>> {
    let sel = Selector::parse(selector).ok()?;
    // `ancestors()` starts at the parent, while `closest` includes the element.
    if sel.matches(el) {
        return Some(*el);
    }
    el.ancestors()
        .filter_map(ElementRef::wrap)
        .find(|a| sel.matches(a))
}

/// Mirrors lib/scrapers/utils.ts `productRowContext`: the containing product
/// card, else the generic row, else the element itself — plus the first
/// descendant link's href. The href matters because many cards name the model
/// only in the product URL, never in the visible text.
fn product_row_context(el: &ElementRef) -> (String, String) {
    fn context_of(node: &ElementRef) -> (String, String) {
        let href = Selector::parse("a[href]")
            .ok()
            .and_then(|sel| node.select(&sel).next())
            .and_then(|a| a.value().attr("href"))
            .unwrap_or("")
            .to_string();
        (node.text().collect::<String>(), href)
    }
    match closest_matching(el, CARD_SELECTOR).or_else(|| closest_matching(el, ROW_SELECTOR)) {
        Some(container) => context_of(&container),
        None => context_of(el),
    }
}

/// Walk-up distance from a price element to the nearest ancestor whose card
/// context names the model, mirroring the shared `matchDepth`. `None` means no
/// level within four matches.
fn match_depth(el: &ElementRef, model: &str) -> Option<usize> {
    let nodes = std::iter::once(*el).chain(el.ancestors().filter_map(ElementRef::wrap));
    for (depth, node) in nodes.take(4).enumerate() {
        let (text, href) = product_row_context(&node);
        let has_content = !text.trim().is_empty() || !href.is_empty();
        if has_content && (text_mentions_model(&text, model) || text_mentions_model(&href, model)) {
            return Some(depth);
        }
    }
    None
}

/// Mirrors lib/scrapers/utils.ts `modelMismatch` — true means "reject this
/// price". The verdict comes from the product card alone when one exists, so a
/// page header naming the model cannot validate a decoy price; the walk-up
/// stops at `<body>`/`<html>` for the same reason. A price with no identifying
/// context at all is accepted (fail open), exactly like the shared parser.
fn model_mismatch(el: &ElementRef, model: &str) -> bool {
    if model.trim().is_empty() {
        return false;
    }
    let has_container = closest_matching(el, CARD_SELECTOR).is_some()
        || closest_matching(el, ROW_SELECTOR).is_some();
    if has_container {
        let (text, href) = product_row_context(el);
        if !text.trim().is_empty() || !href.is_empty() {
            return !(text_mentions_model(&text, model) || text_mentions_model(&href, model));
        }
    }
    let mut saw_content = false;
    let nodes = std::iter::once(*el).chain(el.ancestors().filter_map(ElementRef::wrap));
    for node in nodes.take(4) {
        let name = node.value().name();
        if name == "body" || name == "html" {
            break;
        }
        let (text, href) = product_row_context(&node);
        if !text.trim().is_empty() || !href.is_empty() {
            saw_content = true;
            if text_mentions_model(&text, model) || text_mentions_model(&href, model) {
                return false;
            }
        }
    }
    saw_content
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
    for el in document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
    {
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

    // Mirror `findPriceElement`: selector alternatives are priority-ordered
    // (".actual-price, .price" must prefer the actual price, not whichever comes
    // first in the document), and within one alternative the element whose card
    // context names the model in the fewest walk-up steps wins, document order
    // breaking ties.
    let mut chosen: Option<ElementRef> = None;
    for alternative in price_selector.split(',') {
        let (base, needle) = split_contains(alternative);
        let Ok(sel) = Selector::parse(&base) else {
            continue;
        };
        let candidates: Vec<ElementRef> = document
            .select(&sel)
            .filter(|el| match needle.as_deref() {
                Some(n) => el.text().collect::<String>().contains(n),
                None => true,
            })
            .collect();
        if candidates.is_empty() {
            continue;
        }
        if model.trim().is_empty() {
            chosen = candidates.into_iter().next();
            break;
        }
        let mut best: Option<(usize, ElementRef)> = None;
        for el in candidates {
            if let Some(depth) = match_depth(&el, model) {
                let better = match best.as_ref() {
                    Some((best_depth, _)) => depth < *best_depth,
                    None => true,
                };
                if better {
                    best = Some((depth, el));
                }
            }
        }
        if let Some((_, el)) = best {
            chosen = Some(el);
            break;
        }
    }

    let price_el = chosen.ok_or_else(|| format!("No price found matching model {}", model))?;
    if model_mismatch(&price_el, model) {
        return Err(format!("No price found matching model {}", model));
    }
    let price_text: String = price_el.text().collect();
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
    fn classify_fetch_status_agrees_with_the_shared_parser() {
        use FetchClassification::*;
        let cases: [(Option<u16>, &str, FetchClassification); 12] = [
            (Some(403), "<html>hi</html>", Blocked),
            (Some(429), "<html>hi</html>", Blocked),
            (Some(500), "<html>hi</html>", Error),
            (Some(404), "<html>hi</html>", Error),
            (None, "Checking your browser...", Blocked),
            (None, "cf-browser-verification", Blocked),
            (None, "403 Forbidden", Blocked),
            (None, "Access Denied", Blocked),
            (Some(200), "<html>price $50</html>", Ok),
            (None, "<html>price $50</html>", Ok),
            (None, "<title>Just a moment...</title>", Blocked),
            (None, "Attention Required! | Cloudflare", Blocked),
        ];
        for (status, body, expected) in cases {
            assert_eq!(
                classify_fetch_status(body, status),
                expected,
                "classify_fetch_status({body:?}, {status:?})"
            );
        }
    }

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

    /// The shared parser's stock-status corpus (tests/scraping-integration.test.ts).
    fn shared_stock_cases() -> Vec<(&'static str, &'static str)> {
        vec![
            ("In Stock", "in_stock"),
            ("Out of Stock", "out_of_stock"),
            ("Back Order", "back_order"),
            ("unknown", "unknown"),
            ("Add to Cart", "in_stock"),
            ("Backorder", "back_order"),
            ("Pre-order", "back_order"),
            ("Sold Out", "out_of_stock"),
            ("Available", "in_stock"),
            ("Currently unavailable", "out_of_stock"),
            ("Temporarily Unavailable", "out_of_stock"),
            ("Not available", "out_of_stock"),
            ("Backorder available", "back_order"),
            ("Pre-order available", "back_order"),
            ("Not in stock", "out_of_stock"),
            ("Currently not in stock", "out_of_stock"),
            ("Temporarily not in stock", "out_of_stock"),
            // Hyphen-less spelling: a preorder is a back-order, not stock.
            ("Preorder available", "back_order"),
        ]
    }

    #[test]
    fn infer_stock_status_agrees_with_the_shared_parser() {
        for (text, expected) in shared_stock_cases() {
            assert_eq!(
                infer_stock_status(text),
                expected,
                "infer_stock_status({text:?})"
            );
        }
    }

    /// The shared parser's price corpus (tests/scraping-integration.test.ts).
    fn shared_price_cases() -> Vec<(&'static str, Option<f64>)> {
        vec![
            ("$123.45", Some(123.45)),
            ("€1,234.56", Some(1234.56)),
            ("£99", Some(99.0)),
            ("RM 1,299.00", Some(1299.0)),
            ("invalid", None),
            ("€ 1.234,56", Some(1234.56)),
            ("1 234,56 Kč", Some(1234.56)),
            ("1.234,56 €", Some(1234.56)),
            ("R 12 345.67", Some(12345.67)),
            ("12 345,67 Kč", Some(12345.67)),
            ("1.299", Some(1299.0)),
            ("1.299 €", Some(1299.0)),
            ("1.234.567", Some(1234567.0)),
            ("1,299.00", Some(1299.0)),
            ("Was $100 Now $80", Some(100.0)),
            ("20% off $80", Some(20.0)),
            ("no price", None),
            // Malformed separator runs must fail closed on both platforms.
            ("1.2.3", None),
            ("1,23,456", None),
            ("1.234.56", None),
            ("1..2", None),
        ]
    }

    #[test]
    fn parse_price_from_text_agrees_with_the_shared_parser() {
        for (text, expected) in shared_price_cases() {
            assert_eq!(
                parse_price_from_text(text),
                expected,
                "parse_price_from_text({text:?})"
            );
        }
    }

    #[test]
    fn parse_price_from_text_rejects_non_finite_digit_runs() {
        assert_eq!(parse_price_from_text(&"9".repeat(400)), None);
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

    fn mismatch_of(html: &str, price_selector: &str, model: &str) -> bool {
        let document = Html::parse_document(html);
        let sel = Selector::parse(price_selector).expect("test selector");
        let el = document.select(&sel).next().expect("price element");
        model_mismatch(&el, model)
    }

    /// Mirrors the shared `modelMismatch` suite (tests/scrapers/utils.test.ts).
    #[test]
    fn model_mismatch_agrees_with_the_shared_parser() {
        let row = r#"<html><body><table><tr class="product">
            <td><a href="/p/crs804">MikroTik CRS804</a></td>
            <td><span class="price">$480.00</span></td>
        </tr></table></body></html>"#;
        // The row names a different product.
        assert!(mismatch_of(row, ".price", "CRS326-24G-2S+"));
        // The row names the requested product.
        assert!(!mismatch_of(row, ".price", "CRS804"));
        // A price with no identifying context is not rejected (fail open).
        assert!(!mismatch_of("<span>   </span>", "span", "CRS804"));
        // The model sits one ancestor above the priced element.
        assert!(!mismatch_of(
            r#"<div class="productitem"><div class="info">
                 <a href="/p/crs326">MikroTik CRS326-24G-2S+RM</a>
                 <div class="price">$199.00</div></div></div>"#,
            ".price",
            "CRS326-24G-2S+",
        ));
        // A page-level header five levels up must not validate the price.
        assert!(mismatch_of(
            r#"<body><header>Search results for CRS326-24G-2S+</header>
               <div><div><div><div><span class="price">$5.00</span></div></div></div></div></body>"#,
            "span.price",
            "CRS326-24G-2S+",
        ));
        // A product container heading above the price still counts.
        assert!(!mismatch_of(
            r#"<html><body><div class="product-detail">
                 <h1>MikroTik CRS804-4DDQ-hRM</h1>
                 <span class="price-tag">1.181,67 EUR</span></div></body></html>"#,
            "span.price-tag",
            "CRS804-4DDQ-hRM",
        ));
        // A decoy price whose only model mention is the page <h1>.
        assert!(mismatch_of(
            r#"<html><body><h1>Search results for CRS804-4DDQ-hRM</h1>
               <div><span class="price">$1.00</span></div></body></html>"#,
            "span.price",
            "CRS804-4DDQ-hRM",
        ));
    }

    #[test]
    fn model_mismatch_matches_the_model_in_the_product_link_href() {
        // Many cards name the model only in the product URL.
        let html = r#"<div class="product-item">
            <a href="/p/crs804-4ddq-hrm">MikroTik Switch</a>
            <span class="price">$480.00</span></div>"#;
        assert!(!mismatch_of(html, ".price", "CRS804-4DDQ-hRM"));
        assert!(mismatch_of(html, ".price", "CRS326-24G-2S+"));
    }

    #[test]
    fn parse_price_page_prefers_selector_order_over_document_order() {
        // ".actual-price, .compare-at" must choose the actual price even though
        // the compare-at element comes first in the document.
        let html = r#"<div class="product">
            <a href="/p/crs804">MikroTik CRS804-4DDQ-hRM</a>
            <span class="compare-at">$999.00</span>
            <span class="actual-price">$480.00</span></div>"#;
        let result = parse_price_page(
            html,
            "https://example.com",
            "CRS804-4DDQ-hRM",
            "USD",
            ".actual-price, .compare-at",
            ".stock",
        )
        .expect("should prefer the actual price");
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
