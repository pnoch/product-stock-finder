import { useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "../storage";
import type { DistributorListing, Product } from "../../../lib/types";

export function useHomeData({
  products,
  watchlistLoading,
  alertsLoading,
  refreshWatchlist,
  refreshAlerts,
}: {
  products: Product[];
  watchlistLoading: boolean;
  alertsLoading: boolean;
  refreshWatchlist: () => Promise<unknown>;
  refreshAlerts: () => Promise<unknown>;
}) {
  const [reminderCount, setReminderCount] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoadError(null);
    try {
      const [reminders, stockWatches, settings] = await Promise.all([
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      setReminderCount(reminders.length + stockWatches.length);
      setDisplayCurrency(settings?.displayCurrency ?? "USD");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load dashboard");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDashboard();
    });
  }, [loadDashboard]);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      setLoadError(null);
      await loadDashboard();
      try {
        await refreshWatchlist();
        await refreshAlerts();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Couldn't load dashboard");
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard, refreshWatchlist, refreshAlerts]);

  const handleRetry = useCallback(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const loading = watchlistLoading || alertsLoading;

  const recentActivity = useMemo(() => {
    const withTime: { product: Product; listing: DistributorListing | null; sortTime: number }[] = [];
    for (const p of products) {
      const listings = p.listings ?? [];
      if (listings.length === 0) {
        const addedTime = new Date(p.addedAt).getTime();
        withTime.push({ product: p, listing: null, sortTime: isNaN(addedTime) ? 0 : addedTime });
        continue;
      }
      let best = listings[0]!;
      let bestTime = isNaN(new Date(best.lastChecked).getTime())
        ? 0
        : new Date(best.lastChecked).getTime();
      for (const l of listings) {
        const t = isNaN(new Date(l.lastChecked).getTime())
          ? 0
          : new Date(l.lastChecked).getTime();
        if (t > bestTime) {
          best = l;
          bestTime = t;
        }
      }
      withTime.push({ product: p, listing: best, sortTime: bestTime });
    }
    withTime.sort((a, b) => b.sortTime - a.sortTime);
    return withTime.slice(0, 5).map(({ product, listing }) => ({ product, listing }));
  }, [products]);

  return {
    reminderCount,
    displayCurrency,
    loadError,
    refreshing,
    refreshDashboard,
    handleRetry,
    loading,
    recentActivity,
  };
}
