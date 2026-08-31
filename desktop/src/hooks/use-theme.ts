import { useState, useEffect } from "react";

export type ThemePreference = "light" | "dark" | "auto";

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("auto");
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

  const set = (pref: ThemePreference) => setPreference(pref);

  const toggle = () =>
    setPreference((prev) => {
      const current = prev === "auto" ? (systemDark ? "dark" : "light") : prev;
      return current === "light" ? "dark" : "light";
    });

  return { theme, preference, set, toggle, isDark: theme === "dark" };
}
