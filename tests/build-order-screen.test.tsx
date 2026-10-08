// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", warning: "#fa0", error: "#f00" }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("@/components/screen-container", () => ({ ScreenContainer: ({ children }: any) => React.createElement("div", null, children) }));
vi.mock("expo-router", () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: vi.fn() }) }));

const state: { shipToCountry: string | null } = { shipToCountry: "TH" };
vi.mock("@/lib/storage", () => ({
  getWatchlist: async () => [
    { id: "p1", name: "P1", listings: [{ distributorId: "balticnetworks-us", productId: "p1", price: 100, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] }] },
  ],
  getSettings: async () => ({ displayCurrency: "USD", shipToCountry: state.shipToCountry }),
}));

import BuildOrderScreen from "../app/build-order";

afterEach(() => {
  cleanup();
  state.shipToCountry = "TH";
});

describe("BuildOrderScreen", () => {
  it("renders the cheapest-single and split cards for a destination", async () => {
    render(<BuildOrderScreen />);
    expect(await screen.findByText(/Cheapest single order/i)).toBeTruthy();
    expect(screen.getByText(/Cheapest split/i)).toBeTruthy();
  });

  it("prompts to set a destination when shipToCountry is unset", async () => {
    state.shipToCountry = null;
    render(<BuildOrderScreen />);
    expect(await screen.findByText(/Set where you ship to/i)).toBeTruthy();
    expect(screen.queryByText(/Cheapest single order/i)).toBeNull();
  });
});
