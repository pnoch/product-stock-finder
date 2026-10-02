import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserLlmConfig } from "../server/user-llm";
import { PRODUCT_CATALOG } from "../shared/src/catalog.js";

const snapshot = {
  price: 100,
  currency: "USD",
  stockStatus: "in_stock",
  url: "https://example.com",
  fetchedAt: Date.now(),
};
const history = [
  {
    date: new Date().toISOString(),
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
  },
];

vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(async () => snapshot),
  setCachedPrice: vi.fn(),
  listNearExpiry: vi.fn(),
  getAllFetchedAt: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
}));
vi.mock("../server/price-history", () => ({
  getHistory: vi.fn(async () => history),
  recordHistoryPoint: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));
vi.mock("../server/db", () => ({ getDb: vi.fn(async () => null) }));

const llm = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../server/user-llm", () => ({
  isServerFundedLlm: () => false,
  invokeUserLlm: vi.fn(async (cfg: UserLlmConfig | null) => {
    llm.calls.push(cfg ? `${cfg.provider}:${cfg.model ?? ""}` : "server");
    return { choices: [{ message: { content: "Buy." } }] };
  }),
}));

import { clearInsightsForTests, getInsight } from "../server/price-insights";
import { getHistory } from "../server/price-history";

const PRODUCT = PRODUCT_CATALOG[0]!;
const cfgA: UserLlmConfig = { provider: "openai", model: "gpt-a" };
const cfgB: UserLlmConfig = { provider: "openai", model: "gpt-b" };

function gatedHistory() {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  vi.mocked(getHistory).mockImplementation(async () => {
    await gate;
    return history as never;
  });
  return release;
}

describe("getInsight single-flight keying", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearInsightsForTests();
    llm.calls = [];
    vi.mocked(getHistory).mockResolvedValue(history as never);
  });

  it("shares one in-flight call for the same product + config", async () => {
    const release = gatedHistory();
    const p1 = getInsight(PRODUCT.id, cfgA);
    const p2 = getInsight(PRODUCT.id, cfgA);
    release();
    await Promise.all([p1, p2]);
    expect(llm.calls).toEqual(["openai:gpt-a"]);
  });

  it("does not share an in-flight call across different configs", async () => {
    const release = gatedHistory();
    const p1 = getInsight(PRODUCT.id, cfgA);
    const p2 = getInsight(PRODUCT.id, cfgB);
    release();
    await Promise.all([p1, p2]);
    expect(llm.calls.sort()).toEqual(["openai:gpt-a", "openai:gpt-b"]);
  });

  it("does not share between a server-funded and a BYO caller", async () => {
    const release = gatedHistory();
    const p1 = getInsight(PRODUCT.id, null);
    const p2 = getInsight(PRODUCT.id, cfgA);
    release();
    await Promise.all([p1, p2]);
    expect(llm.calls.sort()).toEqual(["openai:gpt-a", "server"]);
  });
});
