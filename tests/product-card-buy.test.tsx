// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  class AnimatedValue {
    constructor(private v: number) {}
    setValue(v: number) { this.v = v; }
    interpolate() { return new AnimatedValue(this.v); }
  }
  const anim = {
    start: (cb?: () => void) => cb?.(),
    stop: () => {},
  };
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    Animated: {
      View: ({ children, ...r }: any) => React.createElement("div", r, children),
      Text: ({ children, ...r }: any) => React.createElement("span", r, children),
      Image: (r: any) => React.createElement("img", r),
      Value: AnimatedValue,
      multiply: (a: any, b: any) => a,
      timing: () => anim,
      spring: () => anim,
    },
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", error: "#f00", warning: "#fa0" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("react-native-svg", () => ({
  default: ({ children, ...r }: any) => React.createElement("div", r, children),
  Polyline: () => null,
  Circle: () => null,
}));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
vi.mock("expo-linking", () => ({
  createURL: () => "stocktrackerpro://",
  canOpenURL: async () => true,
  openURL: async () => {},
}));
vi.mock("@/lib/server-images", () => ({
  fetchProductImage: async () => null,
}));
const openListingUrl = vi.fn(async (_u: string) => {});
vi.mock("@/lib/listing-utils", () => ({ openListingUrl: (u: string) => openListingUrl(u) }));

import { ProductCard } from "../components/watchlist/product-card";

afterEach(() => {
  cleanup();
  openListingUrl.mockClear();
});

const base = {
  onPress: () => {}, onDelete: () => {}, onTagPress: () => {},
  tagDefinitions: {}, displayCurrency: "USD",
};

const inStock = {
  id: "p1", name: "CRS804", modelNumber: "CRS804-4DDQ-hRM", brand: "MikroTik",
  category: "Networking Switch", isWatched: true, addedAt: "2026-01-01T00:00:00.000Z",
  listings: [{ distributorId: "getic-gr", productId: "p1", price: 209, currency: "USD", stockStatus: "in_stock", url: "https://getic.example/p", lastChecked: "2026-01-01T00:00:00.000Z", priceHistory: [] }],
};

describe("ProductCard buy button", () => {
  it("opens the cheapest in-stock store", () => {
    render(<ProductCard {...(base as any)} product={inStock as any} />);
    fireEvent.click(screen.getByLabelText(/buy/i));
    expect(openListingUrl).toHaveBeenCalledWith("https://getic.example/p");
  });

  it("omits the buy button when nothing is in stock", () => {
    const out = { ...inStock, listings: [{ ...inStock.listings[0], stockStatus: "out_of_stock" }] };
    render(<ProductCard {...(base as any)} product={out as any} />);
    expect(screen.queryByLabelText(/buy/i)).toBeNull();
  });
});
