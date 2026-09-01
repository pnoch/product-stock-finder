import { useState, useEffect } from "react";

export type ThemePreference = "light" | "dark" | "auto";

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "auto";
    const stored = localStorage.getItem("theme-preference");
    return stored === "light" || stored === "dark" ? stored : "auto";
  });
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const theme: "light" | "dark" =
    preference === "auto" ? (systemDark ? "dark" : "light") : preference;

  const set = (pref: ThemePreference) => {
    setPreferenceState(pref);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme-preference", pref);
    }
  };

  const toggle = () =>
    setPreferenceState((prev) => {
      const current = prev === "auto" ? (systemDark ? "dark" : "light") : prev;
      const next = current === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        localStorage.setItem("theme-preference", next);
      }
      return next;
    });

  return { theme, preference, set, toggle, isDark: theme === "dark" };
}
