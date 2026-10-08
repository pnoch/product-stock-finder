// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
    Switch: (r: any) => React.createElement("div", r),
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    Modal: ({ children, ...r }: any) => React.createElement("div", r, children),
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", warning: "#fa0", error: "#f00" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("@/components/ui/country-picker", () => ({ CountryPicker: () => null }));
vi.mock("@/components/best-distributor-card", () => ({ BestDistributorCard: () => null }));
const highlightedProps: boolean[] = [];
vi.mock("@/components/product/distributor-listing-card", () => ({
  DistributorListingCard: (props: { highlighted?: boolean }) => {
    highlightedProps.push(props.highlighted ?? false);
    return null;
  },
}));
vi.mock("react-native-svg", () => ({
  default: ({ children, ...r }: any) => React.createElement("div", r, children),
  Polyline: () => null,
  Circle: () => null,
}));
vi.mock("expo-haptics", () => ({ impactAsync: vi.fn(), notificationAsync: vi.fn(), ImpactFeedbackStyle: { Light: "light" }, NotificationFeedbackType: { Success: "success", Error: "error" } }));

import { DistributorListingSection } from "../components/product/distributor-listing-section";

const baseProps = {
  sortedListings: [], visibleListings: [], bestInStockListing: null,
  product: { id: "p1", name: "CRS804", listings: [] },
  insight: null, insightLoading: false, regionFilter: "All", regions: [],
  shippingRegion: "Asia-Pacific", bestDeal: null, stockWatches: {}, id: "p1",
  displayCurrency: "USD", destination: null, taxExempt: false, includeImportEstimate: false,
  onSelectCountry: () => {}, onToggleTaxExempt: () => {}, onToggleImportEstimate: () => {},
  onSetRegionFilter: () => {}, onSetBestAlert: () => {}, onToggleStockWatch: () => {},
  onOpenChart: () => {},
} as never;

afterEach(() => {
  cleanup();
  highlightedProps.length = 0;
});

describe("listing empty state", () => {
  it("renders Watch anyway and calls onWatchAny", () => {
    const onWatchAny = vi.fn();
    render(<DistributorListingSection {...(baseProps as any)} onWatchAny={onWatchAny} watchingAny={false} />);
    fireEvent.click(screen.getByText(/Watch anyway/i));
    expect(onWatchAny).toHaveBeenCalledTimes(1);
  });

  it("omits Watch anyway when onWatchAny is not provided", () => {
    render(<DistributorListingSection {...(baseProps as any)} />);
    expect(screen.queryByText(/Watch anyway/i)).toBeNull();
  });
});

describe("DistributorListingSection highlight", () => {
  const listing = {
    distributorId: "getic-gr",
    productId: "p1",
    price: 209,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://getic.example/p",
    lastChecked: "2026-01-01T00:00:00.000Z",
    priceHistory: [],
  };
  const listedProps = {
    ...(baseProps as any),
    sortedListings: [listing],
    visibleListings: [listing],
    bestInStockListing: listing,
    product: { id: "p1", name: "CRS804", listings: [listing] },
  };

  it("highlights the listing matching highlightDistributorId", () => {
    render(
      <DistributorListingSection
        {...(listedProps as any)}
        highlightDistributorId="getic-gr"
      />,
    );
    expect(highlightedProps).toEqual([true]);
  });

  it("highlights nothing when highlightDistributorId is absent", () => {
    render(<DistributorListingSection {...(listedProps as any)} />);
    expect(highlightedProps).toEqual([false]);
  });
});
