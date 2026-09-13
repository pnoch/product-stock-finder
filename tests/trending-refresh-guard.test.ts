import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function ctxFor(role: string): TrpcContext {
  return {
    user: {
      id: 7,
      openId: `open-7`,
      name: null,
      email: null,
      loginMethod: null,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip: "9.9.9.9",
      socket: { remoteAddress: "9.9.9.9" },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: null,
  };
}

describe("trending.refresh guard", () => {
  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(ctxFor("user"));
    await expect(caller.trending.refresh()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("sanitizes LLM rows to column limits with finite prices", async () => {
    const { sanitizeTrendingRows } = await import("../server/routers/trending");
    const rows = sanitizeTrendingRows([
      {
        name: "N".repeat(500),
        brand: "B".repeat(500),
        category: "C".repeat(500),
        estimatedPrice: NaN,
        reason: "R".repeat(2000),
        source: "S".repeat(500),
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name.length).toBeLessThanOrEqual(255);
    expect(rows[0]!.brand.length).toBeLessThanOrEqual(100);
    expect(rows[0]!.reason.length).toBeLessThanOrEqual(1000);
    expect(Number.isFinite(Number(rows[0]!.estimatedPrice))).toBe(true);
  });
});
