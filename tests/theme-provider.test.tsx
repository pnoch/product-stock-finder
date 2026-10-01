// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { Appearance } from "react-native";
import { colorScheme as nwColorScheme, vars } from "nativewind";

const state = vi.hoisted(() => ({
  systemScheme: "light" as "light" | "dark",
  listeners: new Set<(e: { colorScheme: "light" | "dark" | null }) => void>(),
}));

function emitSystem(scheme: "light" | "dark") {
  state.listeners.forEach((l) => l({ colorScheme: scheme }));
}

// `@/constants/theme` transitively imports expo-font (and the RN font registry),
// so supply the palette directly — the SUT is the provider's plumbing.
const SCHEME = vi.hoisted(() => ({
  light: {
    primary: "#primary-light",
    background: "#background-light",
    surface: "#surface-light",
    foreground: "#foreground-light",
    muted: "#muted-light",
    border: "#border-light",
    success: "#success-light",
    warning: "#warning-light",
    error: "#error-light",
  },
  dark: {
    primary: "#primary-dark",
    background: "#background-dark",
    surface: "#surface-dark",
    foreground: "#foreground-dark",
    muted: "#muted-dark",
    border: "#border-dark",
    success: "#success-dark",
    warning: "#warning-dark",
    error: "#error-dark",
  },
}));

vi.mock("@/constants/theme", () => ({ SchemeColors: SCHEME }));

vi.mock("react-native", async () => {
  const ReactMod = await import("react");
  return {
    View: ({ children }: { children?: React.ReactNode }) =>
      ReactMod.createElement(ReactMod.Fragment, null, children),
    Appearance: {
      addChangeListener: vi.fn(
        (cb: (e: { colorScheme: "light" | "dark" | null }) => void) => {
          state.listeners.add(cb);
          return { remove: vi.fn(() => state.listeners.delete(cb)) };
        },
      ),
      setColorScheme: vi.fn(),
    },
    useColorScheme: () => state.systemScheme,
  };
});

vi.mock("nativewind", () => ({
  colorScheme: { set: vi.fn() },
  vars: vi.fn((v: Record<string, string>) => ({ __nv: v })),
}));

import { ThemeProvider, useThemeContext } from "../lib/theme-provider";

function renderTheme() {
  return renderHook(() => useThemeContext(), { wrapper: ThemeProvider });
}

const root = () => document.documentElement;

beforeEach(() => {
  state.systemScheme = "light";
  state.listeners.clear();
  vi.mocked(nwColorScheme.set).mockClear();
  vi.mocked(Appearance.setColorScheme).mockClear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
  for (const token of Object.keys(SCHEME.light)) {
    document.documentElement.style.removeProperty(`--color-${token}`);
  }
});

afterEach(() => {
  cleanup();
});

describe("ThemeProvider", () => {
  it("throws when the context is used outside the provider", () => {
    expect(() => renderHook(() => useThemeContext())).toThrow(/ThemeProvider/);
  });

  it("initializes from the system color scheme", () => {
    state.systemScheme = "dark";
    const { result } = renderTheme();
    expect(result.current.colorScheme).toBe("dark");
  });

  it("applies the scheme to the DOM, NativeWind, and Appearance", () => {
    const { result } = renderTheme();
    act(() => result.current.setColorScheme("dark"));

    expect(result.current.colorScheme).toBe("dark");
    expect(nwColorScheme.set).toHaveBeenCalledWith("dark");
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("dark");
    expect(root().dataset.theme).toBe("dark");
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().style.getPropertyValue("--color-primary")).toBe(
      SCHEME.dark.primary,
    );
    expect(root().style.getPropertyValue("--color-background")).toBe(
      SCHEME.dark.background,
    );
  });

  it("follows system scheme changes before a manual override", () => {
    const { result } = renderTheme();
    act(() => emitSystem("dark"));
    expect(result.current.colorScheme).toBe("dark");
  });

  it("ignores system changes after a manual override", () => {
    const { result } = renderTheme();
    act(() => result.current.setColorScheme("light"));
    act(() => emitSystem("dark"));
    expect(result.current.colorScheme).toBe("light");
  });

  it("unsubscribes from Appearance on unmount", () => {
    const { unmount } = renderTheme();
    expect(state.listeners.size).toBe(1);
    unmount();
    expect(state.listeners.size).toBe(0);
  });

  it("builds NativeWind theme variables from the active palette", () => {
    const { result } = renderTheme();
    act(() => result.current.setColorScheme("dark"));
    const lastCall = vi.mocked(vars).mock.calls.at(-1)![0];
    expect(lastCall).toMatchObject({
      "color-primary": SCHEME.dark.primary,
      "color-border": SCHEME.dark.border,
      "color-error": SCHEME.dark.error,
    });
  });
});
