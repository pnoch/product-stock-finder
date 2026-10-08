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
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
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
vi.mock("expo-router", () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/sourcing/sourcing-sheet", () => ({ SourcingSheet: () => null }));

const defaultWatchlist = [
  { id: "p1", name: "P1", quantity: 20, targetSellPrice: 280, sellCurrency: "USD", listings: [{ distributorId: "balticnetworks-us", productId: "p1", price: 200, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] }] },
];
const state: { shipToCountry: string | null; watchlist: unknown[] } = {
  shipToCountry: "TH",
  watchlist: defaultWatchlist,
};
vi.mock("@/lib/storage", () => ({
  getWatchlist: async () => state.watchlist,
  getSettings: async () => ({ displayCurrency: "USD", shipToCountry: state.shipToCountry }),
}));

import SourcingScreen from "../app/sourcing";

afterEach(() => {
  cleanup();
  state.shipToCountry = "TH";
  state.watchlist = defaultWatchlist;
});

describe("SourcingScreen", () => {
  it("renders a product line with its quantity", async () => {
    render(<SourcingScreen />);
    expect(await screen.findByText(/P1/)).toBeTruthy();
    expect(screen.getByText(/20/)).toBeTruthy();
  });

  it("prompts to set a destination when shipToCountry is unset", async () => {
    state.shipToCountry = null;
    render(<SourcingScreen />);
    expect(await screen.findByText(/Set where you ship to/i)).toBeTruthy();
    expect(screen.queryByText(/Total margin/i)).toBeNull();
  });

  it("shows — for a line with no sell price", async () => {
    state.watchlist = [
      { id: "p1", name: "P1", listings: [{ distributorId: "balticnetworks-us", productId: "p1", price: 200, currency: "USD", stockStatus: "in_stock", url: "", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] }] },
    ];
    render(<SourcingScreen />);
    expect(await screen.findByText(/P1/)).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
