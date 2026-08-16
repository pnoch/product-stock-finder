import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyFetchStatus,
  createMemoryBreakerStore,
  createStorageBreakerStore,
  resilientFetch,
  BrowserUnavailableError,
  type BreakerEntry,
} from "../lib/scrapers/resilient";
import type { DistributorParser } from "../lib/scrapers/types";

const browserMock = vi.hoisted(() => ({ fetchWithBrowser: vi.fn() }));

vi.mock("../lib/scrapers/browser", () => ({
  fetchWithBrowser: browserMock.fetchWithBrowser,
}));

function makeParser(
  overrides: Partial<DistributorParser> = {},
): DistributorParser {
  return {
    id: "d1",
    baseUrl: "https://example.com",
    buildSearchUrl: (model) => `https://example.com/search?q=${model}`,
    parsePrice: () => null,
    rateLimitMs: 0,
    ...overrides,
  };
}

describe("classifyFetchStatus", () => {
  it("classifies 403 and 429 as blocked", () => {
    expect(classifyFetchStatus("<html>hi</html>", 403)).toBe("blocked");
    expect(classifyFetchStatus("<html>hi</html>", 429)).toBe("blocked");
  });

  it("classifies other 4xx/5xx as error", () => {
    expect(classifyFetchStatus("<html>hi</html>", 500)).toBe("error");
    expect(classifyFetchStatus("<html>hi</html>", 404)).toBe("error");
  });

  it("classifies Cloudflare challenge markers as blocked", () => {
    expect(classifyFetchStatus("Checking your browser...")).toBe("blocked");
    expect(classifyFetchStatus("cf-browser-verification")).toBe("blocked");
    expect(classifyFetchStatus("403 Forbidden")).toBe("blocked");
    expect(classifyFetchStatus("Access Denied")).toBe("blocked");
  });

  it("classifies normal HTML as ok", () => {
    expect(classifyFetchStatus("<html>price $50</html>", 200)).toBe("ok");
    expect(classifyFetchStatus("<html>price $50</html>")).toBe("ok");
  });
});

describe("createMemoryBreakerStore", () => {
  it("returns null for unknown distributors", async () => {
    const store = createMemoryBreakerStore();
    expect(await store.get("d1")).toBeNull();
  });

  it("round-trips entries", async () => {
    const store = createMemoryBreakerStore();
    const entry: BreakerEntry = {
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 2,
      lastAttemptAt: 100,
      cooldownUntil: 200,
      reason: "blocked by site",
    };
    await store.set(entry);
    expect(await store.get("d1")).toEqual(entry);
  });
});

describe("createStorageBreakerStore", () => {
  function makeAdapter() {
    const data = new Map<string, string>();
    return {
      getItem: vi.fn(async (key: string) => data.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        data.set(key, value);
      }),
    };
  }

  it("returns null for unknown distributors", async () => {
    const store = createStorageBreakerStore(makeAdapter());
    expect(await store.get("d1")).toBeNull();
  });

  it("round-trips entries across store instances", async () => {
    const adapter = makeAdapter();
    const store1 = createStorageBreakerStore(adapter);
    const store2 = createStorageBreakerStore(adapter);
    const entry: BreakerEntry = {
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 1,
      lastAttemptAt: 100,
      cooldownUntil: 200,
    };
    await store1.set(entry);
    expect(await store2.get("d1")).toEqual(entry);
  });

  it("keeps multiple distributors independent", async () => {
    const store = createStorageBreakerStore(makeAdapter());
    await store.set({
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 1,
      lastAttemptAt: 0,
      cooldownUntil: 100,
    });
    await store.set({
      distributorId: "d2",
      status: "working",
      consecutiveFailures: 0,
      lastAttemptAt: 0,
      cooldownUntil: 0,
    });
    expect((await store.get("d1"))?.status).toBe("blocked");
    expect((await store.get("d2"))?.status).toBe("working");
  });
});

describe("resilientFetch", () => {
  beforeEach(() => {
    browserMock.fetchWithBrowser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok and records success for a plain fetch", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.html).toBe("<html>price</html>");
    expect(outcome.method).toBe("plain");
    expect(await state.get("d1")).toMatchObject({
      status: "working",
      consecutiveFailures: 0,
    });
  });

  it("escalates to browser when plain is blocked", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockResolvedValue("<html>price</html>");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("browser");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
  });

  it("reports blocked when plain is blocked and browser escalation fails", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockRejectedValue(
      new Error("browser not available"),
    );
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      now: () => 1000,
      retryBaseMs: 1,
    });
    expect(outcome.status).toBe("blocked");
    const entry = await state.get("d1");
    expect(entry?.status).toBe("blocked");
    expect(entry?.cooldownUntil).toBe(1000 + 30 * 60 * 1000);
  });

  it("breaks the circuit on blocked and enters cooldown", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockResolvedValue("403 Forbidden");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      now: () => 1000,
    });
    expect(outcome.status).toBe("blocked");
    const entry = await state.get("d1");
    expect(entry?.status).toBe("blocked");
    expect(entry?.consecutiveFailures).toBe(1);
    expect(entry?.cooldownUntil).toBe(1000 + 30 * 60 * 1000);
  });

  it("skips when the breaker is in cooldown", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    await state.set({
      distributorId: "d1",
      status: "blocked",
      consecutiveFailures: 2,
      lastAttemptAt: 0,
      cooldownUntil: 5000,
    });
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      now: () => 1000,
    });
    expect(outcome.status).toBe("skipped");
    expect(outcome.method).toBe("none");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries transient errors then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response("<html>price</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      retryBaseMs: 1,
    });
    expect(outcome.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("enters cooldown after the failure threshold", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const opts = {
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      retryBaseMs: 1,
      failureThreshold: 3,
      failureCooldownMs: 15 * 60 * 1000,
      now: () => 1000,
    };
    await resilientFetch(opts);
    await resilientFetch(opts);
    const third = await resilientFetch(opts);
    expect(third.status).toBe("error");
    const entry = await state.get("d1");
    expect(entry?.consecutiveFailures).toBe(3);
    expect(entry?.cooldownUntil).toBe(1000 + 15 * 60 * 1000);
  });

  it("grows blocked cooldown with consecutive failures", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockResolvedValue("403 Forbidden");
    const state = createMemoryBreakerStore();
    let nowValue = 1000;
    const opts = {
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      now: () => nowValue,
    };
    await resilientFetch(opts);
    nowValue = 1000 + 60 * 60 * 1000;
    await resilientFetch(opts);
    const entry = await state.get("d1");
    expect(entry?.consecutiveFailures).toBe(2);
    expect(entry?.cooldownUntil).toBe(
      nowValue + Math.round(30 * 60 * 1000 * 1.5),
    );
  });

  it("uses browser first for useBrowser parsers", async () => {
    browserMock.fetchWithBrowser.mockResolvedValue("<html>price</html>");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { timeoutMs: 1000 } }),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("browser");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to plain when browser is blocked", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockResolvedValue("403 Forbidden");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { timeoutMs: 1000 } }),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to plain when browser is unavailable", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockRejectedValue(
      new Error("browser not available"),
    );
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { timeoutMs: 1000 } }),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("plain");
  });

  it("fast-fails a browser-unavailable error without retrying", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockRejectedValue(
      new BrowserUnavailableError("browser module unavailable"),
    );
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { timeoutMs: 1000 } }),
      url: "https://example.com/search?q=CRS804",
      state,
      retryBaseMs: 1000,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("plain");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
  });
});
