import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTrending, filterTrending } from "@shared/trending";

describe("filterTrending", () => {
  const products = [
    { id: "nvidia-dgx-spark", name: "NVIDIA DGX Spark", brand: "NVIDIA", category: "Server" },
    { id: "nvidia-rtx-5090", name: "NVIDIA RTX 5090", brand: "NVIDIA", category: "GPU" },
    { id: "nintendo-switch-2", name: "Nintendo Switch 2", brand: "Nintendo", category: "Gaming Console" },
  ] as never[];

  it("finds a trending product by multi-word name", () => {
    expect(filterTrending(products, "dgx spark").map((p) => p.id)).toEqual(["nvidia-dgx-spark"]);
  });

  it("matches brand and category too", () => {
    expect(filterTrending(products, "nvidia").map((p) => p.id)).toEqual(["nvidia-dgx-spark", "nvidia-rtx-5090"]);
    expect(filterTrending(products, "gaming").map((p) => p.id)).toEqual(["nintendo-switch-2"]);
  });

  it("returns everything for an empty query and nothing for a miss", () => {
    expect(filterTrending(products, "  ")).toHaveLength(3);
    expect(filterTrending(products, "playstation")).toEqual([]);
  });
});

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
