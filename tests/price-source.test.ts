import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted holder so the mocked fetchAndParse can call the test's resilientFetch
// mock (module-local bindings cannot be intercepted by vi.mock).
const __resilientHolder = vi.hoisted(() => ({ fn: async (_o: unknown): Promise<any> => ({ status: "ok", html: "", method: "plain" }) }));

const state = vi.hoisted(() => ({
  configured: true,
  serverResult: null as unknown,
  scrapeResult: null as unknown,
}));

vi.mock("../constants/oauth", () => ({
  isServerConfigured: vi.fn(() => state.configured),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(async () => state.serverResult),
}));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn((id: string) =>
    id === "none"
      ? undefined
      : {
          id,
          buildSearchUrl: (m: string) =>
            `https://x.test/?q=${encodeURIComponent(m)}`,
          parsePrice: vi.fn(() =>
            state.scrapeResult === "BLOCKED" ? null : state.scrapeResult,
          ),
          rateLimitMs: 0,
        },
  ),
}));

vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(async () => ({
    status: state.scrapeResult === "BLOCKED" ? "blocked" : "ok",
    html: state.scrapeResult ? "<html>ok</html>" : "",
  })),
  // fetchAndParse is the production entry point; delegate to the mocked
  // resilientFetch + the parser so existing assertions still hold.
  fetchAndParse: vi.fn(async (parser: any, model: string) => {
    const outcome = await __resilientHolder.fn({ parser, url: parser.buildSearchUrl(model) } as never);
    return {
      result: outcome.status === "ok" && outcome.html ? parser.parsePrice(outcome.html, model, parser.buildSearchUrl(model)) : null,
      url: parser.buildSearchUrl(model),
      outcome,
    };
  }),
  createMemoryBreakerStore: vi.fn(() => ({})),
}));

import { resolvePrice, scrapePriceOnDevice } from "../lib/price-source";
import { resilientFetch } from "../lib/scrapers/resilient";

// Point the mocked fetchAndParse at the test's resilientFetch mock.
__resilientHolder.fn = resilientFetch as unknown as typeof __resilientHolder.fn;

describe("resolvePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.configured = true;
    state.serverResult = null;
    state.scrapeResult = null;
  });

  it("returns the server result with source=server on hit", async () => {
    state.serverResult = {
      snapshot: { price: 200, currency: "USD", stockStatus: "in_stock", fetchedAt: 1 },
      history: [],
    };
    const r = await resolvePrice("linitx-uk", "CRS326");
    expect(r?.source).toBe("server");
    expect(r?.snapshot?.price).toBe(200);
  });

  it("falls back to device scrape when the server misses", async () => {
    state.scrapeResult = { price: 199, currency: "USD", stockStatus: "in_stock" };
    const r = await resolvePrice("linitx-uk", "CRS326");
    expect(r?.source).toBe("device");
    expect(r?.snapshot?.price).toBe(199);
    expect(r?.snapshot?.fetchedAt).toBeGreaterThan(0);
    expect(r?.history).toEqual([]);
  });

  it("skips the server leg entirely when unconfigured", async () => {
    state.configured = false;
    state.scrapeResult = { price: 199, currency: "USD", stockStatus: "in_stock" };
    const { fetchServerPrice } = await import("../lib/server-prices");
    await resolvePrice("linitx-uk", "CRS326");
    expect(fetchServerPrice).not.toHaveBeenCalled();
  });

  it("returns null when no parser exists", async () => {
    expect(await resolvePrice("none", "CRS326")).toBeNull();
  });

  it("returns null when the device scrape fails", async () => {
    state.scrapeResult = null;
    expect(await resolvePrice("linitx-uk", "CRS326")).toBeNull();
  });

  it("returns null when blocked", async () => {
    state.scrapeResult = "BLOCKED";
    expect(await resolvePrice("linitx-uk", "CRS326")).toBeNull();
  });
});

describe("scrapePriceOnDevice", () => {
  beforeEach(() => {
    state.scrapeResult = null;
  });

  it("threads the model into parsePrice", async () => {
    state.scrapeResult = { price: 10, currency: "GBP", stockStatus: "in_stock" };
    const r = await scrapePriceOnDevice("linitx-uk", "CRS804-4DDQ-hRM");
    expect(r?.source).toBe("device");
  });

  it("caps concurrent device scrapes", async () => {
    let inFlight = 0;
    let peak = 0;
    const { resilientFetch } = await import("../lib/scrapers/resilient");
    vi.mocked(resilientFetch).mockImplementation(async (_opts: unknown) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return { status: "ok", html: "<html>x</html>" } as never;
    });
    state.scrapeResult = { price: 1, currency: "USD", stockStatus: "in_stock" };
    await Promise.all(
      Array.from({ length: 9 }, () => scrapePriceOnDevice("linitx-uk", "M")),
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

});

// The device-scrape semaphore must hand slots to waiters directly. The naive
// decrement-then-wake lets a racing acquire take the freed slot too, exceeding
// the cap (see lib/concurrency.ts).
describe("createSemaphore", () => {
  it("never exceeds the limit when a release races a new acquire", async () => {
    const { createSemaphore } = await import("../lib/concurrency");
    const sem = createSemaphore(3);
    await sem.acquire();
    await sem.acquire();
    await sem.acquire();
    expect(sem.active).toBe(3);

    let waiterAcquired = false;
    const waiter = sem.acquire().then(() => {
      waiterAcquired = true;
    });
    await Promise.resolve();

    // Release one and, in the same turn (before the waiter's continuation can
    // run), try to acquire again. The freed slot must go to the waiter, so this
    // new acquire has to wait.
    sem.release();
    let racerAcquired = false;
    const racer = sem.acquire().then(() => {
      racerAcquired = true;
    });
    await Promise.resolve();
    expect(racerAcquired).toBe(false);
    expect(sem.active).toBeLessThanOrEqual(3);

    // Drain: releasing lets the waiter (already transferred) and then the racer
    // proceed one at a time.
    await waiter;
    expect(waiterAcquired).toBe(true);
    sem.release();
    await racer;
    expect(racerAcquired).toBe(true);
    expect(sem.active).toBeLessThanOrEqual(3);
  });

  it("rejects when the queue is full", async () => {
    const { createSemaphore } = await import("../lib/concurrency");
    const sem = createSemaphore(1, { maxQueue: 1 });
    await sem.acquire();
    const queued = sem.acquire(); // fills the queue
    await expect(sem.acquire()).rejects.toThrow(/queue full/);
    sem.release();
    await queued;
  });
});

// The server's scrape limiter must use the shared slot-transferring semaphore;
// the old decrement-then-wake form over-admitted past MAX_CONCURRENT_SCRAPES.
describe("server scrape limiter", () => {
  it("uses the shared semaphore", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile("server/prices.ts", "utf8");
    expect(src).toContain("createSemaphore(MAX_CONCURRENT_SCRAPES");
    expect(src).not.toContain("scrapeQueue");
  });
});
