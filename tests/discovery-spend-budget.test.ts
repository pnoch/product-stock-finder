import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("../server/_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("../server/spend-budget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/spend-budget")>();
  return { ...actual, tryConsumeBudget: vi.fn() };
});

import { discoveryRouter } from "../server/routers/discovery";
import { invokeLLM } from "../server/_core/llm";
import { tryConsumeBudget } from "../server/spend-budget";
import type { TrpcContext } from "../server/_core/context";

function ctx(): TrpcContext {
  return {
    user: { id: 1, openId: "o", name: "U", role: "user" } as never,
    req: { protocol: "https", hostname: "localhost", headers: {}, ip: "1.2.3.4", socket: { remoteAddress: "1.2.3.4" } } as never,
    res: {} as never,
    deviceId: null,
  };
}

describe("discovery.discover spend budget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses without calling the LLM once the budget is spent", async () => {
    vi.mocked(tryConsumeBudget).mockReturnValue(false);
    const caller = discoveryRouter.createCaller(ctx());
    await expect(caller.discover({ query: "rtx 5090" })).rejects.toBeInstanceOf(
      TRPCError,
    );
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("calls the LLM when budget is available", async () => {
    vi.mocked(tryConsumeBudget).mockReturnValue(true);
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              product: { name: "RTX 5090", modelNumber: "RTX5090" },
              retailers: [],
            }),
          },
        },
      ],
    } as never);
    const caller = discoveryRouter.createCaller(ctx());
    await caller.discover({ query: "rtx 5090" });
    expect(tryConsumeBudget).toHaveBeenCalledWith("discovery.discover");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });
});
