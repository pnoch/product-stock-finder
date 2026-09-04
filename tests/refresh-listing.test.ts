import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
  uploadServerHistory: vi.fn(async () => {}),
}));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

vi.mock("../lib/scrapers/resilient", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    resilientFetch: vi.fn(),
  };
});

import { fetchServerPrice } from "../lib/server-prices";
import { getParserByDistributorId } from "../lib/scrapers/registry";
import { resilientFetch } from "../lib/scrapers/resilient";
import { refreshListing } from "../lib/background-tasks/refresh-listing";
import type { DistributorListing, Product } from "../lib/types";

const mockedFetchServerPrice = vi.mocked(fetchServerPrice);
const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedResilientFetch = vi.mocked(resilientFetch);

function product(): Product {
  return {
    id: "p1",
    name: "Product p1",
    modelNumber: "MODEL-1",
    brand: "Test",
    category: "Test",
    description: "",
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings: [],
  };
}

function listing(): DistributorListing {
  return {
    productId: "p1",
    distributorId: "d1",
    price: 150,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p1",
    lastChecked: new Date().toISOString(),
    priceHistory: [],
  };
}

const healthCollector = { record: vi.fn() } as unknown as Parameters<
  typeof refreshListing
>[2];

describe("refreshListing server snapshot freshness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignores a stale server snapshot and falls through to local scrape", async () => {
    mockedFetchServerPrice.mockResolvedValue({
      snapshot: {
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com/p1",
        fetchedAt: Date.now() - 3 * 60 * 60 * 1000,
      },
      history: [],
    });
    const parser = {
      id: "d1",
      buildSearchUrl: () => "https://example.com/search",
      parsePrice: () => ({
        price: 200,
        currency: "USD",
        stockStatus: "in_stock" as const,
        url: "https://example.com/p1",
      }),
    };
    mockedGetParser.mockReturnValue(parser as never);
    mockedResilientFetch.mockResolvedValue({
      status: "ok",
      method: "plain",
      html: "<html>price</html>",
    } as never);

    const result = await refreshListing(product(), listing(), healthCollector);
    expect(mockedResilientFetch).toHaveBeenCalled();
    expect(result.price).toBe(200);
  });

  it("accepts a fresh server snapshot without a local scrape", async () => {
    mockedFetchServerPrice.mockResolvedValue({
      snapshot: {
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com/p1",
        fetchedAt: Date.now(),
      },
      history: [],
    });

    const result = await refreshListing(product(), listing(), healthCollector);
    expect(mockedResilientFetch).not.toHaveBeenCalled();
    expect(result.price).toBe(100);
  });
});
