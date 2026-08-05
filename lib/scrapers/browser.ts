import { chromium, Browser, BrowserContext } from "playwright";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

const COOKIE_DIR = join(process.env.HOME || "~", ".cache", "product-stock-finder", "cookies");

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function loadCookies(domain: string): Promise<any[]> {
  try {
    const filePath = join(COOKIE_DIR, `${domain.replace(/\./g, "_")}.json`);
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveCookies(domain: string, cookies: any[]): Promise<void> {
  try {
    await mkdir(COOKIE_DIR, { recursive: true });
    const filePath = join(COOKIE_DIR, `${domain.replace(/\./g, "_")}.json`);
    await writeFile(filePath, JSON.stringify(cookies, null, 2));
  } catch {
    // Ignore save errors
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

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
        return await chromium.launch({
          headless: true,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
          ],
        });
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

async function createStealthContext(browser: Browser, url: string): Promise<BrowserContext> {
  const userAgent = getRandomItem(USER_AGENTS);
  const viewport = getRandomItem(VIEWPORTS);
  const domain = extractDomain(url);

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: "en-US",
    timezoneId: "America/New_York",
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ["geolocation"],
  });

  // Load saved cookies for this domain
  const cookies = await loadCookies(domain);
  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }

  // Add scripts to evade detection
  await context.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });

    // Override navigator.plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override navigator.languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    // Override chrome runtime
    (window as any).chrome = {
      runtime: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    (window.navigator.permissions as any).query = (parameters: any) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    // Override WebGL vendor and renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) {
        return "Intel Inc.";
      }
      if (parameter === 37446) {
        return "Intel Iris OpenGL Engine";
      }
      return getParameter.call(this, parameter);
    };
  });

  return context;
}

async function waitForCloudflare(page: any, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const content = await page.content();
    
    // Check for Cloudflare challenge
    if (content.includes("cf-browser-verification") || 
        content.includes("Checking your browser") ||
        content.includes("Just a moment...")) {
      await page.waitForTimeout(2000);
      continue;
    }
    
    // Check for 403
    if (content.includes("403 Forbidden")) {
      return false;
    }
    
    // Page loaded successfully
    return true;
  }
  return false;
}

export async function fetchWithBrowser(
  url: string,
  options?: { waitForSelector?: string; timeoutMs?: number },
): Promise<string> {
  const browser = await browserPool.acquire();
  let context: BrowserContext | undefined;
  let page;
  const domain = extractDomain(url);
  
  try {
    context = await createStealthContext(browser, url);
    page = await context.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options?.timeoutMs || 30000,
    });

    // Wait for Cloudflare challenge to resolve
    await waitForCloudflare(page, options?.timeoutMs || 30000);

    if (options?.waitForSelector) {
      try {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      } catch {
        // Selector not found, continue with whatever loaded
      }
    }

    // Save cookies for future requests
    const cookies = await context.cookies();
    await saveCookies(domain, cookies);

    return await page.content();
  } finally {
    if (page) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
    browserPool.release(browser);
  }
}
