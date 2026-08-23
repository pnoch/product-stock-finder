// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { PillPicker } from "@/components/settings/pill-picker";

vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  TouchableOpacity: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#0F52BA",
    foreground: "#000",
    muted: "#6B7280",
    border: "#E5E7EB",
  }),
}));

vi.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: () => null,
}));

afterEach(() => {
  cleanup();
});

describe("PillPicker", () => {
  it("renders label and options", () => {
    render(
      <PillPicker
        icon="dollarsign.circle.fill"
        label="Currency"
        options={["USD", "EUR", "GBP"]}
        value="USD"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Currency")).toBeTruthy();
    expect(screen.getByText("USD")).toBeTruthy();
    expect(screen.getByText("EUR")).toBeTruthy();
    expect(screen.getByText("GBP")).toBeTruthy();
  });

  it("calls onSelect when option pressed", () => {
    const onSelect = vi.fn();
    render(
      <PillPicker
        icon="dollarsign.circle.fill"
        label="Currency"
        options={["USD", "EUR"]}
        value="USD"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("EUR"));
    expect(onSelect).toHaveBeenCalledWith("EUR");
  });
});
