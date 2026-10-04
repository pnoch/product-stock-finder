// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    React.useEffect(cb, [cb]);
  },
}));

vi.mock("react-native", async () => {
  const React = await import("react");
  const stripStyle = (style: unknown) => {
    if (!style) return undefined;
    if (Array.isArray(style))
      return Object.assign({}, ...style.filter((s) => s && typeof s === "object"));
    if (typeof style === "object") return style as Record<string, unknown>;
    return undefined;
  };
  const view = ({ children, style, ...rest }: any) =>
    React.createElement("div", { ...rest, style: stripStyle(style) }, children);
  const text = ({ children, style, ...rest }: any) =>
    React.createElement("span", { ...rest, style: stripStyle(style) }, children);
  const pressable = ({
    children,
    style,
    onPress,
    accessibilityLabel,
    accessibilityRole,
    disabled,
    activeOpacity: _activeOpacity,
    ...rest
  }: any) =>
    React.createElement(
      "button",
      {
        ...rest,
        role: accessibilityRole === "button" ? "button" : undefined,
        "aria-label": accessibilityLabel,
        disabled,
        onClick: onPress,
        style: stripStyle(style),
      },
      children,
    );
  return {
    View: view,
    Text: text,
    TouchableOpacity: pressable,
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    surface: "#FFFFFF",
    foreground: "#0A0E1A",
    muted: "#64748B",
    border: "#E2E8F0",
    primary: "#0F52BA",
    success: "#00C896",
  }),
}));

import { DropCalendarCard } from "@/components/stats/drop-calendar-card";
import { dateKey } from "@/lib/drop-calendar";
import type { DropCalendarResult } from "@/lib/drop-calendar";

const NOW = new Date(2026, 0, 15, 12, 0, 0).getTime();
const KEY = dateKey(NOW);
const DROP_LABEL = `Price drops on ${new Date(NOW).toLocaleDateString()}`;

function makeResult(): DropCalendarResult {
  return {
    totalDrops: 1,
    byDay: new Map([
      [
        KEY,
        {
          dateKey: KEY,
          dropCount: 1,
          biggestPct: 16.7,
          drops: [
            {
              productId: "p1",
              distributorId: "d1",
              name: "Widget",
              from: 120,
              to: 100,
              percent: 16.7,
            },
          ],
        },
      ],
    ]),
  };
}

describe("DropCalendarCard", () => {
  afterEach(() => cleanup());

  it("renders the summary and a selectable day", () => {
    const { container } = render(
      <DropCalendarCard result={makeResult()} days={30} displayCurrency="USD" now={NOW} />,
    );
    expect(screen.getByText(/1 price drops in the last 30 days/)).toBeTruthy();
    // A day with drops is an interactive, labelled button.
    const day = screen.getByLabelText(DROP_LABEL);
    expect(day.getAttribute("role")).toBe("button");
    expect((day as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(day);
    expect(screen.getByText(`Drops on ${KEY}`)).toBeTruthy();
    expect(screen.getByText("Widget")).toBeTruthy();
    expect(container.textContent).toContain("17%");
    expect(container.textContent).toContain("120");
    expect(container.textContent).toContain("100");
  });

  it("toggles the selected day off on a second tap", () => {
    render(
      <DropCalendarCard result={makeResult()} days={30} displayCurrency="USD" now={NOW} />,
    );
    fireEvent.click(screen.getByLabelText(DROP_LABEL));
    expect(screen.getByText(`Drops on ${KEY}`)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(DROP_LABEL));
    expect(screen.queryByText(`Drops on ${KEY}`)).toBeNull();
  });

  it("renders no-drop days as disabled, non-interactive cells", () => {
    render(
      <DropCalendarCard result={makeResult()} days={30} displayCurrency="USD" now={NOW} />,
    );
    const empty = screen.getAllByLabelText(/no price drops/);
    expect(empty.length).toBeGreaterThan(0);
    expect((empty[0] as HTMLButtonElement).disabled).toBe(true);
    expect(empty[0].getAttribute("role")).not.toBe("button");
  });
});
