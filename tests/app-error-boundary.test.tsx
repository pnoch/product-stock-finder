// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

const platform = vi.hoisted(() => ({ os: "ios" as string }));
const routerReplace = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({ router: { replace: routerReplace } }));
vi.mock("react-native", async () => {
  const React = await import("react");
  const stripStyle = (style: unknown) => {
    if (!style) return undefined;
    if (typeof style === "function") {
      // Exercise both press states so the `pressed ? ... : ...` ternaries in the
      // Pressable style callbacks are covered.
      stripStyle((style as (s: unknown) => unknown)({ pressed: false }));
      return stripStyle((style as (s: unknown) => unknown)({ pressed: true }));
    }
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
    ...rest
  }: any) =>
    React.createElement(
      "button",
      {
        ...rest,
        role: accessibilityRole === "button" ? "button" : undefined,
        "aria-label": accessibilityLabel,
        onClick: onPress,
        style: stripStyle(style),
      },
      children,
    );
  return {
    View: view,
    Text: text,
    TouchableOpacity: pressable,
    Pressable: pressable,
    Platform: {
      get OS() {
        return platform.os;
      },
      select: (obj: any) => obj[platform.os] ?? obj.default,
    },
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { setItem: vi.fn(async () => {}), getItem: vi.fn(async () => null) },
}));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "Light" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    background: "#F8FAFC",
    surface: "#FFFFFF",
    foreground: "#0A0E1A",
    muted: "#64748B",
    border: "#E2E8F0",
    primary: "#0F52BA",
    error: "#EF4444",
  }),
}));

import * as Haptics from "expo-haptics";
import { AppErrorBoundary } from "@/components/app-error-boundary";

function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message);
}

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error("boom");
  return <span>Recovered</span>;
}

function withSegmenter(value: unknown, fn: () => void) {
  const desc = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
  Object.defineProperty(Intl, "Segmenter", { configurable: true, writable: true, value });
  try {
    fn();
  } finally {
    if (desc) Object.defineProperty(Intl, "Segmenter", desc);
    else delete (Intl as { Segmenter?: unknown }).Segmenter;
  }
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    platform.os = "ios";
    shouldThrow = true;
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("renders the fallback with the error message on throw", () => {
    render(
      <AppErrorBoundary>
        <Boom message="kaboom" />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("kaboom")).toBeTruthy();
  });

  it("omits the detail line when the error has no message", () => {
    render(
      <AppErrorBoundary>
        <Boom message="" />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.queryByText("kaboom")).toBeNull();
  });

  it("retries and re-renders the children", () => {
    render(
      <AppErrorBoundary>
        <Flaky />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByLabelText("Try Again"));
    expect(screen.getByText("Recovered")).toBeTruthy();
  });

  it("goes home with haptics on native", () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    fireEvent.click(screen.getByLabelText("Go Home"));
    expect(routerReplace).toHaveBeenCalledWith("/(tabs)");
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });

  it("skips haptics on web", () => {
    platform.os = "web";
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    fireEvent.click(screen.getByLabelText("Go Home"));
    expect(routerReplace).toHaveBeenCalledWith("/(tabs)");
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  describe("getDerivedStateFromError", () => {
    it("truncates a long message to 160 characters", () => {
      const next = AppErrorBoundary.getDerivedStateFromError(new Error("x".repeat(500)));
      expect(next.hasError).toBe(true);
      expect(next.message).toHaveLength(160);
    });

    it("handles a thrown value with no message", () => {
      expect(AppErrorBoundary.getDerivedStateFromError({} as Error).message).toBe(
        "Unknown error",
      );
    });

    it("falls back to Array.from when Intl.Segmenter is unavailable", () => {
      withSegmenter(undefined, () => {
        expect(
          AppErrorBoundary.getDerivedStateFromError(new Error("hello")).message,
        ).toBe("hello");
      });
    });

    it("falls back when constructing the Segmenter throws", () => {
      withSegmenter(
        function ThrowingSegmenter() {
          throw new Error("nope");
        },
        () => {
          expect(
            AppErrorBoundary.getDerivedStateFromError(new Error("hello")).message,
          ).toBe("hello");
        },
      );
    });
  });
});
