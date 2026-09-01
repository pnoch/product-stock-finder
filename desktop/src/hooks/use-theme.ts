import { useState, useEffect, useCallback } from "react";

export type ThemePreference = "light" | "dark" | "auto";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "auto";
  // Single source: app_settings.theme — fallback to legacy key for migration
  try {
    const raw = localStorage.getItem("app_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.theme === "light" || parsed?.theme === "dark" || parsed?.theme === "auto") {
        return parsed.theme;
      }
    }
  } catch {}
  const legacy = localStorage.getItem("theme-preference");
  if (legacy === "light" || legacy === "dark" || legacy === "auto") return legacy as ThemePreference;
  return "auto";
}

function persistPreference(pref: ThemePreference) {
  if (typeof window === "undefined") return;
  localStorage.setItem("theme-preference", pref);
  try {
    const raw = localStorage.getItem("app_settings");
    const base = raw ? JSON.parse(raw) : {};
    localStorage.setItem("app_settings", JSON.stringify({ ...base, theme: pref }));
    window.dispatchEvent(new StorageEvent("storage", { key: "app_settings", newValue: localStorage.getItem("app_settings") } as unknown as StorageEventInit));
  } catch {}
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
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

  // Sync when app_settings is updated elsewhere (e.g., Settings.tsx via storage.saveSettings)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== null && e.key !== "app_settings" && e.key !== "theme-preference") return;
      const next = readStoredPreference();
      setPreferenceState((prev) => (prev !== next ? next : prev));
    };
    window.addEventListener("storage", handler);
    const onAppSettings = () => {
      const next = readStoredPreference();
      setPreferenceState((prev) => (prev !== next ? next : prev));
    };
    window.addEventListener("app_settings:changed" as unknown as string, onAppSettings);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("app_settings:changed" as unknown as string, onAppSettings);
    };
  }, []);

  const theme: "light" | "dark" =
    preference === "auto" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const set = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    persistPreference(pref);
  }, []);

  const toggle = useCallback(() =>
    setPreferenceState((prev) => {
      const current = prev === "auto" ? (systemDark ? "dark" : "light") : prev;
      const next = current === "light" ? "dark" : "light";
      persistPreference(next as ThemePreference);
      return next as ThemePreference;
    }), [systemDark]);

  return { theme, preference, set, toggle, isDark: theme === "dark" };
}
