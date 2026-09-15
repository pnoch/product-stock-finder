import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" }, Share: { share: vi.fn(), dismissedAction: "dismissedAction" } }));

import { shareText } from "../lib/share-text";

describe("shareText on web", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses navigator.share when available", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share });
    expect(await shareText("hello")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ text: "hello", title: undefined });
  });

  it("falls back to the clipboard when navigator.share is missing", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await shareText("hello")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("reports dismissed when the user aborts the share sheet", async () => {
    const share = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });
    expect(await shareText("hello")).toBe("dismissed");
  });

  it("reports failed when neither API is available", async () => {
    vi.stubGlobal("navigator", {});
    expect(await shareText("hello")).toBe("failed");
  });
});
