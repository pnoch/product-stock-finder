import { useState, useEffect, useCallback } from "react";
import { storage } from "../storage";
import { onListingUpdated } from "../background";
import type { Product, PriceAlert, AppSettings } from "../../../lib/types";

export function useWatchlist() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storage.getWatchlist();
      setProducts(data);
    } finally {
      setLoading(false);
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

  return { products, loading, refresh };
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storage.getAlerts();
      setAlerts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { alerts, loading, refresh };
}

let writeChain: Promise<void> = Promise.resolve();

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

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
    setSettings((prev) => ({ ...(prev ?? {}), ...partial }) as AppSettings);
    const write = writeChain.then(async () => {
      const current = await storage.getSettings();
      await storage.saveSettings({ ...current, ...partial });
    });
    writeChain = write.catch(() => {});
    write.catch((e) => console.error("[settings] save failed", e));
    return write;
  }, []);

  return { settings, loading, refresh, update };
}
