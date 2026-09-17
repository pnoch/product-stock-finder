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
  // Write through the storage adapter (not raw localStorage): it mirrors to
  // the Rust app_settings.json, marks settings dirty for sync, and dispatches
  // the change event. A direct write skipped all three and could be clobbered
  // by the queued settings writer.
  void import("../storage")
    .then(({ storage }) => storage.updateSettings({ theme: pref }))
    .catch(() => {
      // best effort — the CSS class is already applied
    });
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
