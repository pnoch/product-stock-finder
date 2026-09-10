import { describe, expect, it, vi, beforeEach } from "vitest";
import { copyTextWithFallback, saveNodeAsPng } from "../src/lib/share";

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));
import { toPng } from "html-to-image";

const realCreate = document.createElement.bind(document);

beforeEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("copyTextWithFallback", () => {
  it("uses the clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await expect(copyTextWithFallback("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });
  it("falls back to textarea + execCommand", async () => {
    Object.assign(navigator, { clipboard: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand as typeof document.execCommand;
    await expect(copyTextWithFallback("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });
  it("returns false when everything fails", async () => {
    Object.assign(navigator, { clipboard: undefined });
    document.execCommand = (() => { throw new Error("denied"); }) as typeof document.execCommand;
    await expect(copyTextWithFallback("hello")).resolves.toBe(false);
  });
});

describe("saveNodeAsPng", () => {
  it("saves the node as a download", async () => {
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,abc");
    const anchor = realCreate("a") as HTMLAnchorElement;
    const click = vi.fn();
    anchor.click = click;
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "a") return anchor as unknown as HTMLElement;
      return realCreate(tag as never) as unknown as HTMLElement;
    }) as typeof document.createElement);
    await saveNodeAsPng(realCreate("div"), "out.png");
    expect(toPng).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
  it("throws when toPng fails", async () => {
    vi.mocked(toPng).mockRejectedValue(new Error("rasterize"));
    await expect(saveNodeAsPng(realCreate("div"), "out.png")).rejects.toThrow();
  });
});
