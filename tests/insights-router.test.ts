import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/price-insights", () => ({
  getInsight: vi.fn(),
  clearInsightsForTests: vi.fn(),
}));

import { getInsight } from "../server/price-insights";
const mockedGetInsight = vi.mocked(getInsight);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: null,
  };
}

describe("insights router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the price insight for a product", async () => {
    mockedGetInsight.mockResolvedValue({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.insights.get({
      productId: "mikrotik-crs804-4ddq-hrm",
    });
    expect(result).toEqual({
      insight: "Price is down 7% over 30 days.",
      generatedAt: 1000,
    });
    expect(mockedGetInsight).toHaveBeenCalledWith("mikrotik-crs804-4ddq-hrm");
  });

  it("returns null when there is no insight", async () => {
    mockedGetInsight.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.insights.get({ productId: "unknown" });
    expect(result).toBeNull();
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetInsight.mockResolvedValue({ insight: "x", generatedAt: 1 });
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.insights.get({ productId: "a" })).resolves.toEqual({
      insight: "x",
      generatedAt: 1,
    });
  });
});
