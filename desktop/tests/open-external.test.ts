import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
// Imported at the top for `import/first`; vitest hoists `vi.mock` above it.
import { openExternal, externalLinkHandler } from "../src/lib/open-external";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const openSpy = vi.fn();
const originalOpen = window.open;

beforeEach(() => {
  vi.clearAllMocks();
  window.open = openSpy as unknown as typeof window.open;
});

afterEach(() => {
  window.open = originalOpen;
});

describe("openExternal", () => {
  it("opens through Rust under Tauri", async () => {
    // The webview cannot open external URLs itself (start_oauth shells out for
    // the same reason), so window.open never reached the browser.
    mockInvoke.mockResolvedValue(undefined);
    await openExternal("https://example.com/p");
    expect(mockInvoke).toHaveBeenCalledWith("open_external", {
      url: "https://example.com/p",
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("falls back to a plain browser window outside Tauri", async () => {
    mockInvoke.mockRejectedValue(new Error("not tauri"));
    await openExternal("mailto:support@example.com");
    expect(openSpy).toHaveBeenCalledWith(
      "mailto:support@example.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("preventDefaults an external anchor click", () => {
    mockInvoke.mockResolvedValue(undefined);
    const event = { preventDefault: vi.fn() };
    externalLinkHandler("https://example.com")(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
