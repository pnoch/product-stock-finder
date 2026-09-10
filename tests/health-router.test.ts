import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/health", () => ({
  checkAllDistributors: vi.fn().mockResolvedValue([
    {
      distributorId: "test-dist",
      status: "working",
      responseTimeMs: 123,
      lastChecked: new Date().toISOString(),
    },
  ]),
}));

import { checkAllDistributors } from "../server/health";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: (_name: string, _options: Record<string, unknown>) => {} } as TrpcContext["res"],
    deviceId: null,
  };
}

describe("health.check", () => {
  it("returns server-side distributor health", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.health.check();
    expect(vi.mocked(checkAllDistributors)).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ distributorId: "test-dist", status: "working" });
  });
});
