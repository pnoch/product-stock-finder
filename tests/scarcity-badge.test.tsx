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
  useColors: () => ({ error: "#f00", warning: "#fa0", success: "#0a0" }),
}));

import { ScarcityBadge } from "../components/watchlist/scarcity-badge";

afterEach(cleanup);

describe("ScarcityBadge", () => {
  it("renders each label", () => {
    render(<ScarcityBadge scarcity="rare" />);
    expect(screen.getByText(/Rare/)).toBeTruthy();
    cleanup();
    render(<ScarcityBadge scarcity="occasional" />);
    expect(screen.getByText(/Occasional/)).toBeTruthy();
    cleanup();
    render(<ScarcityBadge scarcity="common" />);
    expect(screen.getByText(/Usually available/)).toBeTruthy();
  });
});
