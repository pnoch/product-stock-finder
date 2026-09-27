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
import { BYO_LLM_AUTH_ERR_MSG } from "../shared/const";

function ctx(headers: Record<string, string> = {}): TrpcContext {
  return {
    user: { id: 1, openId: "o", name: "U", role: "user" } as never,
    req: { protocol: "https", hostname: "localhost", headers, ip: "1.2.3.4", socket: { remoteAddress: "1.2.3.4" } } as never,
    res: {} as never,
    deviceId: null,
  };
}

describe("discovery.discover spend budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

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

  it("still consumes the budget for a server-funded ollama-local config", async () => {
    // `ollama-local` runs on this host and uses no user key, so it is NOT
    // user-funded: skipping the process-wide cap left the host's GPU with no
    // global ceiling.
    const { tryConsumeBudget } = await import("../server/spend-budget");
    vi.mocked(tryConsumeBudget).mockReturnValue(true);
    const body = {
      message: {
        content: JSON.stringify({
          product: { name: "RTX 5090", modelNumber: "RTX5090" },
          retailers: [],
        }),
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const caller = discoveryRouter.createCaller(
        ctx({
          "x-llm-provider": "ollama-local",
          "x-llm-url": "http://localhost:11434",
        }),
      );
      await caller.discover({ query: "rtx 5090" });
      expect(tryConsumeBudget).toHaveBeenCalledWith("discovery.discover");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("routes through the user's provider and skips the budget for BYO-LLM", async () => {
    const body = {
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
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
      // postJson reads the body as text (to bound its size), then parses it.
      text: async () => JSON.stringify(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    const caller = discoveryRouter.createCaller(
      ctx({ "x-llm-provider": "openai", "x-llm-key": "sk-1" }),
    );
    await caller.discover({ query: "rtx 5090" });
    expect(tryConsumeBudget).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.anything(),
    );
  });

  it("maps a rejected BYO key to an actionable precondition error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "bad key" } }),
      }),
    );
    const caller = discoveryRouter.createCaller(
      ctx({ "x-llm-provider": "openai", "x-llm-key": "sk-1" }),
    );
    await expect(caller.discover({ query: "rtx 5090" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: BYO_LLM_AUTH_ERR_MSG,
    });
  });
});
