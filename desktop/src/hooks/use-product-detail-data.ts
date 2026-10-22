import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@shared/log";
import { storage } from "../storage";
import { getApiBaseUrl } from "../lib/api-base";
import { PRODUCT_CATALOG } from "@shared/catalog";
import type { DistributorListing, PriceAlert, Product } from "../../../lib/types";
import { composeLiveListings } from "../../../lib/live-prices";
import { fetchListingsWithTimeout } from "../lib/server-prices";
import { withTimeout } from "../../../lib/with-timeout";
import { rediscoverProduct } from "../../../lib/manual-add";
import { discoverListings } from "../../../lib/listing-discovery";
import { isAcquired } from "../../../lib/acquired";
import { isTauri } from "../lib/tauri";

export function useProductDetailData({
  id,
  showToast,
}: {
  id?: string;
  showToast: (message: string) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracked, setIsTracked] = useState(true);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [findingPrices, setFindingPrices] = useState(false);
  const loadIdRef = useRef(0);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    const myId = ++loadIdRef.current;
    setLoading(true);
    setLivePriceLoading(true);
    setLoadError(null);
    setRegionFilter("all");
    try {
      const [products, settings, watches, allAlerts] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
        storage.getStockWatches(),
        storage.getAlerts(),
      ]);
      if (loadIdRef.current !== myId) return;
      const found = products.find((p) => p.id === id);
      if (loadIdRef.current === myId) {
        const catalogEntry = found ? null : PRODUCT_CATALOG.find((p) => p.id === id);
        setProduct(
          found ??
            (catalogEntry
              ? { ...catalogEntry, addedAt: "", isWatched: false, listings: [] }
              : null),
        );
        setIsTracked(!!found);
      }
      if (loadIdRef.current !== myId) return;
      if (loadIdRef.current === myId) {
        setDisplayCurrency(settings.displayCurrency ?? "USD");
        setShippingRegion(settings.shippingRegion ?? "Asia-Pacific");
      }
      if (loadIdRef.current === myId) {
        const map: Record<string, boolean> = {};
        for (const w of watches) if (w.productId === id) map[w.distributorId] = true;
        setStockWatches(map);
      }
      if (loadIdRef.current === myId) {
        setAlerts(allAlerts.filter((a) => a.productId === id));
      }
      if (loadIdRef.current === myId && found && (found.listings ?? []).length > 0 && getApiBaseUrl()) {
        try {
          const { createTRPCClient } = await import("../lib/trpc");
          const client = createTRPCClient();
          const seeds = found.listings ?? [];
          const results = await fetchListingsWithTimeout(client, seeds, found.modelNumber);
          if (loadIdRef.current === myId && results.some((r) => r !== null)) {
            const merged = composeLiveListings(seeds, results);
            await storage.updateProductListings(id, merged);
            if (loadIdRef.current !== myId) return;
            const refreshed = await storage.getWatchlist();
            if (loadIdRef.current !== myId) return;
            const updated = refreshed.find((p) => p.id === id);
            if (loadIdRef.current === myId && updated) {
              setProduct(updated);
              setLastRefreshedAt(Date.now());
            }
          }
        } catch {
          // live refresh is best-effort; cached listings stay visible
        }
      }
    } catch (e) {
      if (loadIdRef.current === myId) {
        setLoadError(e instanceof Error ? e.message : "Couldn't load product");
      }
    } finally {
      if (loadIdRef.current === myId) {
        setLoading(false);
        setLivePriceLoading(false);
      }
    }

    if (!isTauri()) {
      const base = getApiBaseUrl();
      if (base) {
        if (loadIdRef.current === myId) setInsightLoading(true);
        try {
          const { createTRPCClient } = await import("../lib/trpc");
          const client = createTRPCClient();
          const result = await withTimeout(
            client.insights.get.query({ productId: id ?? "" }),
            4000,
          );
          if (loadIdRef.current === myId) {
            if (result) setInsight(result.insight);
            setInsightLoading(false);
          }
        } catch (e) {
          log.error("[ProductDetail] insight fetch failed", e);
          if (loadIdRef.current === myId) setInsightLoading(false);
        }
      }
      return;
    }
    const base = getApiBaseUrl();
    if (base && loadIdRef.current === myId) {
      setInsightLoading(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { byoLlmHeaders } = await import("../lib/trpc");
        const res = (await withTimeout(
          invoke("fetch_price_insight", {
            apiBaseUrl: base,
            productId: id,
            llmHeaders: await byoLlmHeaders(),
          }),
          4000,
        )) as { insight?: unknown } | null;
        if (loadIdRef.current === myId) {
          if (res && typeof res.insight === "string" && res.insight) setInsight(res.insight);
          setInsightLoading(false);
        }
      } catch (e) {
        log.error("[ProductDetail] insight fetch failed", e);
        if (loadIdRef.current === myId) setInsightLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadProduct();
    });
  }, [loadProduct]);

  const handleFindPrices = useCallback(async () => {
    if (!product?.modelNumber || findingPrices) return;
    setFindingPrices(true);
    try {
      const { discovered, timedOut } = await rediscoverProduct({
        storage: {
          updateProductListings: (pid: string, listings: DistributorListing[]) =>
            storage.updateProductListings(pid, listings),
        },
        discover: discoverListings,
        productId: product.id,
        modelNumber: product.modelNumber,
      });
      await loadProduct();
      if (discovered > 0) {
        showToast(`Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}`);
      } else if (timedOut) {
        showToast("Search timed out — try again");
      } else {
        showToast("No prices found");
      }
    } catch (e) {
      log.error("[Product] price discovery failed", e);
      showToast("Couldn't find prices");
    } finally {
      setFindingPrices(false);
    }
  }, [product, findingPrices, loadProduct, showToast]);

  const handleAddToWatchlist = useCallback(async () => {
    if (!product || addingToWatchlist) return;
    setAddingToWatchlist(true);
    try {
      await storage.addToWatchlist({
        ...product,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: product.listings ?? [],
        tags: product.tags ?? [],
      });
      showToast("Added to watchlist");
      await loadProduct();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setAddingToWatchlist(false);
    }
  }, [product, addingToWatchlist, loadProduct, showToast]);

  const handleToggleAcquired = useCallback(async () => {
    if (!product) return;
    try {
      await storage.updateProductAcquired(
        product.id,
        isAcquired(product) ? null : new Date().toISOString(),
      );
      const refreshed = await storage.getWatchlist();
      const found = refreshed.find((p) => p.id === product.id);
      if (found) setProduct(found);
    } catch {
      showToast("Couldn't update. Please try again.");
    }
  }, [product, showToast]);

  return {
    product,
    loading,
    isTracked,
    addingToWatchlist,
    displayCurrency,
    shippingRegion,
    regionFilter,
    setRegionFilter,
    insight,
    insightLoading,
    loadError,
    livePriceLoading,
    stockWatches,
    setStockWatches,
    alerts,
    setAlerts,
    lastRefreshedAt,
    findingPrices,
    loadProduct,
    handleFindPrices,
    handleAddToWatchlist,
    handleToggleAcquired,
  };
}
