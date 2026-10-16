// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    foreground: "#111",
    muted: "#888",
    primary: "#00f",
    border: "#ddd",
    surface: "#fff",
    success: "#0a0",
    warning: "#fa0",
    error: "#f00",
  }),
}));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios ?? o.default },
    useWindowDimensions: () => ({ width: 411, height: 900 }),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    TouchableOpacity: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  };
});

import { DropCalendarCard } from "../components/stats/drop-calendar-card";
import { InsightsCard } from "../components/stats/insights-card";
import type { ProductInsightsResult } from "../lib/product-insights";

afterEach(cleanup);

describe("Stats cards", () => {
  it("lays the drop calendar out in 7 columns to match the weekday header", () => {
    const now = new Date(2026, 9, 16).getTime();
    render(
      <DropCalendarCard
        result={{ totalDrops: 0, byDay: new Map(), days: [] } as never}
        days={30}
        displayCurrency="USD"
        now={now}
      />,
    );
    const firstRow = screen.getByTestId("drop-cal-row-0");
    expect(firstRow.children.length).toBe(7);
  });

  it("notes how many more products are at an all-time low than are listed", () => {
    const result: ProductInsightsResult = {
      products: [
        { productId: "p1", name: "A", atAllTimeLow: true, dropStreak: 0, volatility: null },
        { productId: "p2", name: "B", atAllTimeLow: true, dropStreak: 0, volatility: null },
        { productId: "p3", name: "C", atAllTimeLow: true, dropStreak: 0, volatility: null },
        { productId: "p4", name: "D", atAllTimeLow: true, dropStreak: 0, volatility: null },
      ],
      allTimeLows: 4,
      droppingCount: 0,
      volatility: { low: 0, medium: 0, high: 0 },
    };
    render(<InsightsCard result={result} />);
    expect(screen.getByText("+1 more at all-time low")).toBeTruthy();
  });
});
