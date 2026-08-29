import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAdapter = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

const mockEnqueue = vi.fn(async (_key: string, fn: () => Promise<void>) => {
  await fn();
});

function createStorage() {
  return {
    adapter: mockAdapter,
    KEYS: { FX_RATE_HISTORY: "fx_rate_history" },
    enqueue: mockEnqueue,
  };
}

describe("FX Rate History Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.getItem.mockResolvedValue(null);
  });

  it("returns null when no history exists", async () => {
    const { createFxHistoryStorage } = await import(
      "@/lib/storage/fx-history"
    );
    const storage = createFxHistoryStorage(createStorage() as any);
    const result = await storage.getFxHistory();
    expect(result).toBeNull();
  });

  it("saves history with enqueue", async () => {
    const { createFxHistoryStorage } = await import(
      "@/lib/storage/fx-history"
    );
    const storage = createFxHistoryStorage(createStorage() as any);
    await storage.saveFxHistory({
      rates: { USD: [1], EUR: [0.92] },
      timestamps: [1000],
    });
    expect(mockAdapter.setItem).toHaveBeenCalled();
  });
});

describe("appendFxHistory", () => {
  it("appends new rates and timestamp", async () => {
    const { appendFxHistory } = await import("@/lib/fx-history");
    const history = { rates: { USD: [1], EUR: [0.92] }, timestamps: [1000] };
    const result = appendFxHistory(history, { USD: 1, EUR: 0.93 }, 2000);
    expect(result.rates.USD).toEqual([1, 1]);
    expect(result.rates.EUR).toEqual([0.92, 0.93]);
    expect(result.timestamps).toEqual([1000, 2000]);
  });

  it("caps at MAX_POINTS", async () => {
    const { appendFxHistory } = await import("@/lib/fx-history");
    const history = {
      rates: { USD: Array(90).fill(1), EUR: Array(90).fill(0.92) },
      timestamps: Array(90).fill(0).map((_, i) => 1000 + i),
    };
    const result = appendFxHistory(history, { USD: 1, EUR: 0.93 }, 2000);
    expect(result.rates.USD.length).toBe(90);
    expect(result.timestamps.length).toBe(90);
    expect(result.timestamps[0]).toBe(1000 + 1);
  });

  it("creates new history from empty", async () => {
    const { appendFxHistory } = await import("@/lib/fx-history");
    const result = appendFxHistory(null, { USD: 1, EUR: 0.92 }, 1000);
    expect(result.rates.USD).toEqual([1]);
    expect(result.timestamps).toEqual([1000]);
  });
});

describe("getFxChange", () => {
  it("computes % change between last two data points", async () => {
    const { getFxChange } = await import("@/lib/fx-history");
    const history = {
      rates: { USD: [1, 1], EUR: [0.92, 0.93] },
      timestamps: [1000, 2000],
    };
    const change = getFxChange(history);
    expect(change.EUR).toBeCloseTo(1.087, 1);
  });

  it("returns 0 for single data point", async () => {
    const { getFxChange } = await import("@/lib/fx-history");
    const history = {
      rates: { EUR: [0.92] },
      timestamps: [1000],
    };
    const change = getFxChange(history);
    expect(change.EUR).toBe(0);
  });
});
