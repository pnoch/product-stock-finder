import { useState, useEffect } from "react";

export type ThemePreference = "light" | "dark" | "auto";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(mediaQuery.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const set = (pref: ThemePreference) => {
    if (pref === "auto") {
      setTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      );
    } else {
      setTheme(pref);
    }
  };

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return { theme, set, toggle, isDark: theme === "dark" };
}
