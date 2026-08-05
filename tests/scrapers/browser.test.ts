import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  goto: vi.fn(),
  content: vi.fn().mockResolvedValue("<html></html>"),
  waitForSelector: vi.fn(),
  close: vi.fn(),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  addInitScript: vi.fn(),
  addCookies: vi.fn(),
  cookies: vi.fn().mockResolvedValue([]),
  close: vi.fn(),
};

const mockBrowser = {
  isConnected: vi.fn().mockReturnValue(true),
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn(),
};

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

describe("BrowserPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should acquire a browser from pool", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    const browser = await browserPool.acquire();
    expect(browser).toBeDefined();
    browserPool.release(browser);
  });

  it("should release and reuse browser", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    const browser1 = await browserPool.acquire();
    browserPool.release(browser1);
    const browser2 = await browserPool.acquire();
    expect(browser1).toBe(browser2);
    browserPool.release(browser2);
  });

  it("should shutdown all browsers", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    const browser = await browserPool.acquire();
    browserPool.release(browser);
    await browserPool.shutdown();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("should not release disconnected browsers", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    const browser = await browserPool.acquire();
    mockBrowser.isConnected.mockReturnValueOnce(false);
    browserPool.release(browser);
    // Pool should be empty, next acquire should launch new browser
    const newBrowser = await browserPool.acquire();
    expect(newBrowser).toBeDefined();
    browserPool.release(newBrowser);
  });
});

describe("fetchWithBrowser", () => {
  it("should fetch HTML using browser", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    const html = await fetchWithBrowser("https://example.com");
    expect(html).toBe("<html></html>");
  });

  it("should wait for selector if provided", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    const html = await fetchWithBrowser("https://example.com", {
      waitForSelector: ".price",
    });
    expect(html).toBe("<html></html>");
    expect(mockPage.waitForSelector).toHaveBeenCalledWith(".price", {
      timeout: 10000,
    });
  });

  it("should close page after fetching", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    await fetchWithBrowser("https://example.com");
    expect(mockPage.close).toHaveBeenCalled();
  });

  it("should close context after fetching", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    await fetchWithBrowser("https://example.com");
    expect(mockContext.close).toHaveBeenCalled();
  });
});
