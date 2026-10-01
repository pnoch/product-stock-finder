import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ os: "web" as string }));
const share = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
  Share: {
    share: (...a: unknown[]) => share.fn(...(a as [])),
    dismissedAction: "dismissedAction",
  },
}));

import { shareText } from "../lib/share-text";

beforeEach(() => {
  state.os = "web";
  share.fn.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shareText on web", () => {
  it("uses navigator.share when available", async () => {
    const navShare = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share: navShare });
    expect(await shareText("hello")).toBe("shared");
    expect(navShare).toHaveBeenCalledWith({ text: "hello", title: undefined });
  });

  it("falls back to the clipboard when navigator.share is missing", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await shareText("hello")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to the clipboard when navigator.share throws a non-abort", async () => {
    const navShare = vi.fn(async () => {
      throw new Error("not supported");
    });
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share: navShare, clipboard: { writeText } });
    expect(await shareText("hello")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("reports dismissed when the user aborts the share sheet", async () => {
    const navShare = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("navigator", {
      share: navShare,
      clipboard: { writeText: vi.fn() },
    });
    expect(await shareText("hello")).toBe("dismissed");
  });

  it("reports failed when neither API is available", async () => {
    vi.stubGlobal("navigator", {});
    expect(await shareText("hello")).toBe("failed");
  });

  it("reports failed when the clipboard write throws", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("denied");
    });
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await shareText("hello")).toBe("failed");
  });
});

describe("shareText on native", () => {
  it("maps the native share action to shared", async () => {
    state.os = "ios";
    share.fn.mockResolvedValue({ action: "sharedAction" });
    expect(await shareText("hello", "Title")).toBe("shared");
    expect(share.fn).toHaveBeenCalledWith({ message: "hello", title: "Title" });
  });

  it("maps a dismissed native share to dismissed", async () => {
    state.os = "android";
    share.fn.mockResolvedValue({ action: "dismissedAction" });
    expect(await shareText("hello")).toBe("dismissed");
  });

  it("reports failed when the native share throws", async () => {
    state.os = "ios";
    share.fn.mockRejectedValue(new Error("no activity"));
    expect(await shareText("hello")).toBe("failed");
  });
});
