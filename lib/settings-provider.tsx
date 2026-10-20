import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getSettings,
  subscribeToStorageChanges,
  updateSettings,
} from "@/lib/storage";
import { DEFAULT_SETTINGS } from "@/lib/storage/settings";
import type { AppSettings } from "@/lib/types";

type SettingsContextValue = {
  settings: AppSettings;
  loading: boolean;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>;
  refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refresh = useCallback(async () => {
    try {
      setSettings(await getSettings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    const unsubscribe = subscribeToStorageChanges((collection) => {
      if (collection === "settings") void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const previous = settingsRef.current;
      setSettings((prev) => ({ ...prev, [key]: value }));
      try {
        const updated = await updateSettings({
          [key]: value,
        } as Partial<AppSettings>);
        setSettings(updated);
      } catch {
        // Revert from the store, not the render-time snapshot: a second change
        // may have committed while this write was in flight.
        try {
          setSettings(await getSettings());
        } catch {
          setSettings(previous);
        }
        throw new Error("Couldn't save setting");
      }
    },
    [],
  );

  const value = useMemo(
    () => ({ settings, loading, updateSetting, refresh }),
    [settings, loading, updateSetting, refresh],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
