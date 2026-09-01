import { describe, it, expect, vi } from "vitest";

describe("fetchTrending regression — tRPC contract", () => {
  it("calls tRPC endpoint not REST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { data: { json: [] } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchTrending } = await import("../lib/trending");
    await fetchTrending();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/trpc/trending.get");
    expect(url).not.toContain("/api/trending\""); // REST path without tRPC
  });
  it("returns fallback when API returns empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ result: { data: { json: [] } } }),
    }));
    const { fetchTrending } = await import("../lib/trending");
    const result = await fetchTrending();
    expect(result.length).toBeGreaterThan(0); // fallback
  });
  it("parses superjson-wrapped response", async () => {
    const mockData = [{ id: "test", name: "Test", brand: "Test", category: "Test", estimatedPrice: 100, currency: "USD", reason: "test", source: "test", fetchedAt: new Date().toISOString(), expiresAt: new Date().toISOString() }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ result: { data: { json: mockData } } }),
    }));
    const { fetchTrending } = await import("../lib/trending");
    const result = await fetchTrending();
    expect(result).toEqual(mockData);
  });
});
