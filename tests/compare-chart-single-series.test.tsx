// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#00f", border: "#ddd", surface: "#fff" }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => <span /> }));
vi.mock("@/components/compare/multi-line-chart", () => ({
  MultiLineChart: () => <div data-testid="chart" />,
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios ?? o.default },
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    TouchableOpacity: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  };
});

import { ChartCard } from "../components/compare/chart-card";

const series = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    label: `D${i}`,
    color: "#000",
    data: [
      { date: "2026-01-01T00:00:00.000Z", price: 100, currency: "USD", stockStatus: "in_stock" as const },
      { date: "2026-02-01T00:00:00.000Z", price: 90, currency: "USD", stockStatus: "in_stock" as const },
    ],
    currency: "USD",
  }));

afterEach(cleanup);

describe("Compare ChartCard", () => {
  it("renders the chart for a single selected distributor", () => {
    render(
      <ChartCard
        timeRange="3M"
        onRangeChange={() => {}}
        chartSeries={series(1)}
        chartWidth={320}
      />,
    );
    expect(screen.getByTestId("chart")).toBeTruthy();
    expect(screen.getByText(/Add another distributor to compare/)).toBeTruthy();
  });

  it("shows the empty state when nothing is selected", () => {
    render(
      <ChartCard
        timeRange="3M"
        onRangeChange={() => {}}
        chartSeries={[]}
        chartWidth={320}
      />,
    );
    expect(screen.queryByTestId("chart")).toBeNull();
    expect(screen.getByText(/Select a distributor with price history/)).toBeTruthy();
  });
});
