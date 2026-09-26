use playwright_rs::{Browser, Playwright};
use std::sync::OnceLock;
use tokio::sync::Mutex;

/// Region-appropriate context signals, mirroring `REGION_SIGNALS` in
/// lib/scrapers/browser.ts. Hardcoding US signals for every distributor made
/// non-US stores localize currency/language, so the parser's static currency
/// label no longer matched the rendered price.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RegionSignals {
    pub locale: &'static str,
    pub timezone_id: &'static str,
    pub latitude: f64,
    pub longitude: f64,
}

pub const EUROPE: RegionSignals = RegionSignals {
    locale: "en-GB",
    timezone_id: "Europe/Berlin",
    latitude: 52.52,
    longitude: 13.405,
};
pub const ASIA_PACIFIC: RegionSignals = RegionSignals {
    locale: "en-AU",
    timezone_id: "Australia/Sydney",
    latitude: -33.8688,
    longitude: 151.2093,
};
pub const MIDDLE_EAST: RegionSignals = RegionSignals {
    locale: "en-AE",
    timezone_id: "Asia/Dubai",
    latitude: 25.2048,
    longitude: 55.2708,
};
pub const AFRICA: RegionSignals = RegionSignals {
    locale: "en-ZA",
    timezone_id: "Africa/Johannesburg",
    latitude: -26.2041,
    longitude: 28.0473,
};
pub const NORTH_AMERICA: RegionSignals = RegionSignals {
    locale: "en-US",
    timezone_id: "America/New_York",
    latitude: 40.7128,
    longitude: -74.006,
};

/// Runs before every page, mirroring the shared `addInitScript` block: a
/// default context reports `navigator.webdriver = true`, which is the first
/// thing Cloudflare/DataDome check.
const STEALTH_INIT_SCRIPT: &str = r#"(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => false });
  Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  window.chrome = { runtime: {} };
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === "notifications"
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (parameter) {
    if (parameter === 37445) return "Intel Inc.";
    if (parameter === 37446) return "Intel Iris OpenGL Engine";
    return getParameter.call(this, parameter);
  };
})();"#;

/// Website host (without a leading `www.`) -> region, mirroring the
/// `DISTRIBUTORS` table in shared/src/distributors.ts for every distributor
/// that has a Rust parser.
const HOST_REGIONS: [(&str, RegionSignals); 25] = [
    ("server2u.com", ASIA_PACIFIC),
    ("linitx.com", EUROPE),
    ("interprojekt.pl", EUROPE),
    ("nasstore.eu", EUROPE),
    ("aerial.net", EUROPE),
    ("mikrotik-store.eu", EUROPE),
    ("miro.co.za", AFRICA),
    ("gear-up.me", MIDDLE_EAST),
    ("balticnetworks.com", NORTH_AMERICA),
    ("shop.linktechs.net", NORTH_AMERICA),
    ("winncom.com", NORTH_AMERICA),
    ("bhphotovideo.com", NORTH_AMERICA),
    ("store.duxtel.com", ASIA_PACIFIC),
    ("wisp.net.au", ASIA_PACIFIC),
    ("pbtech.co.nz", ASIA_PACIFIC),
    ("gowifi.co.nz", ASIA_PACIFIC),
    ("getic.com", EUROPE),
    ("b2b.100mega.com", EUROPE),
    ("hellascom.gr", EUROPE),
    ("roc-noc.com", NORTH_AMERICA),
    ("networkdevicesinc.com", NORTH_AMERICA),
    ("flyteccomputers.com", NORTH_AMERICA),
    ("mbsiwav.com", NORTH_AMERICA),
    ("shop.multilink.us", NORTH_AMERICA),
    ("neobits.com", NORTH_AMERICA),
];

/// Host of a URL without scheme, userinfo, port or a leading `www.`.
fn host_of(url: &str) -> String {
    let without_scheme = url.split_once("://").map(|(_, rest)| rest).unwrap_or(url);
    let authority = without_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default();
    let authority = authority.rsplit('@').next().unwrap_or(authority);
    let host = authority.split(':').next().unwrap_or(authority);
    host.trim_start_matches("www.").to_lowercase()
}

pub fn region_signals_for(url: &str) -> RegionSignals {
    let host = host_of(url);
    HOST_REGIONS
        .iter()
        .find(|(known, _)| *known == host)
        .map(|(_, signals)| *signals)
        .unwrap_or(NORTH_AMERICA)
}

/// A checked-out browser plus the Playwright driver that owns it. The driver
/// MUST be kept alive: `impl Drop for Playwright` closes stdin and SIGKILLs the
/// driver process, which disconnects every browser it launched. Dropping it
/// while returning the `Browser` yielded a disconnected browser on arrival.
pub struct PooledBrowser {
    browser: Browser,
    _driver: Playwright,
}

pub struct BrowserPool {
    idle: Vec<PooledBrowser>,
    /// Counts checked-out browsers too, so concurrent acquires cannot exceed
    /// the cap (the previous version only compared against the idle list).
    in_use: usize,
    max_pool_size: usize,
}

impl BrowserPool {
    pub fn new(max_pool_size: usize) -> Self {
        Self {
            idle: Vec::new(),
            in_use: 0,
            max_pool_size,
        }
    }

    pub async fn acquire(&mut self) -> Result<PooledBrowser, String> {
        while let Some(entry) = self.idle.pop() {
            if entry.browser.is_connected() {
                self.in_use += 1;
                return Ok(entry);
            }
        }
        if self.in_use >= self.max_pool_size {
            return Err("Browser pool exhausted".to_string());
        }
        let driver = Playwright::launch().await.map_err(|e| e.to_string())?;
        let browser = driver
            .chromium()
            .launch()
            .await
            .map_err(|e| e.to_string())?;
        self.in_use += 1;
        Ok(PooledBrowser {
            browser,
            _driver: driver,
        })
    }

    pub fn release(&mut self, entry: PooledBrowser) {
        self.in_use = self.in_use.saturating_sub(1);
        if entry.browser.is_connected() {
            self.idle.push(entry);
        }
    }

    pub async fn shutdown(&mut self) {
        for entry in self.idle.drain(..) {
            let _ = entry.browser.close().await;
        }
    }
}

fn pool() -> &'static Mutex<BrowserPool> {
    static POOL: OnceLock<Mutex<BrowserPool>> = OnceLock::new();
    POOL.get_or_init(|| Mutex::new(BrowserPool::new(3)))
}

pub async fn browser_pool_shutdown() {
    let mut pool = pool().lock().await;
    pool.shutdown().await;
}

pub async fn fetch_with_browser(
    url: &str,
    wait_for_selector: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    let entry = {
        let mut pool = pool().lock().await;
        pool.acquire().await?
    };

    // Mirror the shared attempt loop: retry a transient failure up to twice, but
    // never a block (retrying makes it worse) and never a pool-acquire failure
    // (the browser is unavailable, not the page).
    const MAX_RETRIES: u32 = 2;
    let mut result = Err(String::from("no attempt made"));
    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            let backoff = 1000 * u64::from(attempt);
            tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
        }
        match fetch_with_browser_inner(&entry.browser, url, wait_for_selector, timeout_ms).await {
            Ok(html) => {
                result = Ok(html);
                break;
            }
            Err(error) => {
                let blocked = super::is_blocked_error(&error);
                result = Err(error);
                if blocked {
                    break;
                }
            }
        }
    }

    let mut pool = pool().lock().await;
    pool.release(entry);
    result
}

async fn fetch_with_browser_inner(
    browser: &Browser,
    url: &str,
    wait_for_selector: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    // Mirror the shared stealth context for the region: a store that localizes
    // currency/language for US visitors would otherwise render a price in a
    // different currency than the parser's static label.
    let signals = region_signals_for(url);
    let options = playwright_rs::BrowserContextOptions::builder()
        .locale(signals.locale.to_string())
        .timezone_id(signals.timezone_id.to_string())
        .geolocation(playwright_rs::Geolocation {
            latitude: signals.latitude,
            longitude: signals.longitude,
            accuracy: None,
        })
        .permissions(vec!["geolocation".to_string()])
        .build();
    let context = browser
        .new_context_with_options(options)
        .await
        .map_err(|e| e.to_string())?;
    context
        .add_init_script(STEALTH_INIT_SCRIPT)
        .await
        .map_err(|e| e.to_string())?;
    let page = context.new_page().await.map_err(|e| e.to_string())?;

    let result = fetch_with_browser_page(&page, url, wait_for_selector, timeout_ms).await;

    let _ = page.close().await;
    let _ = context.close().await;
    result
}

async fn fetch_with_browser_page(
    page: &playwright_rs::Page,
    url: &str,
    wait_for_selector: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    let timeout = timeout_ms.unwrap_or(30_000);
    let goto_options =
        playwright_rs::GotoOptions::new().timeout(std::time::Duration::from_millis(timeout));
    page.goto(url, Some(goto_options))
        .await
        .map_err(|e| e.to_string())?;

    if let Some(selector) = wait_for_selector {
        let locator = page.locator(selector);
        // Mirror the shared browser path: a missing selector is not a fetch
        // failure. Mobile waits 10s and then returns whatever loaded, whereas
        // erroring here discarded a JS-rendered page and fell back to plain
        // HTML, which cannot contain the results at all (and stalled 30s doing
        // it).
        let options = playwright_rs::WaitForOptions::builder()
            .timeout(10_000.0)
            .build();
        let _ = locator.wait_for(Some(options)).await;
    }

    let html = page.content().await.map_err(|e| e.to_string())?;
    // An interstitial returned by the browser is a failure, not content: the
    // caller then falls back to plain HTTP and the breaker can cool the
    // distributor down exactly as the shared fetch does.
    if super::classify_fetch_status(&html, None) == super::FetchClassification::Blocked {
        return Err(format!("{} (browser)", super::BLOCKED_ERROR_PREFIX));
    }
    Ok(html)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_of_strips_scheme_www_port_and_path() {
        assert_eq!(
            host_of("https://server2u.com/shop?search=CRS804"),
            "server2u.com"
        );
        assert_eq!(host_of("https://www.aerial.net/shop/x.php"), "aerial.net");
        assert_eq!(host_of("http://User@Example.COM:8443/a"), "example.com");
        assert_eq!(host_of("not-a-url"), "not-a-url");
    }

    #[test]
    fn region_signals_follow_the_shared_distributor_regions() {
        assert_eq!(
            region_signals_for("https://server2u.com/shop?search=x"),
            ASIA_PACIFIC
        );
        assert_eq!(
            region_signals_for("https://linitx.com/search.php?keywords=x"),
            EUROPE
        );
        assert_eq!(
            region_signals_for("https://gear-up.me/search?q=x"),
            MIDDLE_EAST
        );
        assert_eq!(region_signals_for("https://miro.co.za/search?s=x"), AFRICA);
        assert_eq!(
            region_signals_for("https://www.neobits.com/search?x"),
            NORTH_AMERICA
        );
        // Unknown hosts fall back to the shared default, not to nothing.
        assert_eq!(region_signals_for("https://example.com/x"), NORTH_AMERICA);
    }
}
