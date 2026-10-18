// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    foreground: "#111",
    muted: "#888",
    primary: "#00f",
    success: "#0a0",
    error: "#f00",
    surface: "#fff",
    border: "#ddd",
  }),
}));
vi.mock("react-native-svg", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => null,
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => (
      <div style={typeof style === "object" ? (style as React.CSSProperties) : undefined}>{children}</div>
    ),
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  };
});

import { FxSparklineCard } from "../components/rates/fx-sparkline-card";

afterEach(cleanup);

describe("FxSparklineCard", () => {
  it("shows the change when a window has two or more valid points", () => {
    render(<FxSparklineCard currency="EUR" rate={0.9} change={4.76} history={[0.86, 0.9]} />);
    expect(screen.getByText("+4.76%")).toBeTruthy();
  });

  it("says 'No history' instead of a fabricated 0.00% when the window has fewer than two valid points", () => {
    render(<FxSparklineCard currency="EUR" rate={0.92} change={null} history={[0.92]} />);
    expect(screen.getByText("No history")).toBeTruthy();
    expect(screen.queryByText("0.00%")).toBeNull();
  });

  it("keeps the per-USD basis visible on every card", () => {
    render(<FxSparklineCard currency="EUR" rate={0.92} change={null} history={[0.92]} />);
    expect(screen.getByText("per 1 USD")).toBeTruthy();
  });
});