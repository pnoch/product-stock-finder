import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@shared/log";
import { rediscoverProduct } from "../../../lib/manual-add";
import { discoverListings } from "../../../lib/listing-discovery";
import type { DistributorListing, Product } from "../../../lib/types";
import { getApiBaseUrl } from "../lib/api-base";
import { fetchServerPricesForWatchlist } from "../lib/watchlist-refresh";
import { storage } from "../storage";

type Options = {
  products: Product[];
  loading: boolean;
  refresh: () => Promise<void>;
  showToast: (message: string) => void;
};

export function useWatchlistRefresh({
  products,
  loading,
  refresh,
  showToast,
}: Options) {
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [findingIds, setFindingIds] = useState<Set<string>>(new Set());
  const checkingRef = useRef(false);
  const hasLoadedOnce = useRef(false);

  const handleRetryList = useCallback(async () => {
    try {
      await refresh();
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Couldn't load watchlist");
    }
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    if (products.length > 0) {
      hasLoadedOnce.current = true;
      queueMicrotask(() => setListError(null));
      return;
    }
    let cancelled = false;
    storage
      .getWatchlist()
      .then(() => {
        if (cancelled) return;
        hasLoadedOnce.current = true;
        setListError(null);
      })
      .catch((e) => {
        if (!cancelled)
          setListError(
            e instanceof Error ? e.message : "Couldn't load watchlist",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [loading, products.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Attempt live price refresh via Tauri backend when available.
      let viaTauri = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const raw = await storage.getWatchlist();
        if (raw.length > 0) {
          // run_full_price_check scrapes AND persists the updated listings +
          // price history + tray badge. check_all_prices only returns results
          // without writing, so the UI would report a refresh that never
          // happened.
          await invoke("run_full_price_check", {
            apiBaseUrl: getApiBaseUrl(),
          });
          viaTauri = true;
        }
      } catch {
        // Not in Tauri or invoke unavailable — fall through to server fetch
      }
      if (viaTauri) {
        await refresh();
        showToast("Watchlist refreshed");
      } else {
        let result: { refreshed: number; total: number } | null = null;
        let fetchFailed = false;
        try {
          result = await fetchServerPricesForWatchlist((done, total) =>
            setRefreshProgress({ current: done, total }),
          );
        } catch {
          fetchFailed = true;
        }
        await refresh();
        if (fetchFailed || (result && result.refreshed === 0)) {
          showToast("Couldn't refresh prices");
        } else if (!result) {
          showToast("Live prices need a server connection or the Tauri app");
        } else {
          showToast(`Refreshed ${result.refreshed} of ${result.total} prices`);
        }
      }
    } finally {
      setRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const handleFindPrices = async (product: Product) => {
    if (!product.modelNumber) return;
    if (findingIds.has(product.id)) return;
    setFindingIds((prev) => new Set(prev).add(product.id));
    try {
      const { discovered, timedOut } = await rediscoverProduct({
        storage: {
          updateProductListings: (
            pid: string,
            listings: DistributorListing[],
          ) => storage.updateProductListings(pid, listings),
        },
        discover: discoverListings,
        productId: product.id,
        modelNumber: product.modelNumber,
      });
      await refresh();
      if (discovered > 0) {
        showToast(
          `Found prices at ${discovered} distributor${
            discovered === 1 ? "" : "s"
          }`,
        );
      } else if (timedOut) {
        showToast("Search timed out — try again");
      } else {
        showToast("No prices found");
      }
    } catch (e) {
      log.error("[Watchlist] price discovery failed", e);
      showToast("Couldn't find prices");
    } finally {
      setFindingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleCheckNow = useCallback(async () => {
    if (checkingRef.current || products.length === 0) return;
    checkingRef.current = true;
    setChecking(true);
    setCheckProgress({ current: 0, total: products.length });
    try {
      // Must use the Rust pipeline: the mobile `checkPriceDropsNow` reads the
      // module-level defaultStorage (IndexedDB in a Tauri webview), which is a
      // different store from the desktop localStorage/Rust-file adapter, so it
      // saw an empty watchlist and did nothing.
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("run_full_price_check", { apiBaseUrl: getApiBaseUrl() });
      await refresh();
    } catch {
      showToast("Couldn't complete price check");
    } finally {
      checkingRef.current = false;
      setChecking(false);
      setCheckProgress(null);
    }
  }, [products.length, refresh, showToast]);

  return {
    listError,
    refreshing,
    refreshProgress,
    checking,
    checkProgress,
    findingIds,
    handleRetryList,
    handleRefresh,
    handleCheckNow,
    handleFindPrices,
  };
}
