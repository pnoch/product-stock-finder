// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("expo-router", () => ({ router: { replace: vi.fn() } }));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...props }: { children: unknown }) => React.createElement("div", props, children as never),
    Text: ({ children, ...props }: { children: unknown }) => React.createElement("span", props, children as never),
    TouchableOpacity: ({ children, ...props }: { children: unknown }) => React.createElement("button", props, children as never),
    Platform: { OS: "ios" },
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { setItem: vi.fn(async () => {}), getItem: vi.fn(async () => null) },
}));
import { AppErrorBoundary } from "@/components/app-error-boundary";
function Boom(): never { throw new Error("boom"); }
describe("AppErrorBoundary", () => {
  it("renders fallback on throw", () => {
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });
});
