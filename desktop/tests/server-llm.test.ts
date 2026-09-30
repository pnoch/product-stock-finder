import { describe, expect, it, vi, beforeEach } from "vitest";
import { testLlmConnection } from "../src/lib/server-llm";

const mockMutate = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({ llm: { test: { mutate: mockMutate } } }),
}));

function setResult(result: unknown) {
  mockMutate.mockImplementation(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
}

describe("desktop testLlmConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setResult({ ok: true, provider: "openai" });
  });

  it("returns the provider result on success", async () => {
    expect(await testLlmConnection()).toEqual({ ok: true, provider: "openai" });
  });

  it("returns an auth-failure result", async () => {
    setResult({ ok: false, provider: "openai", reason: "auth" });
    expect(await testLlmConnection()).toEqual({
      ok: false,
      provider: "openai",
      reason: "auth",
    });
  });

  it("returns null when the call throws", async () => {
    setResult(new Error("network down"));
    expect(await testLlmConnection()).toBeNull();
  });

  it("times out (returns null) when the call never resolves", async () => {
    vi.useFakeTimers();
    try {
      mockMutate.mockImplementation(() => new Promise(() => {}));
      const promise = testLlmConnection();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(await promise).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
