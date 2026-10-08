// @vitest-environment jsdom
import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

const state = vi.hoisted(() => ({
  configured: true,
  watchlist: [] as any[],
  queryError: false,
  push: vi.fn(),
  refetch: vi.fn(),
  ensure: vi.fn(
    async (_product: unknown, _isPro: boolean) => ({ ok: true, paywall: false }),
  ),
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
  addCriterionWatch: vi.fn(async () => {}),
}));
vi.mock("@/lib/server-catalog", () => ({ fetchAvailable: vi.fn(async () => []) }));
vi.mock("@/lib/ensure-watchlist-product", () => ({
  ensureWatchlistProduct: (product: any, isPro: boolean) =>
    state.ensure(product, isPro),
}));
vi.mock("@/hooks/use-entitlements", () => ({
  useEntitlements: () => ({ tier: "free", isPro: false }),
}));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
vi.mock("@/components/paywall/paywall-screen", () => ({
  PaywallScreen: () => null,
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: state.push }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: state.queryError
      ? undefined
      : [{ id: "p1", name: "Switch A", brand: "MikroTik", category: "Networking Switch", modelNumber: "M1", bestPrice: 100, bestCurrency: "USD", bestDistributorId: "d1", storeCount: 2, fetchedAt: Date.now() }],
    isLoading: false,
    isError: state.queryError,
    refetch: state.refetch,
  }),
}));

import AvailableScreen from "../app/available";

afterEach(() => {
  cleanup();
  state.configured = true;
  state.watchlist = [];
  state.queryError = false;
  state.push.mockClear();
  state.refetch.mockClear();
  state.ensure.mockClear();
  state.ensure.mockResolvedValue({ ok: true, paywall: false });
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

  it("adds a board product before navigating to its detail", async () => {
    render(<AvailableScreen />);
    const row = screen.getByRole("button", { name: /View Switch A/ });
    await act(async () => {
      row.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // The detail screen reads the watchlist, so a server row must be added
    // before navigating or it shows "Product not found".
    expect(state.ensure).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      false,
    );
    expect(state.push).toHaveBeenCalledWith("/product/p1");
  });

  it("does not navigate when the add is blocked", async () => {
    state.ensure.mockResolvedValue({ ok: false, paywall: true });
    render(<AvailableScreen />);
    const row = screen.getByRole("button", { name: /View Switch A/ });
    await act(async () => {
      row.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(state.push).not.toHaveBeenCalled();
  });

  it("shows an error state with Retry instead of the empty state on failure", () => {
    state.queryError = true;
    render(<AvailableScreen />);
    expect(screen.getByText(/Couldn't load/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry loading available/i })).toBeTruthy();
    expect(screen.queryByText(/Nothing in stock right now/i)).toBeNull();
  });

  it("retries the query when Retry is pressed", async () => {
    state.queryError = true;
    render(<AvailableScreen />);
    const retry = screen.getByRole("button", { name: /Retry loading available/i });
    await act(async () => {
      retry.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(state.refetch).toHaveBeenCalled();
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
