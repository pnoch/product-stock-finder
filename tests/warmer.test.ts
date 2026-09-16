import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted holder so the mocked fetchAndParse can call the test's resilientFetch
// mock (module-local bindings cannot be intercepted by vi.mock).
const __resilientHolder = vi.hoisted(() => ({ fn: async (_o: unknown): Promise<any> => ({ status: "ok", html: "", method: "plain" }) }));
import type { DistributorParser } from "../lib/scrapers/types";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(),
  fetchAndParse: vi.fn(async (parser: any, model: string) => {
    const outcome = await __resilientHolder.fn({ parser, url: parser.buildSearchUrl(model) } as never);
    return {
      result: outcome.status === "ok" && outcome.html ? parser.parsePrice(outcome.html, model, parser.buildSearchUrl(model)) : null,
      url: parser.buildSearchUrl(model),
      outcome,
    };
  }),
  createMemoryBreakerStore: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  })),
}));

vi.mock("../server/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/notifications")>();
  return { ...actual, evaluateNotifications: vi.fn(async () => {}) };
});

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

vi.mock("../server/product-images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/product-images")>();
  return {
    ...actual,
    getProductImage: vi.fn(),
    listProductsMissingImage: vi.fn(async () => []),
  };
});

vi.mock("../server/catalog-warmer", () => ({
  buildCatalogPairs: vi.fn(() => []),
  pickPairsToWarm: vi.fn(() => []),
}));

vi.mock("../server/price-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/price-cache")>();
  return {
    ...actual,
  getCachedPrice: vi.fn(),
  setCachedPrice: vi.fn(),
  listNearExpiry: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
  getAllFetchedAt: vi.fn(async () => ({})),
  };
});

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { resilientFetch } from "../lib/scrapers/resilient";
import { listNearExpiry, setCachedPrice } from "../server/price-cache";
import { refreshNearExpiry, startWarmer, runWarmerTick } from "../server/prices";
import { evaluateNotifications } from "../server/notifications";
import type { ScrapeResult } from "../lib/scrapers/types";

const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetch = vi.mocked(resilientFetch);
__resilientHolder.fn = mockedFetch as unknown as typeof __resilientHolder.fn;
const mockedListNearExpiry = vi.mocked(listNearExpiry);
const mockedSetCached = vi.mocked(setCachedPrice);

const parser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) => `https://server2u.com/shop?q=${model}`,
  parsePrice: () => null,
  rateLimitMs: 0,
};

const scrapeResult: ScrapeResult = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
};

describe("warmer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue(parser);
    parser.parsePrice = () => scrapeResult;
    mockedFetch.mockResolvedValue({
      status: "ok",
      html: "<html>price</html>",
      method: "plain",
    });
    mockedSetCached.mockResolvedValue(undefined);
  });

  it("refreshNearExpiry refreshes near-expiry entries", async () => {
    mockedListNearExpiry.mockResolvedValue([
      { distributorId: "server2u-my", modelNumber: "CRS804" },
    ]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedSetCached).toHaveBeenCalledTimes(1);
  });

  it("refreshNearExpiry skips when there are no near-expiry entries", async () => {
    mockedListNearExpiry.mockResolvedValue([]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refreshNearExpiry refreshes multiple entries sequentially", async () => {
    mockedListNearExpiry.mockResolvedValue([
      { distributorId: "a", modelNumber: "m1" },
      { distributorId: "b", modelNumber: "m2" },
    ]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("startWarmer returns a no-op stop function in test env", () => {
    const stop = startWarmer({ intervalMs: 10 });
    expect(typeof stop).toBe("function");
    stop();
  });
});

describe("runWarmerTick reentrancy", () => {
  it("skips a concurrent tick while one is already running", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(evaluateNotifications).mockImplementation(async () => {
      await gate;
    });
    mockedListNearExpiry.mockResolvedValue([]);

    const firstP = runWarmerTick();
    const secondP = runWarmerTick();
    release();
    await Promise.all([firstP, secondP]);
    expect(vi.mocked(evaluateNotifications)).toHaveBeenCalledTimes(1);
  });
});
