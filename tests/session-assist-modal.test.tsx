// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

const wv = vi.hoisted(() => ({ current: null as any }));
vi.mock("react-native-webview", () => ({
  WebView: (props: Record<string, unknown>) => {
    wv.current = props;
    return React.createElement("div");
  },
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  const strip = (s: unknown): unknown => (typeof s === "function" ? strip((s as any)({ pressed: false })) : s);
  return {
    Modal: ({ children, visible }: any) => (visible ? React.createElement("div", null, children) : null),
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA" }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { SessionAssistModal } from "@/components/session-assist-modal";
const parser = {
  id: "pbtech-nz",
  baseUrl: "https://www.pbtech.co.nz",
  buildSearchUrl: (m: string) => `https://www.pbtech.co.nz/search?sf=${m}`,
} as never;

describe("SessionAssistModal", () => {
  afterEach(() => cleanup());

  it("renders the distributor site and fires Done/Close", () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    render(<SessionAssistModal visible parser={parser} title="PB Tech" onDone={onDone} onClose={onClose} />);
    expect(wv.current.source.uri).toBe("https://www.pbtech.co.nz");
    fireEvent.click(screen.getByLabelText("Done"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks non-web navigations", () => {
    render(<SessionAssistModal visible parser={parser} title="PB Tech" onDone={() => {}} onClose={() => {}} />);
    const shouldLoad = wv.current.onShouldStartLoadWithRequest;
    expect(shouldLoad({ url: "https://www.pbtech.co.nz/x" })).toBe(true);
    expect(shouldLoad({ url: "intent://scan" })).toBe(false);
  });
});
