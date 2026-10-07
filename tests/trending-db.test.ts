import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trendingProducts } from "../drizzle/schema";
import { getDb } from "../server/db";
import { trendingRouter } from "../server/routers/trending";
import { clearRateLimitsForTests } from "../server/rate-limit";
import type { TrpcContext } from "../server/_core/context";

const budget = vi.hoisted(() => ({ allow: true }));
vi.mock("../server/spend-budget", () => ({
  tryConsumeBudget: () => budget.allow,
}));

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

function adminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin",
      name: null,
      email: null,
      loginMethod: null,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip: "10.0.0.1",
      socket: { remoteAddress: "10.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}

const FEED_XML =
  '<rss><channel><item><title>RTX 5090 in stock</title><link>https://x/1</link></item></channel></rss>';

function stubFetch(content: string, opts: { feedOk?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("api.openai.com")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content } }] }),
          { status: 200 },
        );
      }
      if (opts.feedOk === false) return new Response("nope", { status: 500 });
      return new Response(FEED_XML, { status: 200 });
    }),
  );
}

const llmArray = JSON.stringify([
  {
    name: "RTX 5090",
    brand: "NVIDIA",
    category: "GPU",
    estimatedPrice: 2000,
    reason: "launch scarcity",
    source: "r/buildapcsales",
  },
]);

describe.skipIf(!runDbTests)("trending router (DB)", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(trendingProducts);
    clearRateLimitsForTests();
    budget.allow = true;
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refreshes from feeds + LLM and serves the rows", async () => {
    stubFetch(llmArray);
    const caller = trendingRouter.createCaller(adminCtx());
    expect(await caller.refresh()).toEqual({ count: 1 });

    const rows = await caller.get();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("RTX 5090");
    // Drizzle returns the decimal column as a string; the router must convert
    // it to a number or the client's formatPrice renders "N/A".
    expect(rows[0]!.estimatedPrice).toBe(2000);
    expect(typeof rows[0]!.estimatedPrice).toBe("number");
  });

  it("returns count 0 without clobbering existing rows when the model returns none", async () => {
    stubFetch(llmArray);
    const caller = trendingRouter.createCaller(adminCtx());
    await caller.refresh();

    stubFetch("[]");
    clearRateLimitsForTests();
    expect(await caller.refresh()).toEqual({ count: 0 });
    // The previous rows survive because a zero-row refresh must not delete.
    expect(await caller.get()).toHaveLength(1);
  });

  it("returns count 0 when the model content is not JSON", async () => {
    stubFetch("not json at all");
    const caller = trendingRouter.createCaller(adminCtx());
    expect(await caller.refresh()).toEqual({ count: 0 });
    expect(await caller.get()).toEqual([]);
  });

  it("returns count 0 when the model content is not an array", async () => {
    stubFetch(JSON.stringify({ nope: true }));
    const caller = trendingRouter.createCaller(adminCtx());
    expect(await caller.refresh()).toEqual({ count: 0 });
  });

  it("returns count 0 when every feed fails", async () => {
    stubFetch(llmArray, { feedOk: false });
    const caller = trendingRouter.createCaller(adminCtx());
    expect(await caller.refresh()).toEqual({ count: 0 });
  });

  it("returns count 0 when the process budget is exhausted", async () => {
    budget.allow = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = trendingRouter.createCaller(adminCtx());
    expect(await caller.refresh()).toEqual({ count: 0 });
    // No feed/model traffic is attempted once the budget is gone.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns count 0 when the model response body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("api.openai.com")
          ? new Response("<html>not json</html>", { status: 200 })
          : new Response(FEED_XML, { status: 200 }),
      ),
    );
    const caller = trendingRouter.createCaller(adminCtx());
    expect(await caller.refresh()).toEqual({ count: 0 });
  });
});
