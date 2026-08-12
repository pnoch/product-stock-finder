import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DistributorParser } from "../lib/scrapers/types";
import type { PriceSnapshot } from "../lib/types";

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

vi.mock("../lib/scrapers/utils", () => ({
  fetchWithParser: vi.fn(),
}));

vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(),
  setCachedPrice: vi.fn(),
  listNearExpiry: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
}));

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import { listNearExpiry, setCachedPrice } from "../server/price-cache";
import { refreshNearExpiry, startWarmer } from "../server/prices";
import type { ScrapeResult } from "../lib/scrapers/types";

const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetch = vi.mocked(fetchWithParser);
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
    mockedFetch.mockResolvedValue("<html>price</html>");
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