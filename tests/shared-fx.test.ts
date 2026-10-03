import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FxRates = { rates: Record<string, number>; fetchedAt: number | null };

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  createTRPCClient: () => ({ fx: { get: { query: queryMock } } }),
}));

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

  it("returns null after the 4000ms timeout without leaking the timer", async () => {
    vi.useFakeTimers();
    queryMock.mockReturnValue(new Promise(() => {}));
    const fx = await loadFxModule();

    const pending = fx.fetchFxRates();
    const assertion = expect(pending).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
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

describe("FX_TTL_MS", () => {
  it("is one hour", async () => {
    const fx = await loadFxModule();
    expect(fx.FX_TTL_MS).toBe(60 * 60 * 1000);
  });
});
