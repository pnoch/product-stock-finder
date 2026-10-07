// @vitest-environment jsdom
import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

const state = vi.hoisted(() => ({
  configured: true,
  watchlist: [] as any[],
}));

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
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children ?? null,
}));
vi.mock("@/constants/oauth", () => ({
  isServerConfigured: () => state.configured,
  getApiBaseUrl: () => "http://localhost:3000",
}));
vi.mock("@/lib/storage", () => ({
  getWatchlist: vi.fn(async () => state.watchlist),
  getSettings: vi.fn(async () => ({ displayCurrency: "USD" })),
}));
vi.mock("@/lib/server-catalog", () => ({ fetchAvailable: vi.fn(async () => []) }));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [{ id: "p1", name: "Switch A", brand: "MikroTik", category: "Networking Switch", modelNumber: "M1", bestPrice: 100, bestCurrency: "USD", bestDistributorId: "d1", storeCount: 2, fetchedAt: Date.now() }],
    isLoading: false,
  }),
}));

import AvailableScreen from "../app/available";

afterEach(() => {
  cleanup();
  state.configured = true;
  state.watchlist = [];
});

function listing(stockStatus: string, price = 100) {
  return {
    distributorId: "d1",
    productId: "w1",
    price,
    currency: "USD",
    stockStatus,
    url: "https://example.com",
    lastChecked: new Date().toISOString(),
    priceHistory: [],
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("AvailableScreen", () => {
  it("renders an in-stock product with its price", () => {
    render(<AvailableScreen />);
    expect(screen.getByText(/Switch A/)).toBeTruthy();
    expect(screen.getByText(/100/)).toBeTruthy();
  });

  it("shows a freshness line for server rows", () => {
    render(<AvailableScreen />);
    expect(screen.getByText(/as of /i)).toBeTruthy();
  });

  it("renders an in-stock watchlist product in the standalone fallback", async () => {
    state.configured = false;
    state.watchlist = [
      { id: "w1", name: "Fallback Switch", listings: [listing("in_stock")] },
    ];
    render(<AvailableScreen />);
    expect(await screen.findByText(/Fallback Switch/)).toBeTruthy();
    expect(screen.getByText(/in stock at 1 store/)).toBeTruthy();
  });

  it("excludes a fallback product whose only listing is back_order", async () => {
    state.configured = false;
    state.watchlist = [
      { id: "w1", name: "Backorder Only", listings: [listing("back_order")] },
    ];
    render(<AvailableScreen />);
    await flush();
    expect(screen.queryByText(/Backorder Only/)).toBeNull();
    expect(screen.getByText(/Nothing in stock right now/i)).toBeTruthy();
  });
});
