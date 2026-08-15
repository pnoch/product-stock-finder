// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { ReactNode } from "react";
import { useLiveProduct, useLiveWatchlist } from "../hooks/use-live-prices";
import type {
  DistributorListing,
  Product,
  ServerPriceResult,
} from "../lib/types";

vi.mock("../lib/storage", () => ({
  getWatchlist: vi.fn(),
  updateProductListings: vi.fn(),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
}));

import { getWatchlist, updateProductListings } from "../lib/storage";
import { fetchServerPrice } from "../lib/server-prices";

const listing: DistributorListing = {
  distributorId: "dist-1",
  productId: "p1",
  price: 100,
  currency: "USD",
  stockStatus: "out_of_stock",
  url: "https://example.com",
  lastChecked: "2026-08-01T00:00:00.000Z",
  priceHistory: [],
};

const product: Product = {
  id: "p1",
  name: "Test Product",
  modelNumber: "MODEL-1",
  brand: "Test",
  category: "Router",
  description: "",
  addedAt: "2026-08-01T00:00:00.000Z",
  isWatched: true,
  listings: [listing],
};

const serverResult: ServerPriceResult = {
  snapshot: {
    price: 90,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com",
    fetchedAt: Date.now(),
  },
  history: [],
};

const listing2 = (
  distributorId: string,
  price: number,
): DistributorListing => ({
  distributorId,
  productId: "p2",
  price,
  currency: "USD",
  stockStatus: "out_of_stock",
  url: "https://example.com",
  lastChecked: "2026-08-01T00:00:00.000Z",
  priceHistory: [],
});

const product2: Product = {
  id: "p2",
  name: "Test Product 2",
  modelNumber: "MODEL-2",
  brand: "Test",
  category: "Switch",
  description: "",
  addedAt: "2026-08-01T00:00:00.000Z",
  isWatched: true,
  listings: [listing2("dist-2", 200), listing2("dist-3", 300)],
};

const serverResult2: ServerPriceResult = {
  snapshot: {
    price: 80,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com",
    fetchedAt: Date.now(),
  },
  history: [],
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe("useLiveProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWatchlist).mockResolvedValue([product]);
    vi.mocked(fetchServerPrice).mockResolvedValue(serverResult);
  });

  it("renders the seed listing immediately and hydrates the server snapshot", async () => {
    let resolveFetch!: (value: ServerPriceResult | null) => void;
    vi.mocked(fetchServerPrice).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.listings[0].price).toBe(100);

    resolveFetch(serverResult);
    await waitFor(() => expect(result.current.listings[0].price).toBe(90));
    expect(result.current.listings[0].stockStatus).toBe("in_stock");
    expect(fetchServerPrice).toHaveBeenCalledWith("dist-1", "MODEL-1");
  });

  it("keeps the seed listing when the server fetch fails", async () => {
    vi.mocked(fetchServerPrice).mockResolvedValue(null);
    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    await waitFor(() => expect(result.current.listings[0].price).toBe(100));
    expect(result.current.listings[0].stockStatus).toBe("out_of_stock");
  });

  it("refetches on refresh()", async () => {
    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.listings[0].price).toBe(90));
    expect(fetchServerPrice).toHaveBeenCalledTimes(1);

    await result.current.refresh();
    await waitFor(() => expect(fetchServerPrice).toHaveBeenCalledTimes(2));
  });

  it("persists merged listings after a successful fetch", async () => {
    const { result } = renderHook(() => useLiveProduct("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.listings[0].price).toBe(90));
    await waitFor(() => expect(updateProductListings).toHaveBeenCalled(), {
      timeout: 2000,
    });
    const [calledId, calledListings] = vi.mocked(updateProductListings).mock
      .calls[0] as [string, DistributorListing[]];
    expect(calledId).toBe("p1");
    expect(calledListings[0].price).toBe(90);
  });
});

describe("useLiveWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWatchlist).mockResolvedValue([product, product2]);
    vi.mocked(fetchServerPrice).mockImplementation(
      async (distributorId: string) => {
        if (distributorId === "dist-1") return serverResult;
        if (distributorId === "dist-2") return serverResult2;
        return null;
      },
    );
  });

  it("maps each product's server results to the correct listings", async () => {
    const { result } = renderHook(() => useLiveWatchlist(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    await waitFor(() =>
      expect(result.current.products[0].listings[0].price).toBe(90),
    );
    await waitFor(() =>
      expect(result.current.products[1].listings[0].price).toBe(80),
    );
    expect(result.current.products[1].listings[1].price).toBe(300);
  });

  it("persists merged listings for every product after a successful fetch", async () => {
    const { result } = renderHook(() => useLiveWatchlist(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(result.current.products[0].listings[0].price).toBe(90),
    );
    await waitFor(() => expect(updateProductListings).toHaveBeenCalled(), {
      timeout: 2000,
    });
    const calledIds = vi
      .mocked(updateProductListings)
      .mock.calls.map((c) => c[0]);
    expect(calledIds).toContain("p1");
    expect(calledIds).toContain("p2");
  });
});
