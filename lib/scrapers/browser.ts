import { chromium, Browser } from "playwright";

class BrowserPool {
  private browsers: Browser[] = [];
  private maxPoolSize = 3;
  private maxRetries = 30; // 3 seconds max wait

  async acquire(): Promise<Browser> {
    if (this.browsers.length > 0) {
      return this.browsers.pop()!;
    }
    if (this.browsers.length < this.maxPoolSize) {
      try {
        return await chromium.launch({ headless: true });
      } catch (error) {
        throw new Error(
          `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    // Wait for a browser to be released
    for (let i = 0; i < this.maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (this.browsers.length > 0) {
        return this.browsers.pop()!;
      }
    }
    throw new Error("Browser pool exhausted: no browsers available after waiting");
  }

  release(browser: Browser): void {
    if (browser.isConnected()) {
      this.browsers.push(browser);
    }
  }

  async shutdown(): Promise<void> {
    for (const b of this.browsers) {
      await b.close();
    }
    this.browsers = [];
  }
}

export const browserPool = new BrowserPool();

export async function fetchWithBrowser(
  url: string,
  options?: { waitForSelector?: string; timeoutMs?: number },
): Promise<string> {
  const browser = await browserPool.acquire();
  let page;
  try {
    page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: options?.timeoutMs || 30000,
    });

    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }

    return await page.content();
  } finally {
    if (page) {
      await page.close();
    }
    browserPool.release(browser);
  }
}
