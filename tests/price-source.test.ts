import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  serverResult: null as unknown,
  scrapeResult: null as unknown,
}));

vi.mock("../constants/oauth", () => ({
  isServerConfigured: vi.fn(() => state.configured),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(async () => state.serverResult),
}));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn((id: string) =>
    id === "none"
      ? undefined
      : {
          id,
          buildSearchUrl: (m: string) =>
            `https://x.test/?q=${encodeURIComponent(m)}`,
          parsePrice: vi.fn(() =>
            state.scrapeResult === "BLOCKED" ? null : state.scrapeResult,
          ),
          rateLimitMs: 0,
        },
  ),
}));

vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(async () => ({
    status: state.scrapeResult === "BLOCKED" ? "blocked" : "ok",
    html: state.scrapeResult ? "<html>ok</html>" : "",
  })),
  createMemoryBreakerStore: vi.fn(() => ({})),
}));

import { resolvePrice, scrapePriceOnDevice } from "../lib/price-source";

describe("resolvePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.configured = true;
    state.serverResult = null;
    state.scrapeResult = null;
  });

  it("returns the server result with source=server on hit", async () => {
    state.serverResult = {
      snapshot: { price: 200, currency: "USD", stockStatus: "in_stock", fetchedAt: 1 },
      history: [],
    };
    const r = await resolvePrice("linitx-uk", "CRS326");
    expect(r?.source).toBe("server");
    expect(r?.snapshot?.price).toBe(200);
  });

  it("falls back to device scrape when the server misses", async () => {
    state.scrapeResult = { price: 199, currency: "USD", stockStatus: "in_stock" };
    const r = await resolvePrice("linitx-uk", "CRS326");
    expect(r?.source).toBe("device");
    expect(r?.snapshot?.price).toBe(199);
    expect(r?.snapshot?.fetchedAt).toBeGreaterThan(0);
    expect(r?.history).toEqual([]);
  });

  it("skips the server leg entirely when unconfigured", async () => {
    state.configured = false;
    state.scrapeResult = { price: 199, currency: "USD", stockStatus: "in_stock" };
    const { fetchServerPrice } = await import("../lib/server-prices");
    await resolvePrice("linitx-uk", "CRS326");
    expect(fetchServerPrice).not.toHaveBeenCalled();
  });

  it("returns null when no parser exists", async () => {
    expect(await resolvePrice("none", "CRS326")).toBeNull();
  });

  it("returns null when the device scrape fails", async () => {
    state.scrapeResult = null;
    expect(await resolvePrice("linitx-uk", "CRS326")).toBeNull();
  });

  it("returns null when blocked", async () => {
    state.scrapeResult = "BLOCKED";
    expect(await resolvePrice("linitx-uk", "CRS326")).toBeNull();
  });
});

describe("scrapePriceOnDevice", () => {
  beforeEach(() => {
    state.scrapeResult = null;
  });

  it("threads the model into parsePrice", async () => {
    state.scrapeResult = { price: 10, currency: "GBP", stockStatus: "in_stock" };
    const r = await scrapePriceOnDevice("linitx-uk", "CRS804-4DDQ-hRM");
    expect(r?.source).toBe("device");
  });

  it("caps concurrent device scrapes", async () => {
    let inFlight = 0;
    let peak = 0;
    const { resilientFetch } = await import("../lib/scrapers/resilient");
    vi.mocked(resilientFetch).mockImplementation(async (_opts: unknown) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return { status: "ok", html: "<html>x</html>" } as never;
    });
    state.scrapeResult = { price: 1, currency: "USD", stockStatus: "in_stock" };
    await Promise.all(
      Array.from({ length: 9 }, () => scrapePriceOnDevice("linitx-uk", "M")),
    );
    expect(peak).toBeLessThanOrEqual(3);
  });
});
