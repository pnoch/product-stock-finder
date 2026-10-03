import { useState, useEffect, useCallback, useRef } from "react";
import { storage } from "../storage";
import { onListingUpdated } from "../background";
import type { Product, PriceAlert, AppSettings } from "../../../lib/types";
import { log } from "@shared/log";

export function useWatchlist() {
  const [products, setProducts] = useState<Product[]>([]);
  // `loading` is the first-load spinner only. The Rust poller emits
  // `listing-updated` once per scraped listing, so refreshing the data with
  // `loading` resetting each time blanked the page (resetting scroll and bulk
  // selection) N times per sweep. Later refreshes raise `refreshing` instead.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadedRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await storage.getWatchlist();
      setProducts(data);
    } finally {
      loadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unlistenPromise = onListingUpdated(() => {
      refresh();
    }).catch(() => () => {});
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [refresh]);

  return { products, loading, refreshing, refresh };
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  // See useWatchlist: only the first load blanks the page; alert actions
  // (toggle/delete/re-arm/snooze) raise `refreshing` instead.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadedRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await storage.getAlerts();
      setAlerts(data);
    } finally {
      loadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { alerts, loading, refreshing, refresh };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  // Mirrors `settings` so `update` (with stable deps) can capture the
  // pre-patch value for a revert without going stale.
  const settingsRef = useRef<AppSettings | null>(null);
  settingsRef.current = settings;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storage.getSettings();
      setSettings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback((partial: Partial<AppSettings>) => {
    const previous = settingsRef.current;
    setSettings((prev) => ({ ...(prev ?? {}), ...partial }) as AppSettings);
    // Use the storage-serialized updateSettings so this shares the write queue
    // with every other settings writer (Watchlist prefs, basket alert, theme)
    // instead of racing a stale snapshot via a private chain.
    const write = storage.updateSettings(partial).then(() => undefined);
    write.catch((e) => {
      // Revert the optimistic update so the UI doesn't show a setting that was
      // never persisted.
      if (previous) setSettings(previous);
      log.error("[settings] save failed", e);
    });
    return write;
  }, []);

  return { settings, loading, refresh, update };
}
