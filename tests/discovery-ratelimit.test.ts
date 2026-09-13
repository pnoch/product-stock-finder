import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { clearRateLimitsForTests } from "../server/rate-limit";

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            product: {
              name: "Widget",
              modelNumber: "W-1",
              brand: "Acme",
              category: "Gadget",
              description: "A widget.",
            },
            retailers: [],
          }),
        },
      },
    ],
  })),
}));

function authedCtx(ip: string): TrpcContext {
  return {
    user: {
      id: 3,
      openId: "open-3",
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
    deviceId: null,
  };
}

describe("discovery.discover rate limit", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("rejects burst LLM discovery calls", async () => {
    const caller = appRouter.createCaller(authedCtx("8.8.8.8"));
    for (let i = 0; i < 10; i++) {
      await caller.discovery.discover({ query: `widget ${i}` });
    }
    await expect(
      caller.discovery.discover({ query: "one too many" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
