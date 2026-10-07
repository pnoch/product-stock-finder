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
    Animated: { View: ({ children, ...r }: any) => React.createElement("div", r, children) },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff" }),
}));
vi.mock("@/components/stock-badge", () => ({ StockBadge: () => null }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));

import { DetailHeader } from "../components/product/detail-header";

const product = { id: "p1", name: "CRS804", brand: "MikroTik", category: "Router", modelNumber: "CRS804-4DDQ-hRM", listings: [] } as never;

afterEach(cleanup);

describe("DetailHeader watch button", () => {
  it("shows Watch for restock when not watching and calls onToggleWatch", () => {
    const onToggleWatch = vi.fn();
    render(<DetailHeader product={product} bestDeal={null} watchingAny={false} onToggleWatch={onToggleWatch} />);
    fireEvent.click(screen.getByText(/Watch for restock/i));
    expect(onToggleWatch).toHaveBeenCalledTimes(1);
  });

  it("shows Watching when watchingAny is true", () => {
    render(<DetailHeader product={product} bestDeal={null} watchingAny={true} onToggleWatch={() => {}} />);
    expect(screen.getByText(/Watching/i)).toBeTruthy();
  });
});
