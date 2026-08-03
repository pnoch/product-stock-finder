import { useState, useEffect, useCallback } from "react";
import { storage } from "../storage";
import type { Product, PriceAlert, AppSettings } from "../../../lib/types";

export function useWatchlist() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await storage.getWatchlist();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { products, loading, refresh };
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await storage.getAlerts();
    setAlerts(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { alerts, loading, refresh };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await storage.getSettings();
    setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    await storage.saveSettings(updated);
    setSettings(updated);
  }, [settings]);

  return { settings, loading, refresh, update };
}