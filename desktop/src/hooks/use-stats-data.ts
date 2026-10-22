import { useCallback, useEffect, useState } from "react";
import { storage } from "../storage";
import { computeDigest, type DigestResult } from "../../../lib/price-digest";
import type { Product } from "../../../lib/types";

export function useStatsData({
  pathname,
  showToast,
}: {
  pathname: string;
  showToast: (message: string) => void;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [digest, setDigest] = useState<DigestResult | null>(null);
  const [digestFrequency, setDigestFrequency] = useState("off");
  const [digestPending, setDigestPending] = useState(false);
  const [basketThreshold, setBasketThreshold] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, settings, snapshot, alerts] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
        storage.getPriceDigestSnapshot(),
        storage.getAlerts(),
      ]);
      setProducts(list);
      if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      const frequency = settings?.digestFrequency ?? "off";
      setDigestFrequency(frequency);
      setBasketThreshold(settings?.basketAlertThreshold ?? null);
      if (frequency === "off") {
        setDigest(null);
        setDigestPending(false);
        return;
      }
      setDigest(snapshot ? computeDigest(snapshot, list, settings, alerts) : null);
      setDigestPending(!snapshot && list.length > 0);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load statistics");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadStats();
    });
  }, [loadStats, pathname]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  }, [loadStats]);

  const handleSaveBasketAlert = useCallback(async (threshold: number | null) => {
    const previous = basketThreshold;
    setBasketThreshold(threshold);
    try {
      await storage.updateSettings({ basketAlertThreshold: threshold });
    } catch {
      setBasketThreshold(previous);
      showToast("Couldn't save your basket alert. Please try again.");
    }
  }, [basketThreshold, showToast]);

  const loading = products === null && loadError === null;

  return {
    products,
    displayCurrency,
    digest,
    digestFrequency,
    digestPending,
    basketThreshold,
    loadError,
    refreshing,
    loading,
    loadStats,
    handleRefresh,
    handleSaveBasketAlert,
  };
}
