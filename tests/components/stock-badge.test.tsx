// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { StockBadge } from "@/components/stock-badge";

vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    success: "#00C896",
    warning: "#F59E0B",
    error: "#EF4444",
    muted: "#6B7280",
  }),
}));

afterEach(() => {
  cleanup();
});

describe("StockBadge", () => {
  it("renders In Stock", () => {
    render(<StockBadge status="in_stock" />);
    expect(screen.getByText(/In Stock/)).toBeTruthy();
  });

  it("renders Back Order", () => {
    render(<StockBadge status="back_order" />);
    expect(screen.getByText(/Back Order/)).toBeTruthy();
  });

  it("renders Back Order with expected date", () => {
    render(<StockBadge status="back_order" expectedDate="2026-09-01" />);
    expect(screen.getByText(/Back Order · 2026-09-01/)).toBeTruthy();
  });

  it("renders Out of Stock", () => {
    render(<StockBadge status="out_of_stock" />);
    expect(screen.getByText(/Out of Stock/)).toBeTruthy();
  });

  it("renders Unknown for unknown status", () => {
    render(<StockBadge status="whatever" />);
    expect(screen.getByText(/Unknown/)).toBeTruthy();
  });
});
