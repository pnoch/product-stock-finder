import { describe, expect, it, vi, beforeEach } from "vitest";
import { llmRouter } from "../server/routers/llm";
import { invokeLLM } from "../server/_core/llm";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/_core/llm", () => ({ invokeLLM: vi.fn() }));

function ctx(headers: Record<string, string> = {}, user: unknown = { id: 1, openId: "o", name: "U", role: "user" }): TrpcContext {
  return {
    user: user as never,
    req: { headers } as never,
    res: {} as never,
    deviceId: null,
  };
}

const byo = { "x-llm-provider": "openai", "x-llm-key": "sk-1" };

describe("llm.test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports forge as ok without calling any provider", async () => {
    const caller = llmRouter.createCaller(ctx());
    await expect(caller.test()).resolves.toEqual({ ok: true, provider: "forge" });
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("works signed out (public) with the caller's key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      }),
    );
    // no user → publicProcedure must still resolve rather than reject as 401
    const caller = llmRouter.createCaller(ctx(byo, null));
    await expect(caller.test()).resolves.toEqual({ ok: true, provider: "openai" });
  });

  it("reports ok when the user's provider responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      }),
    );
    const caller = llmRouter.createCaller(ctx(byo));
    await expect(caller.test()).resolves.toEqual({ ok: true, provider: "openai" });
  });

  it("classifies a rejected key as reason auth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "bad key" } }),
      }),
    );
    const caller = llmRouter.createCaller(ctx(byo));
    await expect(caller.test()).resolves.toEqual({
      ok: false,
      provider: "openai",
      reason: "auth",
    });
  });

  it("classifies other provider failures as reason error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    const caller = llmRouter.createCaller(ctx(byo));
    await expect(caller.test()).resolves.toEqual({
      ok: false,
      provider: "openai",
      reason: "error",
    });
  });
});
