// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";

const WIDTH = 375;

vi.mock("react-native", async () => {
  const React = await import("react");
  const Touchable = ({ children, onPress, accessibilityLabel, ...r }: any) =>
    React.createElement(
      "button",
      { ...r, "aria-label": accessibilityLabel, onClick: onPress },
      children,
    );
  return {
    Platform: { OS: "ios" },
    Dimensions: { get: () => ({ width: WIDTH, height: 812 }) },
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    TextInput: (r: any) => React.createElement("input", r),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement(
        "button",
        { ...r, "aria-label": accessibilityLabel, onClick: onPress },
        children,
      ),
    TouchableOpacity: Touchable,
    ScrollView: ({ children, ...r }: any) =>
      React.createElement("div", r, children),
    Modal: ({ children, visible }: any) =>
      visible ? React.createElement("div", null, children) : null,
    Switch: ({ value, onValueChange, accessibilityLabel }: any) =>
      React.createElement(
        "button",
        {
          "aria-label": accessibilityLabel,
          "aria-checked": value ? "true" : "false",
          onClick: () => onValueChange?.(!value),
        },
        value ? "on" : "off",
      ),
    FlatList: React.forwardRef(function FlatList(
      { data, renderItem, onMomentumScrollEnd, ...r }: any,
      ref: any,
    ) {
      React.useImperativeHandle(ref, () => ({
        scrollToIndex: ({ index }: { index: number }) =>
          onMomentumScrollEnd?.({
            nativeEvent: { contentOffset: { x: index * WIDTH } },
          }),
      }));
      return React.createElement(
        "div",
        r,
        (data ?? []).map((item: any, i: number) =>
          React.createElement(
            "div",
            { key: i },
            renderItem({ item, index: i }),
          ),
        ),
      );
    }),
  };
});

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    background: "#fff",
    surface: "#fff",
    foreground: "#111",
    muted: "#888",
    border: "#ddd",
    primary: "#0F52BA",
  }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const updateSettings = vi.fn(async (_patch: unknown) => ({}));
vi.mock("@/lib/storage", () => ({
  updateSettings: (patch: unknown) => updateSettings(patch),
}));
const setOnboardingSeen = vi.fn(async () => {});
vi.mock("@/lib/onboarding", () => ({
  setOnboardingSeen: () => setOnboardingSeen(),
}));

import { OnboardingScreen } from "../components/onboarding/onboarding-screen";

beforeEach(() => {
  updateSettings.mockClear();
  setOnboardingSeen.mockClear();
});

afterEach(cleanup);

function advanceToDestination() {
  fireEvent.click(screen.getByLabelText("Next"));
  fireEvent.click(screen.getByLabelText("Next"));
  fireEvent.click(screen.getByLabelText("Get Started"));
}

describe("OnboardingScreen destination step", () => {
  it("persists country, currency and tax-exempt on Finish", async () => {
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    advanceToDestination();

    fireEvent.click(screen.getByLabelText("Choose shipping country"));
    fireEvent.click(screen.getByText("Thailand"));
    fireEvent.click(screen.getByLabelText("I'm tax-exempt"));
    fireEvent.click(screen.getByLabelText("Finish"));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings).toHaveBeenCalledWith({
      shipToCountry: "TH",
      displayCurrency: "THB",
      taxExempt: true,
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("does not write a destination on Skip", async () => {
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    advanceToDestination();

    fireEvent.click(screen.getByLabelText("Skip"));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
