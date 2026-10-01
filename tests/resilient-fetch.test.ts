import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyFetchStatus,
  createMemoryBreakerStore,
  createStorageBreakerStore,
  fetchAndParse,
  resilientFetch,
  BrowserBlockedError,
  BrowserUnavailableError,
  type BreakerEntry,
} from "../lib/scrapers/resilient";
import type { DistributorParser } from "../lib/scrapers/types";

const browserMock = vi.hoisted(() => ({ fetchWithBrowser: vi.fn() }));

vi.mock("../lib/scrapers/browser", () => ({
  fetchWithBrowser: browserMock.fetchWithBrowser,
}));

const bg = vi.hoisted(() => ({
  state: "active" as string,
  fetch: vi.fn(
    async (
      _url: string,
      _timeout?: number,
      _headers?: Record<string, string>,
    ) => ({ html: "<html>price</html>", status: 200 }),
  ),
}));
vi.mock("../lib/background-safe-timers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/background-safe-timers")>();
  return { ...actual, getBackgroundAppState: () => bg.state };
});
vi.mock("../lib/background-fetch", () => ({
  backgroundFetch: (...a: unknown[]) =>
    bg.fetch(...(a as [string, number, Record<string, string>])),
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

  // A corrupt entry (null/non-object) would make `list.find((e) => e.distributorId
  // === id)` throw, and resilientFetch does not catch that.
  it("ignores malformed entries in the stored list", async () => {
    const adapter = makeAdapter();
    await adapter.setItem(
      "distributor_breaker",
      JSON.stringify([null, "oops", { distributorId: "d1", status: "blocked", consecutiveFailures: 1, lastAttemptAt: 0, cooldownUntil: 100 }]),
    );
    const store = createStorageBreakerStore(adapter);
    const entry = await store.get("d1");
    expect(entry?.distributorId).toBe("d1");
    expect(await store.get("missing")).toBeNull();
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

  it("serializes concurrent writes so no entry is lost", async () => {
    const store = createStorageBreakerStore(makeAdapter());
    await Promise.all(
      ["d1", "d2", "d3", "d4", "d5"].map((distributorId) =>
        store.set({
          distributorId,
          status: "blocked" as const,
          consecutiveFailures: 1,
          lastAttemptAt: 0,
          cooldownUntil: 100,
        }),
      ),
    );
    for (const distributorId of ["d1", "d2", "d3", "d4", "d5"]) {
      expect(await store.get(distributorId)).not.toBeNull();
    }
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

  it("does not share a deduped outcome across different breaker stores", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const stateA = createMemoryBreakerStore();
    const stateB = createMemoryBreakerStore();
    const [a, b] = await Promise.all([
      resilientFetch({
        parser: makeParser(),
        url: "https://example.com/search?q=CRS804",
        state: stateA,
      }),
      resilientFetch({
        parser: makeParser(),
        url: "https://example.com/search?q=CRS804",
        state: stateB,
      }),
    ]);
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    // Both stores must observe the outcome: sharing one store's result left the
    // other unaware of a block/broken breaker state.
    expect((await stateA.get("d1"))?.status).toBe("working");
    expect((await stateB.get("d1"))?.status).toBe("working");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still dedupes concurrent identical requests sharing a breaker store", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    await Promise.all([
      resilientFetch({
        parser: makeParser(),
        url: "https://example.com/search?q=CRS804",
        state,
      }),
      resilientFetch({
        parser: makeParser(),
        url: "https://example.com/search?q=CRS804",
        state,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a definitive browser block", async () => {
    const fetchMock = vi.fn(
      async () => new Response("403 Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockRejectedValue(
      new BrowserBlockedError("Cloudflare challenge could not be resolved"),
    );
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true }),
      url: "https://example.com/search?q=CRS804",
      state,
    });
    expect(outcome.status).toBe("blocked");
    // One navigation, not maxRetries+1: re-driving a blocking challenge only
    // compounds it and misreports the outcome as a transient error.
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
    expect(await state.get("d1")).toMatchObject({ status: "blocked" });
  });

  it("forwards timeoutMs to the browser escalation path", async () => {
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
      timeoutMs: 1234,
    });
    expect(outcome.status).toBe("ok");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledWith(
      "https://example.com/search?q=CRS804",
      expect.objectContaining({ timeoutMs: 1234 }),
    );
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

  it("falls back to plain when the browser is blocked but plain succeeds", async () => {
    // A browser-detected block does not imply a plain request is also blocked,
    // so the other method is still attempted.
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
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("plain");
    expect(fetchMock).toHaveBeenCalled();
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

describe("resilientFetch escalation and timeouts", () => {
  beforeEach(() => {
    browserMock.fetchWithBrowser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("escalates to browser when plain fetch fails hard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    browserMock.fetchWithBrowser.mockResolvedValue("<html>price</html>");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      retryBaseMs: 1,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("browser");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
  });

  it("aborts a hung plain fetch after timeoutMs and escalates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error("The operation was aborted")),
            );
          }),
      ),
    );
    browserMock.fetchWithBrowser.mockResolvedValue("<html>price</html>");
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      timeoutMs: 25,
      retryBaseMs: 1,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("browser");
  });

  it("does not fire the timeout for fast responses", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
      timeoutMs: 5000,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("plain");
  });

  it("shares the promise for a concurrent duplicate fetch of the same distributor", async () => {
    let releaseFetch!: () => void;
    const gate = new Promise<void>((resolve) => (releaseFetch = resolve));
    let fetchCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        fetchCalls += 1;
        await gate;
        return new Response("<html>price</html>", { status: 200 });
      }),
    );
    const state = createMemoryBreakerStore();
    const opts = {
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state,
    };
    const firstP = resilientFetch(opts);
    const secondP = resilientFetch(opts);
    releaseFetch();
    const [first, second] = await Promise.all([firstP, secondP]);
    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    expect(fetchCalls).toBe(1);
    // Sequential follow-up must not be blocked by the released guard
    const third = await resilientFetch(opts);
    expect(third.status).toBe("ok");
  });
});

describe("classifyFetchStatus anti-bot markers", () => {
  it("classifies modern challenge pages as blocked", () => {
    expect(classifyFetchStatus("<title>Just a moment...</title>")).toBe("blocked");
    expect(classifyFetchStatus("Attention Required! | Cloudflare")).toBe("blocked");
    expect(
      classifyFetchStatus(
        'script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"',
      ),
    ).toBe("blocked");
    expect(classifyFetchStatus('<div id="px-captcha"></div>')).toBe("blocked");
    expect(classifyFetchStatus("script src=https://captcha-delivery.com/x.js")).toBe("blocked");
  });

  it("does not flag ordinary content mentioning security words", () => {
    expect(classifyFetchStatus("<p>We block captcha abuse.</p>", 200)).toBe("ok");
  });

  it("does not flag a healthy page with a benign Cloudflare script tag", () => {
    // Real storefronts embed the precursor script and a reCAPTCHA site key on
    // normal pages; treating those as blocks made every fetch look blocked.
    const healthy =
      '<html><body><script src="/cdn-cgi/challenge-platform/scripts/precursor/main.js"></script>' +
      '<script>var cfg = { captcha_setkey: "6LdGN_sgAAAAAGYFg1lmVoakQ8QXxbhWqZ1GpYaJ" };</script>' +
      "<h1>MikroTik CRS326</h1><span class=\"price\">$499</span></body></html>";
    expect(classifyFetchStatus(healthy, 200)).toBe("ok");
  });
});

describe("resilientFetch while backgrounded", () => {
  afterEach(() => {
    bg.state = "active";
    vi.unstubAllGlobals();
  });

  it("uses the native background fetch with a capped timeout", async () => {
    bg.state = "background";
    bg.fetch.mockClear();
    bg.fetch.mockResolvedValueOnce({ html: "<html>price</html>", status: 200 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await resilientFetch({
      parser: makeParser(),
      url: "https://example.com/search?q=CRS804",
      state: createMemoryBreakerStore(),
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.html).toBe("<html>price</html>");
    // JS timers are frozen in the background, so window.fetch must not be used.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(bg.fetch).toHaveBeenCalledTimes(1);
    const call = bg.fetch.mock.calls[0]!;
    expect(call[0]).toBe("https://example.com/search?q=CRS804");
    expect(call[1]).toBeLessThanOrEqual(10_000);
    expect((call[2] as Record<string, string>).Accept).toContain("text/html");
  });
});

describe("fetchAndParse", () => {
  beforeEach(() => {
    browserMock.fetchWithBrowser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a null result when the search fetch is not ok", async () => {
    browserMock.fetchWithBrowser.mockRejectedValue(
      new BrowserBlockedError("challenge"),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("403 Forbidden", { status: 403 })),
    );
    const r = await fetchAndParse(
      makeParser(),
      "CRS804",
      createMemoryBreakerStore(),
    );
    expect(r.result).toBeNull();
    expect(r.url).toBe("https://example.com/search?q=CRS804");
  });

  it("parses the search page when there is no second hop", async () => {
    const html = "<html>product 42</html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 })),
    );
    const parser = makeParser({
      parsePrice: (h) => (h === html ? ({ price: 42 } as never) : null),
    });
    const r = await fetchAndParse(parser, "CRS804", createMemoryBreakerStore());
    expect(r.url).toBe("https://example.com/search?q=CRS804");
    expect((r.result as { price: number }).price).toBe(42);
  });

  it("resolves a relative product URL and parses the second hop", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return new Response(
          url.includes("/product/") ? "<html>second</html>" : "<html>search</html>",
          { status: 200 },
        );
      }),
    );
    const parser = makeParser({
      resolveProductUrl: () => "/product/1",
      parsePrice: (h) => (h.includes("second") ? ({ price: 9 } as never) : null),
    });
    const r = await fetchAndParse(parser, "CRS804", createMemoryBreakerStore());
    expect(r.url).toBe("https://example.com/product/1");
    expect((r.result as { price: number }).price).toBe(9);
    expect(calls[1]).toBe("https://example.com/product/1");
  });

  it("keeps a raw URL it cannot normalize", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response(url.includes("[bad") ? "<html>second</html>" : "<html>search</html>", {
          status: 200,
        }),
      ),
    );
    const parser = makeParser({
      resolveProductUrl: () => "http://[bad",
      parsePrice: (h) => (h.includes("second") ? ({ price: 3 } as never) : null),
    });
    const r = await fetchAndParse(parser, "CRS804", createMemoryBreakerStore());
    expect(r.url).toBe("http://[bad");
    expect((r.result as { price: number }).price).toBe(3);
  });

  it("falls back to the search page when the resolver returns nothing", async () => {
    const html = "<html>first</html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 })),
    );
    const parser = makeParser({
      resolveProductUrl: () => "",
      parsePrice: (h) => (h === html ? ({ price: 7 } as never) : null),
    });
    const r = await fetchAndParse(parser, "CRS804", createMemoryBreakerStore());
    expect(r.url).toBe("https://example.com/search?q=CRS804");
    expect((r.result as { price: number }).price).toBe(7);
  });

  it("returns null with the product URL when the second hop fails", async () => {
    browserMock.fetchWithBrowser.mockRejectedValue(
      new BrowserBlockedError("challenge"),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response(url.includes("/product/") ? "403 Forbidden" : "search", {
          status: url.includes("/product/") ? 403 : 200,
        }),
      ),
    );
    const parser = makeParser({ resolveProductUrl: () => "/product/1" });
    const r = await fetchAndParse(parser, "CRS804", createMemoryBreakerStore());
    expect(r.result).toBeNull();
    expect(r.url).toBe("https://example.com/product/1");
  });
});
