import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PriceSnapshot, PricePoint } from "../lib/types";

vi.mock("../server/price-cache", () => ({
  getCachedPrice: vi.fn(),
  setCachedPrice: vi.fn(),
  listNearExpiry: vi.fn(),
  getAllFetchedAt: vi.fn(),
  clearPriceCacheForTests: vi.fn(),
}));

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { getCachedPrice } from "../server/price-cache";
import { getHistory } from "../server/price-history";
import { invokeLLM } from "../server/_core/llm";
import { getInsight, clearInsightsForTests } from "../server/price-insights";

const mockedGetCached = vi.mocked(getCachedPrice);
const mockedGetHistory = vi.mocked(getHistory);
const mockedInvokeLLM = vi.mocked(invokeLLM);

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: Date.parse("2026-08-12T00:00:00Z"),
};

const history: PricePoint[] = [
  { date: "2026-07-01T00:00:00.000Z", price: 95, currency: "MYR", stockStatus: "in_stock" },
  { date: "2026-08-01T00:00:00.000Z", price: 88.5, currency: "MYR", stockStatus: "in_stock" },
];

describe("getInsight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInsightsForTests();
    mockedGetCached.mockResolvedValue(snapshot);
    mockedGetHistory.mockResolvedValue(history);
    mockedInvokeLLM.mockResolvedValue({
      id: "x",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Price is down 7% over 30 days." },
          finish_reason: "stop",
        },
      ],
    });
  });

  it("generates and caches an insight on first call", async () => {
    const result = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(result).not.toBeNull();
    expect(result!.insight).toContain("Price is down 7%");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
  });

  it("returns the cached insight on a second call without calling the LLM again", async () => {
    await getInsight("mikrotik-crs804-4ddq-hrm");
    const second = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(second).not.toBeNull();
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
  });

  it("returns null when the product is not in the catalog", async () => {
    const result = await getInsight("unknown-product");
    expect(result).toBeNull();
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });

  it("returns null when the LLM call fails", async () => {
    mockedInvokeLLM.mockRejectedValue(new Error("llm down"));
    const result = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(result).toBeNull();
  });
});
