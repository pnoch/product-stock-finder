import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// invokeLLM is mocked in most suites, so the real fetch path (and its deadline)
// was never exercised. Node's fetch has no default timeout, so a hung Forge
// request held a paid insight/discovery call open indefinitely.
describe("invokeLLM fetch deadline", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.BUILT_IN_FORGE_API_KEY = "test-forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete process.env.BUILT_IN_FORGE_API_KEY;
    delete process.env.BUILT_IN_FORGE_API_URL;
  });

  it("passes an abort signal on the request", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await import("../server/_core/llm");
    const result = await invokeLLM({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.choices?.[0]?.message?.content).toBe("ok");
  });

  it("retries a network error and gives up after the retry budget", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await import("../server/_core/llm");
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/network down/);
    // Initial attempt + RETRY_MAX_RETRIES.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  }, 30_000);
});
