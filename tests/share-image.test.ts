// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ os: "web" as string }));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
  View: {},
}));

const sharing = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => {}),
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: (...a: unknown[]) => sharing.isAvailableAsync(...(a as [])),
  shareAsync: (...a: unknown[]) => sharing.shareAsync(...(a as [])),
}));
vi.mock("react-native-view-shot", () => ({ captureRef: vi.fn() }));

import { captureAndShareImage } from "../lib/share-image";

describe("captureAndShareImage — web", () => {
  let anchor: {
    href: string;
    download: string;
    style: Record<string, string>;
    click: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    state.os = "web";
    vi.clearAllMocks();
    sharing.isAvailableAsync.mockResolvedValue(true);
    anchor = {
      href: "",
      download: "",
      style: {} as Record<string, string>,
      click: vi.fn(),
      remove: vi.fn(),
    };
    vi.spyOn(document, "createElement").mockReturnValue(
      anchor as unknown as HTMLElement,
    );
    vi.spyOn(document.body, "appendChild").mockImplementation(
      (() => anchor) as unknown as typeof document.body.appendChild,
    );
  });

  it("appends, clicks and removes anchor on web", async () => {
    const capture = vi.fn(async () => "data:image/png;base64,abc");
    const ref = { current: {} } as React.RefObject<unknown>;
    expect(await captureAndShareImage(ref as never, "file", capture as never)).toBe(
      true,
    );
    expect(document.body.appendChild).toHaveBeenCalledWith(
      anchor as unknown as Node,
    );
    expect(anchor.href).toBe("data:image/png;base64,abc");
    expect(anchor.download).toBe("file.png");
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
  });

  it("returns false when capture yields empty", async () => {
    const capture = vi.fn(async () => "");
    const ref = { current: {} } as React.RefObject<unknown>;
    expect(await captureAndShareImage(ref as never, "file", capture as never)).toBe(
      false,
    );
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it("returns false when ref is null", async () => {
    const capture = vi.fn(async () => "data:");
    expect(
      await captureAndShareImage({ current: null } as never, "file", capture as never),
    ).toBe(false);
  });

  it("returns false when capture throws", async () => {
    const capture = vi.fn(async () => {
      throw new Error("capture failed");
    });
    const ref = { current: {} } as React.RefObject<unknown>;
    expect(await captureAndShareImage(ref as never, "file", capture as never)).toBe(
      false,
    );
  });
});

describe("captureAndShareImage — native", () => {
  beforeEach(() => {
    state.os = "ios";
    vi.clearAllMocks();
    sharing.isAvailableAsync.mockResolvedValue(true);
  });

  it("captures to a tmpfile and shares it", async () => {
    const capture = vi.fn(async () => "file:///tmp/shot.png");
    const ref = { current: {} } as React.RefObject<unknown>;
    expect(
      await captureAndShareImage(ref as never, "file", capture as never),
    ).toBe(true);
    expect(capture).toHaveBeenCalledWith(ref.current, {
      format: "png",
      result: "tmpfile",
    });
    expect(sharing.shareAsync).toHaveBeenCalledWith("file:///tmp/shot.png", {
      mimeType: "image/png",
    });
  });

  it("returns false when sharing is unavailable", async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    const capture = vi.fn(async () => "file:///tmp/shot.png");
    const ref = { current: {} } as React.RefObject<unknown>;
    expect(
      await captureAndShareImage(ref as never, "file", capture as never),
    ).toBe(false);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });
});
