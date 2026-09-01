import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTrending } from "../lib/trending";

describe("fetchTrending", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns trending products from API", async () => {
    const mockData = [
      {
        id: "1",
        name: "RTX 5090",
        brand: "NVIDIA",
        category: "GPU",
        estimatedPrice: 2000,
        currency: "USD",
        reason: "Extremely limited availability",
        source: "r/buildapcsales",
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { data: { json: mockData } } }),
      }),
    );
    const result = await fetchTrending();
    expect(result).toEqual(mockData);
  });

  it("returns fallback trending on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await fetchTrending();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe("nvidia-dgx-spark");
  });

  it("returns fallback trending on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const result = await fetchTrending();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe("nvidia-dgx-spark");
  });
});
