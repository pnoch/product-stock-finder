import { chromium, Browser } from "playwright";

class BrowserPool {
  private browsers: Browser[] = [];
  private maxPoolSize = 3;

  async acquire(): Promise<Browser> {
    if (this.browsers.length > 0) {
      return this.browsers.pop()!;
    }
    if (this.browsers.length < this.maxPoolSize) {
      return chromium.launch({ headless: true });
    }
    await new Promise((r) => setTimeout(r, 100));
    return this.acquire();
  }

  release(browser: Browser): void {
    this.browsers.push(browser);
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
  try {
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: options?.timeoutMs || 30000,
    });

    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }

    const html = await page.content();
    await page.close();
    return html;
  } finally {
    browserPool.release(browser);
  }
}
