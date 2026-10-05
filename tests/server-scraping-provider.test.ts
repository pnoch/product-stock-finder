import { describe, expect, it, vi, afterEach } from "vitest";
import { registerScrapingProvider } from "@/server/scrapers/provider";
import { getProviderFetcher, setProviderFetcher } from "@/lib/scrapers/resilient";

describe("registerScrapingProvider", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    setProviderFetcher(null);
    globalThis.fetch = realFetch;
    delete process.env.SCRAPING_PROVIDER_URL;
    delete process.env.SCRAPING_PROVIDER_API_KEY;
  });

  it("does not register when the URL template is unset", () => {
    expect(registerScrapingProvider()).toBe(false);
    expect(getProviderFetcher()).toBeNull();
  });

  it("registers a fetcher that interpolates the URL and sends the key", async () => {
    process.env.SCRAPING_PROVIDER_URL = "https://api.example.com/?key=K&url={url}";
    process.env.SCRAPING_PROVIDER_API_KEY = "secret";
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response("<html>rendered</html>", { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(registerScrapingProvider()).toBe(true);
    const html = await getProviderFetcher()!("https://shop.test/search?q=CRS326");
    expect(html).toBe("<html>rendered</html>");
    const called = fetchMock.mock.calls[0][0];
    expect(called).toContain("url=https%3A%2F%2Fshop.test%2Fsearch%3Fq%3DCRS326");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("returns null on a non-2xx provider response", async () => {
    process.env.SCRAPING_PROVIDER_URL = "https://api.example.com/?url={url}";
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as never;
    registerScrapingProvider();
    expect(await getProviderFetcher()!("https://shop.test/x")).toBeNull();
  });
});
