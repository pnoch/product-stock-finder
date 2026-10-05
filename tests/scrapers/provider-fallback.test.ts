import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// The browser method would launch Chromium; make it unavailable so the only
// remaining path is plain (blocked) -> provider.
vi.mock("@/lib/scrapers/browser", () => ({
  fetchWithBrowser: async () => {
    throw new Error("browser unavailable in test");
  },
}));

import {
  resilientFetch,
  setProviderFetcher,
  createMemoryBreakerStore,
} from "@/lib/scrapers/resilient";
import type { DistributorParser } from "@/lib/scrapers/types";

const parser = {
  id: "blocked-us",
  baseUrl: "https://blocked.test",
  buildSearchUrl: (m: string) => `https://blocked.test/search?q=${m}`,
  parsePrice: () => ({ price: 42, currency: "USD", stockStatus: "in_stock", url: "" }),
  useBrowser: false,
  rateLimitMs: 0,
} as unknown as DistributorParser;

describe("provider fallback", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => setProviderFetcher(null));
  afterEach(() => {
    setProviderFetcher(null);
    globalThis.fetch = realFetch;
  });

  it("is not used when no fetcher is registered", async () => {
    globalThis.fetch = vi.fn(async () => new Response("Just a moment", { status: 403 })) as never;
    const outcome = await resilientFetch({
      parser,
      url: parser.buildSearchUrl("X"),
      state: createMemoryBreakerStore(),
    });
    expect(outcome.status).toBe("blocked");
  });

  it("is tried after a block and returns ok", async () => {
    globalThis.fetch = vi.fn(async () => new Response("Just a moment", { status: 403 })) as never;
    setProviderFetcher(async () => "<html><span class='price'>$42.00</span></html>");
    const outcome = await resilientFetch({
      parser,
      url: parser.buildSearchUrl("X"),
      state: createMemoryBreakerStore(),
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("provider");
  });

  it("is not tried when the plain fetch already succeeds", async () => {
    globalThis.fetch = vi.fn(async () => new Response("<html>ok</html>", { status: 200 })) as never;
    const provider = vi.fn(async () => "<html>provider</html>");
    setProviderFetcher(provider);
    const outcome = await resilientFetch({
      parser,
      url: parser.buildSearchUrl("X"),
      state: createMemoryBreakerStore(),
    });
    expect(outcome.status).toBe("ok");
    expect(provider).not.toHaveBeenCalled();
  });
});
