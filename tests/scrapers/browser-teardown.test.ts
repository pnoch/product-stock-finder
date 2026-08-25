import { describe, expect, it, vi } from "vitest";
import { teardownBrowserSession } from "../../lib/scrapers/browser";

describe("teardownBrowserSession", () => {
  it("releases the browser even when page/context close throws", async () => {
    const release = vi.fn();
    const page = { close: vi.fn().mockRejectedValue(new Error("page close boom")) };
    const context = {
      close: vi.fn().mockRejectedValue(new Error("context close boom")),
    };
    await expect(
      teardownBrowserSession(page as never, context as never, release),
    ).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("still closes the context when the page close throws", async () => {
    const release = vi.fn();
    const page = { close: vi.fn().mockRejectedValue(new Error("boom")) };
    const context = { close: vi.fn().mockResolvedValue(undefined) };
    await teardownBrowserSession(page as never, context as never, release);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("closes nothing when handles are missing but still releases", async () => {
    const release = vi.fn();
    await teardownBrowserSession(undefined, undefined, release);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
