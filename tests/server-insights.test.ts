import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/constants/oauth", () => ({
  isServerConfigured: vi.fn(() => true),
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchPriceInsight } from "../lib/server-insights";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockClientQuery(query: Mock) {
  mockedCreateClient.mockReturnValue({
    insights: { get: { query } },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchPriceInsight", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the insight from the server", async () => {
    const query = vi.fn().mockResolvedValue({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    mockClientQuery(query);
    const result = await fetchPriceInsight("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    expect(query).toHaveBeenCalledWith({
      productId: "mikrotik-crs804-4ddq-hrm",
    });
  });

  it("returns null when the server returns null", async () => {
    const query = vi.fn().mockResolvedValue(null);
    mockClientQuery(query);
    expect(await fetchPriceInsight("x")).toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const query = vi.fn().mockRejectedValue(new Error("network"));
    mockClientQuery(query);
    expect(await fetchPriceInsight("x")).toBeNull();
  });

  it("returns null when the query times out", async () => {
    const query = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise<{ insight: string; generatedAt: number }>((resolve) =>
            setTimeout(() => resolve({ insight: "x", generatedAt: 1 }), 10_000),
          ),
      );
    mockClientQuery(query);
    expect(await fetchPriceInsight("x")).toBeNull();
  });
});
