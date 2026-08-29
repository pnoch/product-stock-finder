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
