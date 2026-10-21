import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { log } from "@shared/log";
import {
  getAlerts,
  getLastSeenAt,
  getWatchlist,
  setLastSeenAt,
} from "@/lib/storage";
import { computeAwaySummary, type AwaySummary } from "@/lib/away-summary";
import { activeProducts } from "@/lib/acquired";
import type { PriceAlert, Product } from "@/lib/types";

export function useHomeData(displayCurrency: string) {
  const queryClient = useQueryClient();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [awaySummary, setAwaySummary] = useState<AwaySummary | null>(null);

  const loadGenRef = useRef(0);
  const loadData = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      setLoadError(null);
      const list = await getWatchlist();
      if (gen !== loadGenRef.current) return;
      setWatchlist(list);
      const alertList = await getAlerts();
      if (gen !== loadGenRef.current) return;
      setAlerts(alertList);
      const seen = await getLastSeenAt();
      if (gen !== loadGenRef.current) return;
      if (seen != null && list.length > 0) {
        setAwaySummary(
          computeAwaySummary({
            watchlist: activeProducts(list),
            since: seen,
            now: Date.now(),
            displayCurrency,
          }),
        );
      }
      await setLastSeenAt(Date.now());
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      log.error(e);
      setLoadError(e instanceof Error ? e.message : "Failed to load watchlist");
    } finally {
      if (gen === loadGenRef.current) setLoaded(true);
    }
  }, [displayCurrency]);

  // Invalidate cached watchlist preview when watchlist mutates so home never
  // shows stale data.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    void queryClient.invalidateQueries({ queryKey: ["watchlist_preview"] });
  }, [watchlist, queryClient]);

  // Reload whenever the tab is focused so seed/backfill changes are reflected.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      await loadData();
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
    } catch {
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const retry = useCallback(() => {
    setLoaded(false);
    void loadData();
  }, [loadData]);

  return {
    watchlist,
    alerts,
    refreshing,
    loaded,
    loadError,
    awaySummary,
    onRefresh,
    loadData,
    retry,
  };
}
