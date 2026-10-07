// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", success: "#0a0", warning: "#fa0", error: "#f00" }),
}));

import { AvailabilityCard } from "../components/product/availability-card";

afterEach(cleanup);

describe("AvailabilityCard", () => {
  it("renders the scarcity label and rate", () => {
    render(
      <AvailabilityCard
        data={{ inStockRate: 0.12, lastInStockAt: Date.now() - 8 * 86400000, longestOutageDays: 30, typicalRestockDays: 21, sampleDays: 90, scarcity: "rare" }}
      />,
    );
    expect(screen.getByText(/Rare/i)).toBeTruthy();
    expect(screen.getByText(/12%/)).toBeTruthy();
  });

  it("omits the cadence clause when there is none", () => {
    render(
      <AvailabilityCard
        data={{ inStockRate: 0.5, lastInStockAt: null, longestOutageDays: 0, typicalRestockDays: null, sampleDays: 10, scarcity: "common" }}
      />,
    );
    expect(screen.queryByText(/restocks/i)).toBeNull();
  });

  it("renders the last-seen clause when available", () => {
    render(
      <AvailabilityCard
        data={{ inStockRate: 0.12, lastInStockAt: Date.now() - 8 * 86400000, longestOutageDays: 30, typicalRestockDays: 21, sampleDays: 90, scarcity: "rare" }}
      />,
    );
    expect(screen.getByText(/Last seen/i)).toBeTruthy();
    expect(screen.getByText(/8 days ago/)).toBeTruthy();
  });

  it("maps common to Usually available", () => {
    render(
      <AvailabilityCard
        data={{ inStockRate: 0.8, lastInStockAt: Date.now(), longestOutageDays: 0, typicalRestockDays: null, sampleDays: 30, scarcity: "common" }}
      />,
    );
    expect(screen.getByText(/Usually available/i)).toBeTruthy();
  });
});
