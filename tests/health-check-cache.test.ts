import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { clearRateLimitsForTests } from "../server/rate-limit";

vi.mock("../server/health", () => ({
  checkAllDistributors: vi.fn().mockResolvedValue([]),
}));

import { checkAllDistributors } from "../server/health";
import { clearHealthCacheForTests } from "../server/routers";

function publicCtx(ip: string): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip,
      socket: { remoteAddress: ip },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: null,
  };
}

describe("health.check cache", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    clearHealthCacheForTests();
    vi.clearAllMocks();
  });

  it("serves repeat checks from cache instead of re-scraping", async () => {
    const caller = appRouter.createCaller(publicCtx("7.7.7.7"));
    await caller.health.check();
    await caller.health.check();
    expect(vi.mocked(checkAllDistributors)).toHaveBeenCalledTimes(1);
  });
});
