// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA", error: "#EF4444", success: "#00C896", warning: "#F59E0B" }),
}));
vi.mock("@/components/session-assist-modal", () => ({ SessionAssistModal: () => null }));

const getUnlocked = vi.fn(async () => ({ "pbtech-nz": "t" }));
const clearDistributorSession = vi.fn(async (_parser: unknown) => {});
const clearSiteData = vi.fn(async () => {});
vi.mock("@/lib/scrapers/session-store", () => ({ getUnlocked: () => getUnlocked() }));
vi.mock("@/lib/scrapers/session-assist", () => ({
  clearDistributorSession: (a: unknown) => clearDistributorSession(a),
  clearSiteData: () => clearSiteData(),
  isAssistCandidate: (s?: string | null, r?: string | null) =>
    s === "blocked" || (s === "error" && !!r && /no price found/i.test(r)),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("@/lib/scrapers/health", () => ({
  createHealthService: () => ({
    getDistributorHealth: async () => [
      { distributorId: "pbtech-nz", status: "working", lastChecked: "2026-01-01T00:00:00.000Z" },
      { distributorId: "winncom-us", status: "blocked", reason: "blocked by site", lastChecked: "2026-01-01T00:00:00.000Z" },
    ],
  }),
}));

import { SiteSessionsSection } from "@/components/settings/site-sessions-section";

describe("SiteSessionsSection", () => {
  afterEach(() => cleanup());

  it("lists relevant distributors with session hints and clears one", async () => {
    render(<SiteSessionsSection />);
    await waitFor(() => expect(screen.getByText(/PB Tech/)).toBeTruthy());
    expect(screen.getByText(/Active/)).toBeTruthy();
    expect(screen.getByText(/Winncom/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Clear PB Tech"));
    await waitFor(() => expect(clearDistributorSession).toHaveBeenCalledTimes(1));
  });

  it("toggles show-all and clears everything", async () => {
    render(<SiteSessionsSection />);
    await waitFor(() => expect(screen.getByLabelText("Show all distributors")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Show all distributors"));
    fireEvent.click(screen.getByLabelText("Clear all sessions"));
    expect(clearSiteData).toHaveBeenCalledTimes(1);
  });
});
