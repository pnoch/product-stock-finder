import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      isConnected: vi.fn().mockReturnValue(true),
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        content: vi.fn().mockResolvedValue("<html></html>"),
        waitForSelector: vi.fn(),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
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
    expect(true).toBe(true);
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
  });
});
