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

  it("omits empty buckets and pluralizes", () => {
    const many = {
      priceDrops: [
        { productId: "a", name: "A", pct: -10, price: 90, currency: "USD" },
        { productId: "b", name: "B", pct: -20, price: 80, currency: "USD" },
      ],
      priceRises: [], restocks: [], stockOuts: [], since: Date.now(),
    };
    render(<AwaySummaryCard summary={many as any} onDismiss={() => {}} />);
    expect(screen.getByText(/2 price drops/i)).toBeTruthy();
    expect(screen.queryByText(/back in stock/i)).toBeNull();
    expect(screen.queryByText(/out of stock/i)).toBeNull();
  });

  it("renders a rises-only summary instead of a blank card", () => {
    const rises = {
      priceDrops: [],
      priceRises: [{ productId: "p9", name: "Riser", pct: 12, price: 112, currency: "USD" }],
      restocks: [], stockOuts: [], since: Date.now(),
    };
    render(<AwaySummaryCard summary={rises as any} onDismiss={() => {}} />);
    expect(screen.getByText(/1 price rise/i)).toBeTruthy();
    expect(screen.getByText(/Riser/)).toBeTruthy();
    expect(screen.getByText(/\+12%/)).toBeTruthy();
  });

  it("orders drops before restocks and expands with See all", () => {
    const big = {
      priceDrops: [{ productId: "d1", name: "DropOne", pct: -10, price: 90, currency: "USD" }],
      priceRises: [],
      restocks: [
        { productId: "r1", name: "RestockOne", distributorId: "x" },
        { productId: "r2", name: "RestockTwo", distributorId: "y" },
        { productId: "r3", name: "RestockThree", distributorId: "z" },
      ],
      stockOuts: [], since: Date.now(),
    };
    render(<AwaySummaryCard summary={big as any} onDismiss={() => {}} />);
    // Top 3 = DropOne + first two restocks; the third restock is hidden until See all.
    expect(screen.getByText(/DropOne/)).toBeTruthy();
    expect(screen.queryByText(/RestockThree/)).toBeNull();
    fireEvent.click(screen.getByText(/See all/i));
    expect(screen.getByText(/RestockThree/)).toBeTruthy();
  });
});
