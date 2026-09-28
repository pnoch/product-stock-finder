import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "../server/_core/fetch-timeout";

describe("_core fetchWithTimeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("passes an abort signal so a hung provider is cut off", async () => {
    // The paid image API and the local Ollama had no deadline; Node's fetch has
    // no default timeout, so a hung provider held the request open.
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok");
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithTimeout("https://x.test/", {}, 1000);
    expect(res.status).toBe(200);
  });

  it("aborts when the deadline elapses", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: unknown, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const promise = fetchWithTimeout("https://x.test/", {}, 500);
    const assertion = expect(promise).rejects.toThrow(/Aborted/);
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
  });
});
