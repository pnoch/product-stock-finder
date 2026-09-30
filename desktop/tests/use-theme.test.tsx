import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "../src/hooks/use-theme";

// `readStoredPreference` resolves the theme from app_settings.theme, then the
// legacy `theme-preference` key, then "auto". A regression here would ignore a
// user's saved theme on launch.
describe("useTheme", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
  });

  it("defaults to auto (light when the system is light)", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("auto");
    expect(result.current.theme).toBe("light");
  });

  it("reads the saved theme from app_settings", () => {
    localStorage.setItem("app_settings", JSON.stringify({ theme: "dark" }));
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("dark");
    expect(result.current.theme).toBe("dark");
  });

  it("falls back to the legacy theme-preference key", () => {
    localStorage.setItem("theme-preference", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("dark");
  });

  it("ignores an invalid saved theme", () => {
    localStorage.setItem("app_settings", JSON.stringify({ theme: "neon" }));
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("auto");
  });

  it("applies the dark class to the document element", () => {
    localStorage.setItem("app_settings", JSON.stringify({ theme: "dark" }));
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggle flips light/dark and persists", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.preference).toBe("dark");
    expect(localStorage.getItem("theme-preference")).toBe("dark");
  });
});
