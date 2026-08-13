import { describe, expect, it, vi, beforeEach } from "vitest";
import { convertPrice, setExchangeRates } from "../lib/currency";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import {
  loadFxRates,
  refreshFxRates,
  maybeRefreshFxRates,
  FX_TTL_MS,
} from "../lib/fx";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockQuery(result: unknown) {
  const query = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  mockedCreateClient.mockReturnValue({
    fx: { get: { query } },
  } as never);
  return query;
}

describe("fx client", () => {
  beforeEach(() => {
    store.clear();
    setExchangeRates(null);
  });

  it("loadFxRates applies stored rates to conversions", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({ rates: { EUR: 0.9 }, fetchedAt: Date.now() }),
    );
    await loadFxRates();
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(90);
  });

  it("refreshFxRates fetches, persists, and applies live rates", async () => {
    mockQuery({ rates: { EUR: 0.88 }, fetchedAt: 2000 });
    await refreshFxRates();
    expect(JSON.parse(store.get("fx_rates")!).rates.EUR).toBe(0.88);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(88);
  });

  it("refreshFxRates is a no-op when the fetch fails", async () => {
    mockQuery(new Error("network down"));
    await refreshFxRates();
    expect(store.has("fx_rates")).toBe(false);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(92);
  });

  it("maybeRefreshFxRates skips when stored rates are fresh", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({ rates: { EUR: 0.9 }, fetchedAt: Date.now() }),
    );
    const query = mockQuery({ rates: { EUR: 0.8 }, fetchedAt: Date.now() });
    await maybeRefreshFxRates();
    expect(query).not.toHaveBeenCalled();
  });

  it("maybeRefreshFxRates refreshes when stored rates are stale", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({
        rates: { EUR: 0.9 },
        fetchedAt: Date.now() - FX_TTL_MS - 1000,
      }),
    );
    const query = mockQuery({ rates: { EUR: 0.8 }, fetchedAt: Date.now() });
    await maybeRefreshFxRates();
    expect(query).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get("fx_rates")!).rates.EUR).toBe(0.8);
  });

  it("refreshFxRates gives up after the timeout when the query never resolves", async () => {
    vi.useFakeTimers();
    try {
      mockedCreateClient.mockReturnValue({
        fx: { get: { query: vi.fn(() => new Promise(() => {})) } },
      } as never);
      const promise = refreshFxRates();
      await vi.advanceTimersByTimeAsync(4000);
      await promise;
      expect(store.has("fx_rates")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshFxRates treats a malformed response as a failure", async () => {
    mockQuery({ rates: null, fetchedAt: Date.now() });
    await refreshFxRates();
    expect(store.has("fx_rates")).toBe(false);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(92);
  });

  it("refreshFxRates keeps last-known rates when the server has no live rates", async () => {
    store.set(
      "fx_rates",
      JSON.stringify({ rates: { EUR: 0.9 }, fetchedAt: 1000 }),
    );
    setExchangeRates({ EUR: 0.9 });
    mockQuery({ rates: { EUR: 0.92 }, fetchedAt: null });
    await refreshFxRates();
    expect(JSON.parse(store.get("fx_rates")!).rates.EUR).toBe(0.9);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(90);
  });

  it("dedupes concurrent refreshFxRates calls into a single fetch", async () => {
    const query = mockQuery({ rates: { EUR: 0.88 }, fetchedAt: 2000 });
    const [a, b] = await Promise.all([refreshFxRates(), refreshFxRates()]);
    await a;
    await b;
    expect(query).toHaveBeenCalledTimes(1);
    expect(convertPrice(100, "USD", "EUR")).toBeCloseTo(88);
  });
});
