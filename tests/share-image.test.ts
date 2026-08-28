// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { captureAndShareImage } from "../lib/share-image";

vi.mock("react-native", () => ({ Platform: { OS: "web" }, View: {} }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: vi.fn(async () => true), shareAsync: vi.fn(async () => {}) }));
vi.mock("react-native-view-shot", () => ({ captureRef: vi.fn() }));

describe("captureAndShareImage", () => {
  let anchor: { href: string; download: string; style: Record<string, string>; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    anchor = { href: "", download: "", style: {} as Record<string,string>, click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockImplementation((() => anchor) as unknown as typeof document.body.appendChild);
  });

  it("appends, clicks and removes anchor on web", async () => {
    const capture = vi.fn(async () => "data:image/png;base64,abc");
    const ref = { current: {} } as React.RefObject<unknown>;
    expect(await captureAndShareImage(ref as never, "file", capture as never)).toBe(true);
    expect(document.body.appendChild).toHaveBeenCalledWith(anchor as unknown as Node);
    expect(anchor.href).toBe("data:image/png;base64,abc");
    expect(anchor.download).toBe("file.png");
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
  });

  it("returns false when capture yields empty", async () => {
    const capture = vi.fn(async () => "");
    const ref = { current: {} } as React.RefObject<unknown>;
    expect(await captureAndShareImage(ref as never, "file", capture as never)).toBe(false);
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it("returns false when ref is null", async () => {
    const capture = vi.fn(async () => "data:");
    expect(await captureAndShareImage({ current: null } as never, "file", capture as never)).toBe(false);
  });
});
