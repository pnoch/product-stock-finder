import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/spend-budget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/spend-budget")>();
  return { ...actual, tryConsumeBudget: vi.fn() };
});
vi.mock("../server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/db")>();
  return { ...actual, getDb: vi.fn(async () => null) };
});

import { appRouter } from "../server/routers";
import { tryConsumeBudget } from "../server/spend-budget";
import type { TrpcContext } from "../server/_core/context";

function adminCtx(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "open-7",
      name: null,
      email: null,
      loginMethod: null,
      role: "admin",
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
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}

describe("trending.refresh spend budget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns early without fetching feeds when the budget is spent", async () => {
    vi.mocked(tryConsumeBudget).mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.trending.refresh();
    expect(result).toEqual({ count: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
