// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("expo-router", () => ({ router: { replace: vi.fn() } }));
vi.mock("react-native", async () => {
  const React = await import("react");
  const stripStyle = (style: unknown) => {
    if (!style) return undefined;
    if (Array.isArray(style)) return Object.assign({}, ...style.filter((s) => s && typeof s === "object"));
    if (typeof style === "object") return style as Record<string, unknown>;
    return undefined;
  };
  const view =
    ({ children, style, ...rest }: { children: unknown; style?: unknown }) =>
      React.createElement("div", { ...rest, style: stripStyle(style) }, children as never);
  const text =
    ({ children, style, ...rest }: { children: unknown; style?: unknown }) =>
      React.createElement("span", { ...rest, style: stripStyle(style) }, children as never);
  const pressable =
    ({ children, style, ...rest }: { children: unknown; style?: unknown }) =>
      React.createElement("button", { ...rest, style: stripStyle(style) }, children as never);
  return {
    View: view,
    Text: text,
    TouchableOpacity: pressable,
    Pressable: pressable,
    Platform: { OS: "ios", select: (obj: any) => obj.ios ?? obj.default },
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
import { AppErrorBoundary } from "@/components/app-error-boundary";
function Boom(): never { throw new Error("boom"); }
describe("AppErrorBoundary", () => {
  it("renders fallback on throw", () => {
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });
});
