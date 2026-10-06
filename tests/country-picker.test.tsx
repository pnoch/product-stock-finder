// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    TextInput: (r: any) => React.createElement("input", r),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    ScrollView: ({ children, ...r }: any) => React.createElement("div", r, children),
    Modal: ({ children, visible }: any) => (visible ? React.createElement("div", null, children) : null),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA" }),
}));
vi.mock("expo-haptics", () => ({ impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: "light" } }));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));

import { CountryPicker } from "../components/ui/country-picker";

afterEach(cleanup);

describe("CountryPicker", () => {
  it("filters the list by the search query", () => {
    render(<CountryPicker visible value={undefined} onSelect={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "thai" } });
    expect(screen.getByText(/Thailand/)).toBeTruthy();
    expect(screen.queryByText(/Germany/)).toBeNull();
  });

  it("calls onSelect with the country code", () => {
    const onSelect = vi.fn();
    render(<CountryPicker visible value={undefined} onSelect={onSelect} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/Thailand/));
    expect(onSelect).toHaveBeenCalledWith("TH");
  });
});
