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
  getAllFetchedAt: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
}));

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

vi.mock("../server/product-images", () => ({
  getProductImage: vi.fn(),
  listProductsMissingImage: vi.fn(),
  clearImagesForTests: vi.fn(),
}));

vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(),
  evaluateNotifications: vi.fn(),
  pullPendingEvents: vi.fn(),
  clearNotificationsForTests: vi.fn(),
}));

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { fetchWithParser } from "../lib/scrapers/utils";
import { getCachedPrice, setCachedPrice, getAllFetchedAt, listNearExpiry } from "../server/price-cache";
import { getHistory, recordHistoryPoint } from "../server/price-history";
import { listProductsMissingImage } from "../server/product-images";
import {
  getPrice,
  PRICE_TTL_MS,
  warmCatalogRotation,
  warmProductImages,
  runWarmerTick,
} from "../server/prices";
import type { ScrapeResult } from "../lib/scrapers/types";

const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetch = vi.mocked(fetchWithParser);
const mockedGetCached = vi.mocked(getCachedPrice);
const mockedSetCached = vi.mocked(setCachedPrice);
const mockedGetAllFetchedAt = vi.mocked(getAllFetchedAt);
const mockedGetHistory = vi.mocked(getHistory);
const mockedRecordHistory = vi.mocked(recordHistoryPoint);

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

const freshSnapshot: PriceSnapshot = {
  ...scrapeResult,
  fetchedAt: Date.now(),
};

describe("getPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue(parser);
    mockedGetHistory.mockResolvedValue([]);
  });

  it("returns a fresh cached snapshot and its history without scraping", async () => {
    mockedGetCached.mockResolvedValue(freshSnapshot);
    mockedGetHistory.mockResolvedValue([
      { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
    ]);
    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({
      snapshot: freshSnapshot,
      history: [
        { date: "2026-08-01T00:00:00.000Z", price: 90, currency: "MYR", stockStatus: "in_stock" },
      ],
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns a stale snapshot and triggers a background refresh", async () => {
    const stale: PriceSnapshot = {
      ...scrapeResult,
      fetchedAt: Date.now() - PRICE_TTL_MS - 1000,
    };
    mockedGetCached.mockResolvedValue(stale);
    mockedFetch.mockResolvedValue("<html>price</html>");
    parser.parsePrice = () => scrapeResult;
    mockedSetCached.mockResolvedValue(undefined);

    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({ snapshot: stale, history: [] });

    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).toHaveBeenCalled();
  });

  it("returns null snapshot on a miss and triggers a background refresh", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockResolvedValue("<html>price</html>");
    parser.parsePrice = () => scrapeResult;
    mockedSetCached.mockResolvedValue(undefined);

    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({ snapshot: null, history: [] });

    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).toHaveBeenCalled();
  });

  it("does not throw when the refresh scrape fails", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockRejectedValue(new Error("network down"));
    const result = await getPrice("server2u-my", "CRS804");
    expect(result).toEqual({ snapshot: null, history: [] });
    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    expect(mockedSetCached).not.toHaveBeenCalled();
  });

  it("returns null snapshot when no parser exists for the distributor", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedGetParser.mockReturnValue(undefined);
    const result = await getPrice("unknown-dist", "CRS804");
    expect(result).toEqual({ snapshot: null, history: [] });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("records a history point after a successful refresh", async () => {
    mockedGetCached.mockResolvedValue(null);
    mockedFetch.mockResolvedValue("<html>price</html>");
    parser.parsePrice = () => scrapeResult;
    mockedSetCached.mockResolvedValue(undefined);
    mockedRecordHistory.mockResolvedValue(undefined);

    await getPrice("server2u-my", "CRS804");
    await vi.waitFor(() => expect(mockedRecordHistory).toHaveBeenCalled());
    expect(mockedRecordHistory).toHaveBeenCalledWith(
      "server2u-my",
      "CRS804",
      expect.objectContaining({ price: 88.5, currency: "MYR" }),
    );
  });
});

describe("warmCatalogRotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue(parser);
    parser.parsePrice = () => scrapeResult;
    mockedFetch.mockResolvedValue("<html>price</html>");
    mockedSetCached.mockResolvedValue(undefined);
    mockedGetAllFetchedAt.mockResolvedValue([]);
  });

  it("warms the least-recently-fetched pairs", async () => {
    mockedGetAllFetchedAt.mockResolvedValue([
      { distributorId: "server2u-my", modelNumber: "CRS804-4DDQ-hRM", fetchedAt: 1000 },
    ]);
    const warmed = await warmCatalogRotation(3);
    expect(warmed).toBe(3);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(mockedSetCached).toHaveBeenCalledTimes(3);
  });

  it("returns 0 when there are no pairs to warm", async () => {
    mockedGetParser.mockReturnValue(undefined);
    const warmed = await warmCatalogRotation(3);
    expect(warmed).toBe(0);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("warmProductImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when there are no missing images", async () => {
    const { listProductsMissingImage } = await import("../server/product-images");
    vi.mocked(listProductsMissingImage).mockResolvedValue([]);
    const warmed = await warmProductImages(2);
    expect(warmed).toBe(0);
  });
});

describe("runWarmerTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listNearExpiry).mockResolvedValue([]);
    vi.mocked(getAllFetchedAt).mockResolvedValue([]);
    vi.mocked(listProductsMissingImage).mockResolvedValue([]);
  });

  it("calls evaluateNotifications", async () => {
    const { evaluateNotifications } = await import("../server/notifications");
    const mockedEvaluate = vi.mocked(evaluateNotifications);
    await runWarmerTick();
    expect(mockedEvaluate).toHaveBeenCalled();
  });
});
