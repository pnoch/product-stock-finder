import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

import { getCachedPrice } from "../server/price-cache";
import { getHistory } from "../server/price-history";
import { invokeLLM } from "../server/_core/llm";
import { getDb } from "../server/db";
import { getInsight, clearInsightsForTests } from "../server/price-insights";

const mockedGetCached = vi.mocked(getCachedPrice);
const mockedGetHistory = vi.mocked(getHistory);
const mockedInvokeLLM = vi.mocked(invokeLLM);
const mockedGetDb = vi.mocked(getDb);

const snapshot: PriceSnapshot = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
  fetchedAt: Date.parse("2026-08-12T00:00:00Z"),
};

const history: PricePoint[] = [
  {
    date: "2026-07-01T00:00:00.000Z",
    price: 95,
    currency: "MYR",
    stockStatus: "in_stock",
  },
  {
    date: "2026-08-01T00:00:00.000Z",
    price: 88.5,
    currency: "MYR",
    stockStatus: "in_stock",
  },
];

describe("getInsight", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearInsightsForTests();
    mockedGetCached.mockResolvedValue(snapshot);
    mockedGetHistory.mockResolvedValue(history);
    mockedInvokeLLM.mockResolvedValue({
      id: "x",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Price is down 7% over 30 days.",
          },
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

describe("getInsight single-flight", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearInsightsForTests();
    mockedGetCached.mockResolvedValue(snapshot);
    mockedGetHistory.mockResolvedValue(history);
    mockedInvokeLLM.mockResolvedValue({
      id: "x",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Single-flight result." },
          finish_reason: "stop",
        },
      ],
    });
  });

  it("deduplicates concurrent LLM calls for the same product", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockedInvokeLLM.mockImplementation(async () => {
      await gate;
      return {
        id: "x",
        created: 1,
        model: "m",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Deduped." },
            finish_reason: "stop",
          },
        ],
      };
    });
    const aP = getInsight("mikrotik-crs804-4ddq-hrm");
    const bP = getInsight("mikrotik-crs804-4ddq-hrm");
    release();
    const [a, b] = await Promise.all([aP, bP]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
  });

  it("serves a stale cached insight when the LLM fails", async () => {
    // First call succeeds and caches
    const first = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(first).not.toBeNull();
    expect(first!.insight).toContain("Single-flight result.");
    // Second call: LLM fails but stale cache should be returned
    mockedInvokeLLM.mockRejectedValue(new Error("llm down"));
    const second = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(second).not.toBeNull();
    expect(second!.insight).toContain("Single-flight result.");
  });
});

describe("getInsight BYO-LLM", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    await clearInsightsForTests();
    mockedGetCached.mockResolvedValue(snapshot);
    mockedGetHistory.mockResolvedValue(history);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not publish BYO provider output to the shared cache", async () => {
    const body = { choices: [{ message: { content: "BYO insight." } }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      }),
    );
    mockedInvokeLLM.mockResolvedValue({
      id: "x",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Operator insight." },
          finish_reason: "stop",
        },
      ],
    });
    try {
      const byo = await getInsight("mikrotik-crs804-4ddq-hrm", {
        provider: "openai",
        apiKey: "sk-1",
      });
      expect(byo!.insight).toBe("BYO insight.");

      // A non-BYO caller must not be served the BYO user's text from cache.
      const operator = await getInsight("mikrotik-crs804-4ddq-hrm");
      expect(operator!.insight).toBe("Operator insight.");
      expect(mockedInvokeLLM).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("routes through the user's provider instead of the built-in LLM", async () => {
    const body = { choices: [{ message: { content: "BYO insight." } }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
      // postJson reads the body as text (to bound its size), then parses it.
      text: async () => JSON.stringify(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getInsight("mikrotik-crs804-4ddq-hrm", {
      provider: "openai",
      apiKey: "sk-1",
    });
    expect(result).not.toBeNull();
    expect(result!.insight).toBe("BYO insight.");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.anything(),
    );
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });
});

describe("getInsight deal score grounding", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearInsightsForTests();
    mockedGetCached.mockResolvedValue(snapshot);
    mockedGetHistory.mockResolvedValue(history);
    mockedInvokeLLM.mockResolvedValue({
      id: "x",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Grounded result." },
          finish_reason: "stop",
        },
      ],
    });
  });

  it("includes the deal score in the LLM context", async () => {
    const falling: PricePoint[] = [
      "2026-05-01T00:00:00.000Z",
      "2026-05-11T00:00:00.000Z",
      "2026-05-21T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
      "2026-06-11T00:00:00.000Z",
      "2026-06-21T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      "2026-07-11T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z",
    ].map((date, i) => {
      const prices = [120, 118, 115, 112, 110, 105, 100, 95, 92, 88.5];
      return {
        date,
        price: prices[i]!,
        currency: "MYR",
        stockStatus: "in_stock" as const,
      };
    });
    mockedGetHistory.mockResolvedValue(falling);
    await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
    const args = mockedInvokeLLM.mock.calls[0]?.[0] as {
      messages: { role: string; content: string }[];
    };
    const userMessage = args.messages.find((m) => m.role === "user");
    expect(userMessage).toBeDefined();
    const context = JSON.parse(userMessage!.content) as {
      dealScore: {
        score: number;
        band: string;
        factors: Record<string, unknown>;
      } | null;
    };
    expect(context.dealScore).toEqual({
      score: expect.any(Number),
      band: expect.any(String),
      factors: expect.any(Object),
    });
    expect(context.dealScore!.band).toBe("hot");
  });

  it("sends null dealScore for thin history", async () => {
    mockedGetHistory.mockResolvedValue([]);
    await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
    const args = mockedInvokeLLM.mock.calls[0]?.[0] as {
      messages: { role: string; content: string }[];
    };
    const userMessage = args.messages.find((m) => m.role === "user");
    expect(userMessage).toBeDefined();
    const context = JSON.parse(userMessage!.content) as {
      dealScore: unknown;
    };
    expect(context.dealScore).toBeNull();
  });

  it("instructs consistency with the score", async () => {
    await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
    const args = mockedInvokeLLM.mock.calls[0]?.[0] as {
      messages: { role: string; content: string }[];
    };
    const systemMessage = args.messages.find((m) => m.role === "system");
    expect(systemMessage).toBeDefined();
    expect(systemMessage!.content).toContain("never contradict");
  });
});

describe("getInsight DB resilience", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearInsightsForTests();
    mockedGetCached.mockResolvedValue(snapshot);
    mockedGetHistory.mockResolvedValue(history);
    mockedInvokeLLM.mockResolvedValue({
      id: "x",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Fresh insight." },
          finish_reason: "stop",
        },
      ],
    });
    mockedGetDb.mockResolvedValue(null as never);
  });

  afterEach(() => {
    mockedGetDb.mockReset();
  });

  it("falls back to the memory cache when a DB read fails", async () => {
    const first = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(first!.insight).toContain("Fresh insight");
    mockedGetDb.mockResolvedValue({
      select: () => {
        throw new Error("db down");
      },
    } as never);
    const second = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(second).toEqual(first);
  });

  it("keeps a freshly generated insight when the DB write fails", async () => {
    mockedGetDb.mockResolvedValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
      insert: () => ({
        values: () => ({
          onDuplicateKeyUpdate: async () => {
            throw new Error("db down");
          },
        }),
      }),
    } as never);
    const result = await getInsight("mikrotik-crs804-4ddq-hrm");
    expect(result!.insight).toContain("Fresh insight");
  });
});
