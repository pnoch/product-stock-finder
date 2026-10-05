import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  goto: vi.fn(),
  content: vi.fn().mockResolvedValue("<html></html>"),
  waitForSelector: vi.fn(),
  waitForTimeout: vi.fn(),
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

vi.mock("patchright", () => ({
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

  it("should throw when pool is exhausted", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    // Acquire all 3 browsers
    const b1 = await browserPool.acquire();
    const b2 = await browserPool.acquire();
    const b3 = await browserPool.acquire();
    // 4th acquire should wait then throw
    await expect(browserPool.acquire()).rejects.toThrow(
      "Browser pool exhausted",
    );
    browserPool.release(b1);
    browserPool.release(b2);
    browserPool.release(b3);
  });
});

describe("fetchWithBrowser", () => {
  beforeEach(() => {
    mockPage.goto.mockReset();
    mockPage.content.mockReset();
    mockPage.content.mockResolvedValue("<html></html>");
  });

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

  it("should retry goto once on failure", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    mockPage.goto
      .mockRejectedValueOnce(new Error("nav failed"))
      .mockResolvedValueOnce(undefined);
    const html = await fetchWithBrowser("https://example.com");
    expect(html).toBe("<html></html>");
    expect(mockPage.goto).toHaveBeenCalledTimes(2);
  });

  it("should throw when Cloudflare challenge cannot be resolved", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    mockPage.content.mockResolvedValueOnce("403 Forbidden");
    await expect(fetchWithBrowser("https://example.com")).rejects.toThrow(
      "Cloudflare challenge could not be resolved",
    );
  });
});

describe("BrowserPool launch + release failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser.isConnected.mockReturnValue(true);
  });

  it("reports a launch failure and frees the reserved slot", async () => {
    const { chromium } = await import("patchright");
    const { browserPool } = await import("@/lib/scrapers/browser");
    // Empty the shared pool so acquire must launch rather than reuse.
    await browserPool.shutdown();
    const launchMock = vi.mocked(chromium.launch);
    // Both the system-Chrome attempt and the bundled fallback must fail for the
    // pool to surface the error (a single failure falls back to bundled).
    launchMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"));
    await expect(browserPool.acquire()).rejects.toThrow(
      "Failed to launch browser: boom",
    );
    // The failed launch must not leak the reserved slot.
    const browser = await browserPool.acquire();
    browserPool.release(browser);
  });

  it("does not pool a browser whose isConnected throws on release", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser");
    await browserPool.shutdown();
    const browser = await browserPool.acquire();
    mockBrowser.isConnected.mockImplementationOnce(() => {
      throw new Error("dead handle");
    });
    await expect(browserPool.release(browser)).resolves.toBeUndefined();
    // A dead browser is dropped, so the next acquire still succeeds.
    const next = await browserPool.acquire();
    browserPool.release(next);
  });
});

describe("fetchWithBrowser cloudflare handling", () => {
  beforeEach(() => {
    mockPage.goto.mockReset().mockResolvedValue(undefined);
    mockPage.content.mockReset();
    mockPage.waitForTimeout.mockReset().mockResolvedValue(undefined);
    mockPage.waitForSelector.mockReset();
  });

  it("waits out a challenge and returns the resolved page", async () => {
    mockPage.content
      .mockResolvedValueOnce("Checking your browser...")
      .mockResolvedValue("<html>resolved</html>");
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    await expect(
      fetchWithBrowser("https://example.com", { timeoutMs: 5000 }),
    ).resolves.toBe("<html>resolved</html>");
    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
  });

  it("throws when the challenge outlasts the timeout", async () => {
    mockPage.content.mockResolvedValue("Just a moment...");
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    await expect(
      fetchWithBrowser("https://example.com", { timeoutMs: 1 }),
    ).rejects.toThrow("Cloudflare challenge could not be resolved");
  });

  it("throws the navigation error after both attempts fail", async () => {
    mockPage.goto.mockReset().mockRejectedValue(new Error("nav down"));
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    await expect(fetchWithBrowser("https://example.com")).rejects.toThrow(
      "nav down",
    );
    expect(mockPage.goto).toHaveBeenCalledTimes(2);
  });

  it("continues when the waited-for selector never appears", async () => {
    mockPage.content.mockResolvedValue("<html>x</html>");
    mockPage.waitForSelector.mockRejectedValue(new Error("timeout"));
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    await expect(
      fetchWithBrowser("https://example.com", { waitForSelector: ".nope" }),
    ).resolves.toBe("<html>x</html>");
  });
});

describe("teardownBrowserSession (node)", () => {
  it("still releases when page and context closes both throw", async () => {
    const { teardownBrowserSession } = await import("@/lib/scrapers/browser");
    const page = {
      close: vi.fn(async () => {
        throw new Error("page dead");
      }),
    };
    const context = {
      close: vi.fn(async () => {
        throw new Error("context dead");
      }),
    };
    const release = vi.fn();
    await expect(
      teardownBrowserSession(page, context, release),
    ).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
