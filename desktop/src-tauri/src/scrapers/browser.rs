use playwright_rs::{Browser, Playwright};
use std::sync::OnceLock;
use tokio::sync::Mutex;

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

    let result =
        fetch_with_browser_inner(&entry.browser, url, wait_for_selector, timeout_ms).await;

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
    let context = browser.new_context().await
        .map_err(|e| e.to_string())?;
    let page = context.new_page().await
        .map_err(|e| e.to_string())?;

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
    let goto_options = playwright_rs::GotoOptions::new()
        .timeout(std::time::Duration::from_millis(timeout));
    page.goto(url, Some(goto_options)).await
        .map_err(|e| e.to_string())?;

    if let Some(selector) = wait_for_selector {
        let locator = page.locator(selector);
        locator.wait_for(None).await
            .map_err(|e| e.to_string())?;
    }

    page.content().await
        .map_err(|e| e.to_string())
}
