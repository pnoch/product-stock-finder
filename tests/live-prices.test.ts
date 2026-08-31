import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl } from "../constants/oauth";
import { checkHealth } from "../lib/health";
import {
  applyServerPrice,
  composeLiveListings,
  deriveConnectionStatus,
  deriveListingQueries,
  mergeSampleHistory,
} from "../lib/live-prices";
import type {
  DistributorListing,
  PricePoint,
  ServerPriceResult,
} from "../lib/types";

vi.mock("../constants/oauth", () => ({
  getApiBaseUrl: vi.fn(),
  isServerConfigured: vi.fn(() => true),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

function listing(
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
  return {
    distributorId: "dist-1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "out_of_stock",
    url: "https://example.com",
    lastChecked: "2026-08-01T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  };
}

function point(date: string, price: number): PricePoint {
  return { date, price, currency: "USD", stockStatus: "in_stock" };
}

function serverResult(
  overrides: Partial<ServerPriceResult> = {},
): ServerPriceResult {
  return {
    snapshot: {
      price: 90,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: Date.now(),
    },
    history: [],
    ...overrides,
  };
}

describe("deriveConnectionStatus", () => {
  it("is connected when reachable and authenticated", () => {
    expect(
      deriveConnectionStatus({ reachable: true, isAuthenticated: true, configured: true }),
    ).toBe("connected");
  });

  it("is signed-out when reachable but not authenticated", () => {
    expect(
      deriveConnectionStatus({ reachable: true, isAuthenticated: false, configured: true }),
    ).toBe("signed-out");
  });

  it("is offline when not reachable regardless of auth", () => {
    expect(
      deriveConnectionStatus({ reachable: false, isAuthenticated: true, configured: true }),
    ).toBe("offline");
    expect(
      deriveConnectionStatus({ reachable: false, isAuthenticated: false, configured: true }),
    ).toBe("offline");
  });

  it("is local when no server is configured", () => {
    expect(
      deriveConnectionStatus({ reachable: false, isAuthenticated: false, configured: false }),
    ).toBe("local");
    expect(
      deriveConnectionStatus({ reachable: true, isAuthenticated: true, configured: false }),
    ).toBe("local");
  });
});

describe("checkHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true on 2xx", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("https://api.example.com");
    mockFetch.mockResolvedValue({ ok: true });
    await expect(checkHealth()).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/health",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("returns false on non-2xx", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("https://api.example.com");
    mockFetch.mockResolvedValue({ ok: false });
    await expect(checkHealth()).resolves.toBe(false);
  });

  it("returns false on network error", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("https://api.example.com");
    mockFetch.mockRejectedValue(new Error("network down"));
    await expect(checkHealth()).resolves.toBe(false);
  });

  it("returns false when base URL is empty", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("");
    await expect(checkHealth()).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("applyServerPrice", () => {
  it("returns the listing unchanged when serverResult is null", () => {
    const l = listing();
    expect(applyServerPrice(l, null)).toBe(l);
  });

  it("overrides price, stock, url and lastChecked from the snapshot", () => {
    const l = listing();
    const result = applyServerPrice(l, serverResult());
    expect(result.price).toBe(90);
    expect(result.stockStatus).toBe("in_stock");
    expect(result.url).toBe("https://example.com");
    expect(result.lastChecked).not.toBe(l.lastChecked);
  });

  it("appends the snapshot point to the merged history", () => {
    const l = listing({
      priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
    });
    const result = applyServerPrice(l, serverResult({ history: [] }));
    expect(result.priceHistory).toHaveLength(2);
    expect(result.priceHistory[1].price).toBe(90);
    expect(result.priceHistory[1].stockStatus).toBe("in_stock");
  });

  it("merges server history when the snapshot is absent", () => {
    const l = listing({
      priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
    });
    const result = applyServerPrice(
      l,
      serverResult({
        snapshot: null,
        history: [point("2026-08-11T09:00:00.000Z", 95)],
      }),
    );
    expect(result.priceHistory).toHaveLength(2);
    expect(result.price).toBe(100);
    expect(result.stockStatus).toBe("out_of_stock");
  });
});

describe("composeLiveListings", () => {
  it("maps each seed through applyServerPrice", () => {
    const seeds = [listing(), listing({ distributorId: "dist-2" })];
    const results = [serverResult(), null];
    const composed = composeLiveListings(seeds, results);
    expect(composed[0].price).toBe(90);
    expect(composed[1].price).toBe(100);
  });
});

describe("deriveListingQueries", () => {
  it("builds one query config per listing keyed by distributor and model", () => {
    const queries = deriveListingQueries("MODEL-1", [
      listing({ distributorId: "dist-1" }),
      listing({ distributorId: "dist-2" }),
    ]);
    expect(queries).toHaveLength(2);
    expect(queries[0].queryKey).toEqual(["price", "dist-1", "MODEL-1"]);
    expect(queries[1].queryKey).toEqual(["price", "dist-2", "MODEL-1"]);
    expect(queries[0].staleTime).toBe(60_000);
    expect(queries[0].retry).toBe(1);
    expect(typeof queries[0].queryFn).toBe("function");
  });
});

describe("mergeSampleHistory", () => {
  it("fills history on listings missing it, matching by distributorId", () => {
    const sample = [
      listing({
        distributorId: "dist-1",
        priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
      }),
    ];
    const result = mergeSampleHistory([listing()], sample);
    expect(result[0].priceHistory).toHaveLength(1);
  });

  it("leaves listings with history untouched", () => {
    const sample = [
      listing({
        distributorId: "dist-1",
        priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
      }),
    ];
    const withHistory = listing({
      priceHistory: [
        point("2026-08-01T09:00:00.000Z", 80),
        point("2026-08-02T09:00:00.000Z", 82),
      ],
    });
    const result = mergeSampleHistory([withHistory], sample);
    expect(result[0].priceHistory).toHaveLength(2);
    expect(result[0].priceHistory[0].price).toBe(80);
  });

  it("appends sample history to a 1-point real history instead of replacing it", () => {
    const sample = [
      listing({
        distributorId: "dist-1",
        priceHistory: [point("2026-08-10T09:00:00.000Z", 100)],
      }),
    ];
    const onePoint = listing({
      priceHistory: [point("2026-08-01T09:00:00.000Z", 80)],
    });
    const result = mergeSampleHistory([onePoint], sample);
    expect(result[0].priceHistory).toHaveLength(2);
    expect(result[0].priceHistory[0].price).toBe(80);
    expect(result[0].priceHistory[1].price).toBe(100);
  });
});
