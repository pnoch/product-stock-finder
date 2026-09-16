import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted holder so the mocked fetchAndParse can call the test's resilientFetch
// mock (module-local bindings cannot be intercepted by vi.mock).
const __resilientHolder = vi.hoisted(() => ({ fn: async (_o: unknown): Promise<any> => ({ status: "ok", html: "", method: "plain" }) }));
import type { DistributorParser } from "../lib/scrapers/types";

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
  createMemoryBreakerStore: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  })),
}));

vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(async () => null),
  setCachedPrice: vi.fn(async () => {}),
  listNearExpiry: vi.fn(async () => []),
  getAllFetchedAt: vi.fn(async () => []),
  clearPriceCacheForTests: vi.fn(),
}));

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(async () => {}),
  getHistory: vi.fn(async () => []),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

vi.mock("../server/product-images", () => ({
  getProductImage: vi.fn(),
  listProductsMissingImage: vi.fn(async () => []),
  clearImagesForTests: vi.fn(),
}));

vi.mock("../server/notifications", () => ({
  upsertDeviceConfig: vi.fn(),
  evaluateNotifications: vi.fn(),
  pullPendingEvents: vi.fn(),
  clearNotificationsForTests: vi.fn(),
}));

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { resilientFetch } from "../lib/scrapers/resilient";
import { getPrice } from "../server/prices";

// Point the mocked fetchAndParse at the test's resilientFetch mock.
__resilientHolder.fn = resilientFetch as unknown as typeof __resilientHolder.fn;

const parser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) => `https://server2u.com/shop?q=${model}`,
  parsePrice: () => null,
  rateLimitMs: 0,
};

describe("scrape concurrency bound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getParserByDistributorId).mockReturnValue(parser);
  });

  it("never runs more than the global cap of concurrent scrapes", async () => {
    let active = 0;
    let peak = 0;
    vi.mocked(resilientFetch).mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return { status: "ok", html: "<html></html>" } as never;
    });

    // 30 distinct cache-miss requests, each triggering a background scrape.
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        getPrice("server2u-my", `MODEL-${i}`),
      ),
    );
    // Let the queued background scrapes drain.
    await new Promise((r) => setTimeout(r, 300));

    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(6);
  });
});
