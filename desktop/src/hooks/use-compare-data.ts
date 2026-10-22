import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { storage } from "../storage";
import { convertPrice } from "@/lib/currency";
import type { Product } from "../../../lib/types";

export function useCompareData({
  id,
  showToast,
}: {
  id?: string;
  showToast: (message: string) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(() => {
    const d = searchParams.get("distributor");
    return new Set(d ? [d] : []);
  });
  const selectionInitialized = useRef<string | null>(null);
  const lastAppliedParam = useRef<string | null>(null);
  const distributorParam = searchParams.get("distributor");

  const loadCompare = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [list, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
      ]);
      setProduct(list.find((p) => p.id === id) ?? null);
      if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load comparison");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCompare();
    });
  }, [loadCompare]);

  useEffect(() => {
    if (!product) return;
    const paramKey = `${product.id}|${distributorParam ?? ""}`;
    if (distributorParam && (product.listings ?? []).some((l) => l.distributorId === distributorParam)) {
      if (lastAppliedParam.current !== paramKey) {
        lastAppliedParam.current = paramKey;
        selectionInitialized.current = product.id;
        setSelected(new Set([distributorParam]));
      }
      return;
    }
    if (selectionInitialized.current === product.id) return;
    selectionInitialized.current = product.id;
    const withHistory = (product.listings ?? [])
      .filter((l) => l.priceHistory && l.priceHistory.length >= 2)
      .sort((a, b) => {
        const aConv = convertPrice(a.price, a.currency, displayCurrency);
        const bConv = convertPrice(b.price, b.currency, displayCurrency);
        if (aConv === null && bConv === null) return 0;
        if (aConv === null) return 1;
        if (bConv === null) return -1;
        return aConv - bConv;
      });
    setSelected(new Set(withHistory.slice(0, 3).map((l) => l.distributorId)));
  }, [product, displayCurrency, distributorParam]);

  const toggleSelect = useCallback((distributorId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(distributorId)) {
        next.delete(distributorId);
      } else if (next.size < 5) {
        next.add(distributorId);
      }
      return next;
    });
  }, []);

  const handleToggleSelect = useCallback(
    (distributorId: string) => {
      if (!selected.has(distributorId) && selected.size >= 5) {
        showToast("You can compare up to 5 distributors");
        return;
      }
      toggleSelect(distributorId);
    },
    [selected, toggleSelect, showToast],
  );

  return {
    product,
    loading,
    displayCurrency,
    loadError,
    selected,
    handleToggleSelect,
    loadCompare,
  };
}
