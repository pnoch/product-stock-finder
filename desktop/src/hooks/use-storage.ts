import { useCallback, useEffect, useRef } from "react";
import { storage } from "../storage";
import { onListingUpdated } from "../background";
import type { Product, PriceAlert, AppSettings } from "../../../lib/types";
import { log } from "@shared/log";
import { useStorageCollection } from "../../../lib/use-storage-collection";

export function useWatchlist() {
  const load = useCallback(() => storage.getWatchlist(), []);
  const {
    data: products,
    loading,
    refreshing,
    refresh,
  } = useStorageCollection(storage, "watchlist", load, [] as Product[]);

  // The Rust poller writes files directly and emits this event; the storage
  // subscription covers UI mutations, this covers the poller.
  useEffect(() => {
    const unlistenPromise = onListingUpdated(() => {
      void refresh();
    }).catch(() => () => {});
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [refresh]);

  return { products, loading, refreshing, refresh };
}

export function useAlerts() {
  const load = useCallback(() => storage.getAlerts(), []);
  const {
    data: alerts,
    loading,
    refreshing,
    refresh,
  } = useStorageCollection(storage, "alerts", load, [] as PriceAlert[]);
  return { alerts, loading, refreshing, refresh };
}

export function useSettings() {
  const load = useCallback(() => storage.getSettings(), []);
  const {
    data: settings,
    loading,
    refresh,
    setData: setSettings,
  } = useStorageCollection(
    storage,
    "settings",
    load,
    null as AppSettings | null,
  );

  // Mirrors `settings` so `update` (with stable deps) can capture the
  // pre-patch value for a revert without going stale.
  const settingsRef = useRef<AppSettings | null>(null);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const update = useCallback(
    (partial: Partial<AppSettings>) => {
      const previous = settingsRef.current;
      setSettings((prev) => ({ ...(prev ?? {}), ...partial }) as AppSettings);
      // Use the storage-serialized updateSettings so this shares the write
      // queue with every other settings writer instead of racing a stale
      // snapshot via a private chain.
      const write = storage.updateSettings(partial).then(() => undefined);
      write.catch((e) => {
        if (previous) setSettings(previous);
        log.error("[settings] save failed", e);
      });
      return write;
    },
    [setSettings],
  );

  return { settings, loading, refresh, update };
}
