// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { RadioPicker } from "@/components/settings/radio-picker";

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

describe("RadioPicker", () => {
  it("renders label and options", () => {
    render(
      <RadioPicker
        icon="clock"
        label="Check Interval"
        options={[
          { value: "manual", label: "Manual only" },
          { value: "hourly", label: "Every hour" },
        ]}
        value="manual"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Check Interval")).toBeTruthy();
    expect(screen.getByText("Manual only")).toBeTruthy();
    expect(screen.getByText("Every hour")).toBeTruthy();
  });

  it("calls onSelect when option pressed", () => {
    const onSelect = vi.fn();
    render(
      <RadioPicker
        icon="clock"
        label="Check Interval"
        options={[
          { value: "manual", label: "Manual only" },
          { value: "hourly", label: "Every hour" },
        ]}
        value="manual"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Every hour"));
    expect(onSelect).toHaveBeenCalledWith("hourly");
  });
});
