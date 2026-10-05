// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  const strip = (s: unknown): unknown => (typeof s === "function" ? strip((s as any)({ pressed: false })) : s);
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA", error: "#EF4444" }),
}));
const clearSiteData = vi.fn(async () => {});
vi.mock("@/lib/scrapers/session-assist", () => ({ clearSiteData: () => clearSiteData() }));

import { SiteSessionsSection } from "@/components/settings/site-sessions-section";

describe("SiteSessionsSection", () => {
  afterEach(() => cleanup());
  it("explains on-device sessions and clears them", () => {
    render(<SiteSessionsSection />);
    expect(screen.getByText(/stored only on this device/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Clear site sessions"));
    expect(clearSiteData).toHaveBeenCalledTimes(1);
  });
});
