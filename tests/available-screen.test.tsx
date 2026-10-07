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
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children ?? null,
}));
vi.mock("@/constants/oauth", () => ({
  isServerConfigured: () => true,
  getApiBaseUrl: () => "http://localhost:3000",
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

afterEach(cleanup);

describe("AvailableScreen", () => {
  it("renders an in-stock product with its price", () => {
    render(<AvailableScreen />);
    expect(screen.getByText(/Switch A/)).toBeTruthy();
    expect(screen.getByText(/100/)).toBeTruthy();
  });
});
