use playwright_rs::{Browser, Playwright};

pub struct BrowserPool {
    browsers: Vec<Browser>,
    max_pool_size: usize,
}

impl BrowserPool {
    pub fn new(max_pool_size: usize) -> Self {
        Self {
            browsers: Vec::new(),
            max_pool_size,
        }
    }

    pub async fn acquire(&mut self) -> Result<Browser, String> {
        if let Some(browser) = self.browsers.pop() {
            return Ok(browser);
        }
        if self.browsers.len() < self.max_pool_size {
            let pw = Playwright::launch().await
                .map_err(|e| e.to_string())?;
            let browser = pw.chromium().launch().await
                .map_err(|e| e.to_string())?;
            return Ok(browser);
        }
        Err("Browser pool exhausted".to_string())
    }

    pub fn release(&mut self, browser: Browser) {
        self.browsers.push(browser);
    }

    pub async fn shutdown(&mut self) {
        for browser in self.browsers.drain(..) {
            let _ = browser.close().await;
        }
    }
}

pub async fn fetch_with_browser(
    url: &str,
    wait_for_selector: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    let pw = Playwright::launch().await
        .map_err(|e| e.to_string())?;
    let browser = pw.chromium().launch().await
        .map_err(|e| e.to_string())?;
    let context = browser.new_context().await
        .map_err(|e| e.to_string())?;
    let page = context.new_page().await
        .map_err(|e| e.to_string())?;

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

    let html = page.content().await
        .map_err(|e| e.to_string())?;

    let _ = page.close().await;
    let _ = browser.close().await;

    Ok(html)
}
