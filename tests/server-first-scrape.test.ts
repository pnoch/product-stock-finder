import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted holder so the mocked fetchAndParse can call the test's resilientFetch
// mock (module-local bindings cannot be intercepted by vi.mock).
const __resilientHolder = vi.hoisted(() => ({ fn: async (_o: unknown): Promise<any> => ({ status: "ok", html: "", method: "plain" }) }));
import type { Product, DistributorListing, PricePoint } from "../lib/types";

const state = vi.hoisted(() => ({
  watchlistStore: [] as Product[],
  updatedListings: [] as DistributorListing[][],
}));

const healthMocks = vi.hoisted(() => ({
  getDistributorHealth: vi.fn(async () => []),
  saveDistributorHealth: vi.fn(async () => {}),
}));

vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn(async () => state.watchlistStore),
  updateProductListings: vi.fn(
    async (productId: string, listings: DistributorListing[]) => {
      state.updatedListings.push(listings);
    },
  ),
  getSettings: vi.fn(async () => ({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: false,
    priceAlerts: false,
    stockAlerts: false,
  })),
  getAlerts: vi.fn(async () => []),
  getPriceDigestSnapshot: vi.fn(async () => null),
  savePriceDigestSnapshot: vi.fn(async () => {}),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
  uploadServerHistory: vi.fn(),
}));

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
  createStorageBreakerStore: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  })),
}));

vi.mock("../lib/scrapers/health", () => ({
  createHealthService: vi.fn(() => ({
    getDistributorHealth: healthMocks.getDistributorHealth,
    saveDistributorHealth: healthMocks.saveDistributorHealth,
  })),
}));

vi.mock("expo-task-manager", () => ({ defineTask: vi.fn() }));
vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success" },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn(async () => "notif-id"),
}));
vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => true),
}));
vi.mock("../lib/restock", () => ({
  checkRestocks: vi.fn(async () => {}),
}));
vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {}),
}));

import { fetchServerPrice, uploadServerHistory } from "../lib/server-prices";
import { getParserByDistributorId } from "../lib/scrapers/registry";
import { resilientFetch } from "../lib/scrapers/resilient";
import { checkPriceDropsNow } from "../lib/background-price-check";

// Point the mocked fetchAndParse at the test's resilientFetch mock.
__resilientHolder.fn = resilientFetch as unknown as typeof __resilientHolder.fn;

const mockedFetchServer = vi.mocked(fetchServerPrice);
const mockedUploadHistory = vi.mocked(uploadServerHistory);
const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetchLocal = vi.mocked(resilientFetch);

const listing: DistributorListing = {
  distributorId: "server2u-my",
  productId: "crs804",
  price: 100,
  currency: "USD",
  stockStatus: "unknown",
  url: "https://example.com",
  lastChecked: "2026-01-01T00:00:00.000Z",
  priceHistory: [],
};

const product = {
  id: "crs804",
  name: "CRS804",
  modelNumber: "CRS804",
  category: "Networking Switch",
  imageUrl: "",
  listings: [listing],
} as unknown as Product;

describe("server-first scraping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.watchlistStore = [product];
    state.updatedListings = [];
  });

  it("uses the server price and merges server history when the server responds", async () => {
    mockedFetchServer.mockResolvedValue({
      snapshot: {
        price: 88.5,
        currency: "MYR",
        stockStatus: "in_stock",
        url: "https://server2u.com/p/1",
        fetchedAt: Date.now(),
      },
      history: [
        {
          date: "2026-07-01T00:00:00.000Z",
          price: 95,
          currency: "MYR",
          stockStatus: "in_stock",
        },
        {
          date: "2026-08-01T00:00:00.000Z",
          price: 88.5,
          currency: "MYR",
          stockStatus: "in_stock",
        },
      ],
    });

    await checkPriceDropsNow();

    expect(mockedFetchLocal).not.toHaveBeenCalled();
    expect(state.updatedListings).toHaveLength(1);
    const updated = state.updatedListings[0][0];
    expect(updated.price).toBe(88.5);
    expect(updated.currency).toBe("MYR");
    expect(updated.stockStatus).toBe("in_stock");
    expect(updated.priceHistory).toHaveLength(3);
    expect(updated.priceHistory[0]).toMatchObject({ price: 95 });
  });

  it("falls back to local scraping when the server returns null", async () => {
    mockedFetchServer.mockResolvedValue(null);
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (m: string) => `https://server2u.com/shop?q=${m}`,
      parsePrice: () => ({
        price: 77,
        currency: "MYR",
        stockStatus: "back_order",
        url: "https://server2u.com/p/2",
      }),
      rateLimitMs: 0,
    });
    mockedFetchLocal.mockResolvedValue({
      status: "ok",
      html: "<html>price</html>",
      method: "plain",
    });

    await checkPriceDropsNow();

    expect(mockedFetchLocal).toHaveBeenCalled();
    expect(state.updatedListings).toHaveLength(1);
    expect(state.updatedListings[0][0].price).toBe(77);
    expect(state.updatedListings[0][0].stockStatus).toBe("back_order");
  });

  it("keeps the listing unchanged when both server and local fail", async () => {
    mockedFetchServer.mockResolvedValue(null);
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (m: string) => `https://server2u.com/shop?q=${m}`,
      parsePrice: () => null,
      rateLimitMs: 0,
    });
    mockedFetchLocal.mockResolvedValue({
      status: "ok",
      html: "<html>no price</html>",
      method: "plain",
    });

    await checkPriceDropsNow();

    expect(state.updatedListings).toHaveLength(1);
    expect(state.updatedListings[0][0]).toEqual(listing);
  });

  it("records blocked health when the local fetch is blocked", async () => {
    mockedFetchServer.mockResolvedValue(null);
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (m: string) => `https://server2u.com/shop?q=${m}`,
      parsePrice: () => null,
      rateLimitMs: 0,
    });
    mockedFetchLocal.mockResolvedValue({
      status: "blocked",
      method: "plain",
      error: "blocked by site",
    });

    await checkPriceDropsNow();

    expect(state.updatedListings).toHaveLength(1);
    expect(state.updatedListings[0][0]).toEqual(listing);
    expect(healthMocks.saveDistributorHealth).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          distributorId: "server2u-my",
          status: "blocked",
        }),
      ]),
    );
  });

  it("records blocked health when the local fetch is skipped due to cooldown", async () => {
    mockedFetchServer.mockResolvedValue(null);
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (m: string) => `https://server2u.com/shop?q=${m}`,
      parsePrice: () => null,
      rateLimitMs: 0,
    });
    mockedFetchLocal.mockResolvedValue({
      status: "skipped",
      method: "none",
    });

    await checkPriceDropsNow();

    expect(state.updatedListings).toHaveLength(1);
    expect(state.updatedListings[0][0]).toEqual(listing);
    expect(healthMocks.saveDistributorHealth).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          distributorId: "server2u-my",
          status: "blocked",
          reason: "in cooldown",
        }),
      ]),
    );
  });

  it("uploads local history when the server history is shorter", async () => {
    const localHistory: PricePoint[] = [
      {
        date: "2026-06-01T00:00:00.000Z",
        price: 100,
        currency: "USD",
        stockStatus: "unknown",
      },
      {
        date: "2026-07-01T00:00:00.000Z",
        price: 98,
        currency: "USD",
        stockStatus: "unknown",
      },
    ];
    state.watchlistStore = [
      { ...product, listings: [{ ...listing, priceHistory: localHistory }] },
    ];
    mockedFetchServer.mockResolvedValue({
      snapshot: {
        price: 88.5,
        currency: "MYR",
        stockStatus: "in_stock",
        url: "https://server2u.com/p/1",
        fetchedAt: Date.now(),
      },
      history: [],
    });

    await checkPriceDropsNow();

    expect(mockedUploadHistory).toHaveBeenCalledWith(
      "server2u-my",
      "CRS804",
      localHistory,
    );
  });
});
