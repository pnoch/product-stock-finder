import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { clearRateLimitsForTests } from "../server/rate-limit";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

function ctx(ip: string): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "open-1",
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
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
    deviceId: "dev-1",
  };
}

function item(id: string, updatedAt = 1000) {
  return {
    collection: "watchlist" as const,
    id,
    data: { id },
    updatedAt,
    deletedAt: null,
  };
}

describe("sync.push quotas", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("rejects batches larger than 200 items", async () => {
    const caller = appRouter.createCaller(ctx("10.10.0.1"));
    const items = Array.from({ length: 201 }, (_, i) => item(`p${i}`));
    await expect(caller.sync.push({ items })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects payloads whose total size exceeds 5MB", async () => {
    const caller = appRouter.createCaller(ctx("10.10.0.2"));
    const pad = "x".repeat(90_000);
    const items = Array.from({ length: 60 }, (_, i) => ({
      ...item(`p${i}`),
      data: { id: `p${i}`, pad },
    }));
    await expect(caller.sync.push({ items })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("clamps items dated far in the future instead of rejecting the batch", async () => {
    const caller = appRouter.createCaller(ctx("10.10.0.3"));
    const items = [item("a", Date.now() + 60 * 60 * 1000)];
    // Clamping (not rejecting) keeps sync working for a client with a bad clock.
    await expect(caller.sync.push({ items })).resolves.toMatchObject({
      accepted: 0,
    });
  });
});
