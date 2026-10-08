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
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", error: "#f00", warning: "#fa0" }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
const push = vi.fn();
vi.mock("expo-router", () => ({ useRouter: () => ({ push }) }));

import { AwaySummaryCard } from "../components/home/away-summary-card";

afterEach(() => { cleanup(); push.mockClear(); });

const summary = {
  priceDrops: [{ productId: "p1", name: "CRS804", pct: -10, price: 90, currency: "USD" }],
  priceRises: [], restocks: [{ productId: "p2", name: "Pi 5", distributorId: "d1" }],
  stockOuts: [], since: Date.now() - 86400000,
};

describe("AwaySummaryCard", () => {
  it("renders the counts", () => {
    render(<AwaySummaryCard summary={summary as any} onDismiss={() => {}} />);
    expect(screen.getByText(/While you were away/i)).toBeTruthy();
    expect(screen.getByText(/1 price drop/i)).toBeTruthy();
    expect(screen.getByText(/1 back in stock/i)).toBeTruthy();
  });

  it("navigates to a product on tap", () => {
    render(<AwaySummaryCard summary={summary as any} onDismiss={() => {}} />);
    fireEvent.click(screen.getByText(/CRS804/));
    expect(push).toHaveBeenCalledWith("/product/p1");
  });

  it("calls onDismiss", () => {
    const onDismiss = vi.fn();
    render(<AwaySummaryCard summary={summary as any} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText(/dismiss/i));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
