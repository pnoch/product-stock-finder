// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";

const setKeywordSpy = vi.hoisted(() => vi.fn());
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactGlobal = vi.hoisted(() => require("react"));

vi.mock("react-native", async () => {
  const React = await import("react");
  const strip = (s: unknown): unknown => (typeof s === "function" ? strip((s as any)({ pressed: false })) : s);
  const textInput = (props: any) => {
    if (props.accessibilityLabel === "Search keyword") setKeywordSpy(props.value);
    return React.createElement("input", {
      ...props,
      value: props.value ?? "",
      onChange: (e: { target: { value: string } }) => props.onChangeText?.(e.target.value),
    });
  };
  return {
    Platform: { OS: "ios", select: (o: any) => o.ios },
    Keyboard: { dismiss: vi.fn() },
    ActivityIndicator: () => React.createElement("div"),
    FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: any) => {
      const asNode = (v: any) => {
        if (v == null || v === false) return null;
        if (typeof v === "function") return React.createElement(v);
        if (React.isValidElement(v)) return v;
        return null;
      };
      return React.createElement(
        "div",
        null,
        asNode(ListHeaderComponent),
        (data ?? []).map((item: unknown, i: number) => React.createElement(React.Fragment, { key: i }, renderItem({ item, index: i }))),
        asNode(ListEmptyComponent),
        asNode(ListFooterComponent),
      );
    },
    Modal: ({ children, visible }: any) => (visible ? React.createElement("div", null, children) : null),
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
    TextInput: textInput,
  };
});
vi.mock("react-native-webview", () => ({ WebView: () => React.createElement("div") }));
vi.mock("expo-haptics", () => ({ impactAsync: vi.fn(), notificationAsync: vi.fn(), ImpactFeedbackStyle: { Light: "light" }, NotificationFeedbackType: { Success: "success" } }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => React.createElement("div", null, children),
}));
vi.mock("expo-linking", () => ({ openURL: vi.fn(async () => {}) }));
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("@/components/screen-container", () => ({ ScreenContainer: ({ children }: any) => React.createElement("div", null, children) }));
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    background: "#fff", surface: "#fff", foreground: "#111", muted: "#888",
    border: "#ddd", primary: "#0F52BA", success: "#0a0", warning: "#F59E0B", error: "#f00", card: "#fff", tint: "#0F52BA",
  }),
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useLocalSearchParams: () => ({}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@/hooks/use-entitlements", () => ({ useEntitlements: () => ({ isPro: false }) }));
vi.mock("@/hooks/use-search-data", () => ({
  useSearchData: () => ({
    watchlist: [], trackedIds: new Set(), tagDefinitions: {},
    selectedTagIds: [], setSelectedTagIds: vi.fn(), tagMatchMode: "any", setTagMatchMode: vi.fn(), loadData: vi.fn(),
  }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/alert", () => ({ showAlert: vi.fn() }));
vi.mock("@/lib/navigation", () => ({ goBackOrHome: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  getRecentSearches: async () => [],
  recordSearch: async (q: string) => [q],
  clearRecentSearches: async () => {},
  getWatchlist: async () => [],
  getSettings: async () => ({}),
  addToWatchlist: async () => true,
  getDiscoveredProducts: async () => [],
  updateProductListings: async () => {},
}));
vi.mock("@/lib/search-preview", () => ({ searchCatalog: () => [], sortPreviewByStock: (p: unknown[]) => p, PREVIEW_LIMIT: 8 }));
vi.mock("@/lib/watchlist-org", () => ({
  countTagMatches: () => ({}),
  filterWatchlist: () => [],
}));
vi.mock("@/components/search/catalog-search-bar", () => ({
  CatalogSearchBar: ({ query, onQueryChange, onSearchSubmit }: any) => {
    const React = ReactGlobal;
    return React.createElement("input", {
      "aria-label": "Catalog search",
      value: query,
      onChange: (e: { target: { value: string } }) => onQueryChange(e.target.value),
      onKeyDown: (e: { key: string }) => { if (e.key === "Enter") onSearchSubmit(); },
    });
  },
}));
vi.mock("@/components/home/trending-section", () => ({ TrendingSection: () => React.createElement("div", null, "TRENDING_SECTION") }));
vi.mock("@/components/home/available-section", () => ({ AvailableSection: () => React.createElement("div", null, "AVAILABLE_SECTION") }));
vi.mock("@/components/marketplace/facebook-search-sheet", () => ({
  FacebookSearchSheet: ({ visible, initialQuery }: any) => {
    setKeywordSpy(visible ? initialQuery : "HIDDEN");
    return React.createElement("div", { "data-visible": String(visible) }, `FB_SHEET:${initialQuery}`);
  },
}));
vi.mock("@/components/search/facebook-results-section", () => ({
  FacebookResultsSection: ({ query }: any) => React.createElement("div", null, `FB_RESULTS:${query}`),
}));
vi.mock("@/components/search/catalog-product-card", () => ({
  CatalogProductCard: ({ product }: any) => React.createElement("div", null, product.name),
}));
vi.mock("@/components/search/recent-searches", () => ({ RecentSearches: () => React.createElement("div") }));
vi.mock("@/components/search/search-empty-state", () => ({ SearchEmptyState: () => React.createElement("div", null, "EMPTY_STATE") }));
vi.mock("@/components/tag-filter-row", () => ({ TagFilterRow: () => React.createElement("div") }));
vi.mock("@/components/tag-picker-sheet", () => ({ TagPickerSheet: () => React.createElement("div") }));
vi.mock("@/components/search/bulk-import-modal", () => ({ BulkImportModal: () => React.createElement("div") }));
vi.mock("@/components/search/manual-add-sheet", () => ({ ManualAddSheet: ({ initialText }: any) => React.createElement("div", null, `MANUAL_SHEET:${initialText}`) }));
vi.mock("@/components/paywall/paywall-screen", () => ({ PaywallScreen: () => React.createElement("div") }));
vi.mock("@shared/catalog", () => ({
  PRODUCT_CATALOG: [],
  searchCatalog: () => [],
  getAllCategories: () => [],
  getAllBrands: () => [],
  SEARCH_OPTIONS: {},
  sortCatalogByPrice: (p: unknown[]) => p,
}));
vi.mock("@/lib/discover", () => ({ discoverProduct: vi.fn() }));
vi.mock("@/lib/manual-add", () => ({ manualAddProduct: vi.fn(), DISCOVER_TIMEOUT_MS: 1000 }));
vi.mock("@/lib/server-product-parse", () => ({ fetchParsedProduct: vi.fn() }));
vi.mock("@/lib/server-marketplace", () => ({ fetchMarketplaceResolution: vi.fn() }));
vi.mock("@/lib/marketplace", () => ({ buildMarketplaceProduct: vi.fn(), parseManualPrice: () => 1, isMarketplaceKey: () => false }));
vi.mock("@/shared/marketplace-url", () => ({
  isFacebookInput: () => false, isLazadaInput: () => false, isShopeeInput: () => false, isMarketplaceInput: () => false,
}));
vi.mock("@/lib/entitlements", () => ({ shouldEnforceFreeLimits: () => false, track: vi.fn() }));
vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("@/lib/recent-searches", () => ({
  getRecentSearches: async () => [],
  recordSearch: async (q: string) => [q],
  clearRecentSearches: async () => {},
}));

import DiscoverScreen from "@/app/(tabs)/discover";

describe("Discover search integration", () => {
  beforeEach(() => {
    setKeywordSpy.mockClear();
  });
  afterEach(() => cleanup());

  it("typing a query shows facebook results and hides browse sections", async () => {
    render(<DiscoverScreen />);
    const input = screen.getByLabelText("Catalog search");
    fireEvent.change(input, { target: { value: "rtx5090" } });

    await waitFor(() => {
      expect(screen.getByText("FB_RESULTS:rtx5090")).toBeTruthy();
    });
    expect(screen.queryByText("TRENDING_SECTION")).toBeNull();
    expect(screen.queryByText("AVAILABLE_SECTION")).toBeNull();
  });

  it("passes the query into the facebook sheet when opened", async () => {
    render(<DiscoverScreen />);
    const input = screen.getByLabelText("Catalog search");
    fireEvent.change(input, { target: { value: "rtx5090" } });

    fireEvent.click(screen.getByLabelText("Search Facebook Marketplace"));
    await waitFor(() => {
      expect(screen.getByText("FB_SHEET:rtx5090")).toBeTruthy();
    });
  });

  it("shows browse sections only when the query is empty", () => {
    render(<DiscoverScreen />);
    expect(screen.getByText("TRENDING_SECTION")).toBeTruthy();
    expect(screen.getByText("AVAILABLE_SECTION")).toBeTruthy();
  });
});