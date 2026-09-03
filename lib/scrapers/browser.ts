import { chromium, Browser, BrowserContext } from "playwright";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { USER_AGENTS } from "./utils";

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

const COOKIE_DIR = join(
  process.env.HOME || "~",
  ".cache",
  "product-stock-finder",
  "cookies",
);

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hashDomain(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash << 5) - hash + domain.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function isCookieArray(value: unknown): value is any[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof (c as any).name === "string" &&
        typeof (c as any).value === "string" &&
        typeof (c as any).domain === "string",
    )
  );
}

async function loadCookies(domain: string): Promise<any[]> {
  try {
    const filePath = join(COOKIE_DIR, `${hashDomain(domain)}.json`);
    const data = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(data);
    return isCookieArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCookies(domain: string, cookies: any[]): Promise<void> {
  try {
    await mkdir(COOKIE_DIR, { recursive: true });
    const filePath = join(COOKIE_DIR, `${hashDomain(domain)}.json`);
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

class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const prev = this.tail;
    this.tail = this.tail.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

class BrowserPool {
  private browsers: Browser[] = [];
  private checkedOut = 0;
  private maxPoolSize = 3;
  private maxRetries = 30; // 3 seconds max wait
  private mutex = new Mutex();

  async acquire(): Promise<Browser> {
    // Fast path: reuse idle browser without holding mutex across launch
    let reused: Browser | null = null;
    await this.mutex.runExclusive(async () => {
      while (this.browsers.length > 0) {
        const candidate = this.browsers.pop()!;
        if (candidate.isConnected()) {
          reused = candidate;
          this.checkedOut++;
          break;
        }
      }
    });
    if (reused) return reused;

    // Reserve a slot for a new browser — only counter is protected
    let shouldLaunch = false;
    await this.mutex.runExclusive(async () => {
      if (this.checkedOut < this.maxPoolSize) {
        this.checkedOut++;
        shouldLaunch = true;
      }
    });
    if (shouldLaunch) {
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
        await this.mutex.runExclusive(async () => {
          this.checkedOut = Math.max(0, this.checkedOut - 1);
        });
        throw new Error(
          `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // All browsers checked out — wait for one to be released (poll without holding mutex)
    for (let i = 0; i < this.maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 100));
      let waiting: Browser | null = null;
      await this.mutex.runExclusive(async () => {
        while (this.browsers.length > 0) {
          const candidate = this.browsers.pop()!;
          if (candidate.isConnected()) {
            waiting = candidate;
            this.checkedOut++;
            break;
          }
        }
      });
      if (waiting) return waiting;
    }
    throw new Error(
      "Browser pool exhausted: no browsers available after waiting",
    );
  }

  async release(browser: Browser): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.checkedOut = Math.max(0, this.checkedOut - 1);
      let connected = false;
      try {
        connected = browser.isConnected();
      } catch {
        connected = false;
      }
      if (connected) {
        this.browsers.push(browser);
      }
    });
  }

  async shutdown(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      for (const b of this.browsers) {
        await b.close();
      }
      this.browsers = [];
      this.checkedOut = 0;
    });
  }
}

export const browserPool = new BrowserPool();

async function createStealthContext(
  browser: Browser,
  url: string,
): Promise<BrowserContext> {
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
        ? Promise.resolve({
            state: Notification.permission,
          } as PermissionStatus)
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

async function waitForCloudflare(
  page: any,
  timeoutMs: number,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const content = await page.content();

    // Check for Cloudflare challenge
    if (
      content.includes("cf-browser-verification") ||
      content.includes("Checking your browser") ||
      content.includes("Just a moment...")
    ) {
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

// Best-effort cleanup: every step runs even if an earlier one throws, so a
// failing page/context close can never leak a pool slot.
export async function teardownBrowserSession(
  page: { close(): Promise<void> } | undefined,
  context: { close(): Promise<void> } | undefined,
  release: () => void | Promise<void>,
): Promise<void> {
  try {
    if (page) await page.close();
  } catch {
    // page already dead
  }
  try {
    if (context) await context.close();
  } catch {
    // context already dead
  }
  await Promise.resolve(release()).catch(() => {});
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

    // Retry navigation once on failure
    let navError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: options?.timeoutMs || 30000,
        });
        navError = undefined;
        break;
      } catch (error) {
        navError = error;
        await page.waitForTimeout(1000);
      }
    }
    if (navError) {
      throw navError;
    }

    // Wait for Cloudflare challenge to resolve
    const cloudflareResolved = await waitForCloudflare(
      page,
      options?.timeoutMs || 30000,
    );
    if (!cloudflareResolved) {
      throw new Error("Cloudflare challenge could not be resolved");
    }

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
    await teardownBrowserSession(page, context, () =>
      browserPool.release(browser),
    );
  }
}
