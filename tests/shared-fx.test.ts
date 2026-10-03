import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FxRates = { rates: Record<string, number>; fetchedAt: number | null };

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  createTRPCClient: () => ({ fx: { get: { query: queryMock } } }),
}));

// `lastFetchedAt` / `inFlight` live in module scope, so every test must load a
// fresh copy of the module or state leaks across cases.
async function loadFxModule() {
  vi.resetModules();
  return import("../shared/src/fx");
}

beforeEach(() => {
  queryMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchFxRates", () => {
  it("resolves a valid rates payload from the client", async () => {
    const payload: FxRates = { rates: { USD: 1 }, fetchedAt: 1_700_000_000_000 };
    queryMock.mockResolvedValue(payload);
    const fx = await loadFxModule();

    await expect(fx.fetchFxRates()).resolves.toEqual(payload);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a falsy result", null],
    ["an undefined result", undefined],
    ["a missing rates field", { fetchedAt: 1 }],
    ["a null rates field", { rates: null, fetchedAt: 1 }],
    ["a non-object rates field", { rates: 42, fetchedAt: 1 }],
  ])("returns null for %s", async (_label, result) => {
    queryMock.mockResolvedValue(result);
    const fx = await loadFxModule();

    await expect(fx.fetchFxRates()).resolves.toBeNull();
  });

  it("returns null when the client query rejects", async () => {
    queryMock.mockRejectedValue(new Error("network down"));
    const fx = await loadFxModule();

    await expect(fx.fetchFxRates()).resolves.toBeNull();
  });

  it("returns null after the 4000ms timeout", async () => {
    vi.useFakeTimers();
    queryMock.mockReturnValue(new Promise(() => {}));
    const fx = await loadFxModule();

    const pending = fx.fetchFxRates();
    const assertion = expect(pending).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("clears its timeout timer on the fast path (no leaked timer)", async () => {
    vi.useFakeTimers();
    queryMock.mockResolvedValue({ rates: { USD: 1 }, fetchedAt: 1 });
    const fx = await loadFxModule();

    const pending = fx.fetchFxRates();
    await vi.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toEqual({ rates: { USD: 1 }, fetchedAt: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("loadFxRates", () => {
  it("resolves without touching the network", async () => {
    const fx = await loadFxModule();

    await expect(fx.loadFxRates()).resolves.toBeUndefined();
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("refreshFxRates", () => {
  it("marks the module fresh so maybeRefreshFxRates skips fetching", async () => {
    queryMock.mockResolvedValue({ rates: { USD: 1 }, fetchedAt: Date.now() });
    const fx = await loadFxModule();

    await fx.refreshFxRates();
    expect(queryMock).toHaveBeenCalledTimes(1);

    await fx.maybeRefreshFxRates();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("dedups concurrent calls in the same tick", async () => {
    let resolveQuery: (value: FxRates) => void = () => {};
    queryMock.mockReturnValue(
      new Promise<FxRates>((resolve) => {
        resolveQuery = resolve;
      }),
    );
    const fx = await loadFxModule();

    const first = fx.refreshFxRates();
    const second = fx.refreshFxRates();
    expect(first).toBe(second);

    resolveQuery({ rates: { USD: 1 }, fetchedAt: Date.now() });
    await Promise.all([first, second]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("ignores an invalid fetchedAt and leaves the module stale", async () => {
    queryMock.mockResolvedValue({ rates: { USD: 1 }, fetchedAt: 0 });
    const fx = await loadFxModule();

    await fx.refreshFxRates();
    await fx.maybeRefreshFxRates();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a null fetch result and leaves the module stale", async () => {
    queryMock.mockResolvedValue(null);
    const fx = await loadFxModule();

    await fx.refreshFxRates();
    await fx.maybeRefreshFxRates();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});

describe("maybeRefreshFxRates", () => {
  it("fetches when there is no prior fetch", async () => {
    queryMock.mockResolvedValue({ rates: { USD: 1 }, fetchedAt: Date.now() });
    const fx = await loadFxModule();

    await fx.maybeRefreshFxRates();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("fetches when the cached rate is older than the TTL", async () => {
    // Beat the deterministic jitter (bounded to [-300k, +300k)) so the window
    // is unambiguously expired regardless of the hashed offset.
    queryMock.mockResolvedValue({
      rates: { USD: 1 },
      fetchedAt: Date.now() - FX_TTL_MS - MAX_JITTER_MS - 1000,
    });
    const fx = await loadFxModule();

    await fx.refreshFxRates();
    expect(queryMock).toHaveBeenCalledTimes(1);

    await fx.maybeRefreshFxRates();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});

describe("FX_TTL_MS", () => {
  it("is one hour", async () => {
    const fx = await loadFxModule();
    expect(fx.FX_TTL_MS).toBe(60 * 60 * 1000);
  });
});

const FX_TTL_MS = 60 * 60 * 1000;
const MAX_JITTER_MS = 300_000;
