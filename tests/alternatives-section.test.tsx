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
      React.createElement(
        "button",
        { ...r, "aria-label": accessibilityLabel, onClick: onPress },
        children,
      ),
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement(
        "button",
        { ...r, "aria-label": accessibilityLabel, onClick: onPress },
        children,
      ),
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    foreground: "#111",
    muted: "#888",
    primary: "#0F52BA",
    success: "#0a0",
    border: "#ddd",
    surface: "#fff",
    error: "#f00",
    warning: "#fa0",
  }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
const push = vi.fn();
vi.mock("expo-router", () => ({ useRouter: () => ({ push }) }));

import { AlternativesSection } from "../components/product/alternatives-section";

afterEach(() => {
  cleanup();
  push.mockClear();
});

const alts = [
  {
    id: "a",
    name: "CRS326",
    brand: "MikroTik",
    modelNumber: "CRS326",
    bestPrice: 209,
    bestCurrency: "USD",
    storeCount: 3,
  },
];

describe("AlternativesSection", () => {
  it("renders the category header and rows", () => {
    render(
      <AlternativesSection
        category="Networking Switch"
        alternatives={alts as any}
      />,
    );
    expect(screen.getByText(/In stock now in Networking Switch/i)).toBeTruthy();
    expect(screen.getByText(/CRS326/)).toBeTruthy();
  });
  it("navigates to an alternative on tap", () => {
    render(
      <AlternativesSection
        category="Networking Switch"
        alternatives={alts as any}
      />,
    );
    fireEvent.click(screen.getByText(/CRS326/));
    expect(push).toHaveBeenCalledWith("/product/a");
  });
  it("renders nothing when there are no alternatives", () => {
    const { container } = render(
      <AlternativesSection category="Networking Switch" alternatives={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
