import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  convertPrice,
  setExchangeRates,
} from "../lib/currency";
import { EXCHANGE_RATES } from "../shared/src/currency";
import { FX_TTL_MS, getFxRates, clearFxCache } from "../server/fx";

function mockResponse(rates: Record<string, number>) {
  return {
    ok: true,
    json: async () => ({ result: "success", base_code: "USD", rates }),
  };
}

const fetchMock = vi.fn();

describe("fx service", () => {
  beforeEach(() => {
    clearFxCache();
    setExchangeRates(null);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and caches live rates on first call", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.88, GBP: 0.77 }));
    const result = await getFxRates();
    expect(result.fetchedAt).not.toBeNull();
    expect(result.rates.EUR).toBe(0.88);
    expect(result.rates.GBP).toBe(0.77);
    expect(result.rates.USD).toBe(1);
    expect(convertPrice(100, "USD", "EUR")!).toBeCloseTo(88);
  });

  it("returns a fresh cache without refetching", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.9 }));
    await getFxRates();
    fetchMock.mockClear();
    const result = await getFxRates();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.rates.EUR).toBe(0.9);
  });

  it("returns cached rates while refreshing when the cache is stale", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.9 }));
      await getFxRates();
      vi.setSystemTime(1_000_000 + FX_TTL_MS + 1000);
      fetchMock.mockResolvedValueOnce(mockResponse({ EUR: 0.85 }));
      const result = await getFxRates();
      expect(result.fetchedAt).toBe(1_000_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(0);
      const next = await getFxRates();
      expect(next.rates.EUR).toBe(0.85);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to static rates without throwing when the provider fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await getFxRates();
    expect(result.fetchedAt).toBeNull();
    expect(result.rates.EUR).toBe(EXCHANGE_RATES.EUR);
  });

  it("falls back to static rates on a non-ok or malformed response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ result: "error" }),
    });
    const bad = await getFxRates();
    expect(bad.fetchedAt).toBeNull();
    expect(bad.rates.EUR).toBe(EXCHANGE_RATES.EUR);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "error" }),
    });
    const malformed = await getFxRates();
    expect(malformed.fetchedAt).toBeNull();
    expect(malformed.rates.EUR).toBe(EXCHANGE_RATES.EUR);
  });

  it("shares a single fetch across concurrent calls with an empty cache", async () => {
    let resolveFetch: (value: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        }),
    );
    const p1 = getFxRates();
    const p2 = getFxRates();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveFetch!(mockResponse({ EUR: 0.9 }));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1.fetchedAt).not.toBeNull();
    expect(r2.fetchedAt).not.toBeNull();
  });
});
