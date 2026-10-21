import { useCallback, useEffect, useState } from "react";
import {
  getAlerts,
  getStockWatches,
  getWatchlist,
} from "@/lib/storage";
import { fetchPriceInsight } from "@/lib/server-insights";
import { fetchProductImage } from "@/lib/server-images";
import {
  localAlternatives,
  pickAlternatives,
  type Alternative,
} from "@/lib/alternatives";
import { fetchAvailable } from "@/lib/server-catalog";
import { isServerConfigured } from "@/constants/oauth";
import type { PriceAlert, Product } from "@/lib/types";

type Options = {
  id: string;
  product: Product | null;
  isOutOfStock: boolean;
  effectiveCurrency: string;
};

export function useProductDetailData({
  id,
  product,
  isOutOfStock,
  effectiveCurrency,
}: Options) {
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);

  const loadData = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!id) return;
      setInsight(null);
      setInsightLoading(true);
      setProductImage(null);
      // Storage reads can reject; without a catch the setters below never run
      // and the screen hangs on the loading skeleton forever.
      const [stockWatchesData, insightData, imageData, alertsData] =
        await Promise.all([
          getStockWatches().catch(() => []),
          fetchPriceInsight(id).catch(() => null),
          fetchProductImage(id).catch(() => null),
          getAlerts().catch(() => []),
        ]);
      if (signal?.cancelled) return;
      setAlerts(alertsData);
      const watchMap: Record<string, boolean> = {};
      for (const watch of stockWatchesData) {
        if (watch.productId === id) watchMap[watch.distributorId] = true;
      }
      setStockWatches(watchMap);
      if (insightData) setInsight(insightData.insight);
      setInsightLoading(false);
      if (imageData) setProductImage(imageData.imageUrl);
    },
    [id],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    // Defer the load so the effect does not synchronously cascade state updates.
    queueMicrotask(() => {
      void loadData(signal);
    });
    return () => {
      signal.cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!product?.category || !isOutOfStock) return;
    let active = true;
    (async () => {
      try {
        const next = isServerConfigured()
          ? pickAlternatives({
              product: { id, category: product.category },
              available: await fetchAvailable({
                category: product.category,
                currency: effectiveCurrency,
              }),
            })
          : localAlternatives(
              { id, category: product.category },
              await getWatchlist(),
              effectiveCurrency,
            );
        if (active) setAlternatives(next);
      } catch {
        if (active) setAlternatives([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [product?.category, isOutOfStock, effectiveCurrency, id]);

  return {
    insight,
    insightLoading,
    productImage,
    stockWatches,
    setStockWatches,
    alerts,
    setAlerts,
    alternatives,
    loadData,
  };
}
