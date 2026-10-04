import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";
import {
  composeLiveListings,
  deriveListingQueries,
  mergeSampleHistory,
} from "@/lib/live-prices";
import { getWatchlist, updateProductListings } from "@/lib/storage";
import type { DistributorListing, Product } from "@/lib/types";

const PERSIST_DEBOUNCE_MS = 500;

export function useLiveProduct(productId: string) {
  const queryClient = useQueryClient();
  const generationRef = useRef(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [seedListings, setSeedListings] = useState<DistributorListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadSeed = useCallback(async () => {
    const gen = ++generationRef.current;
    // A storage read failure must still mark the hook loaded, or the screen
    // hangs on its skeleton forever.
    const watchlist = await getWatchlist().catch(() => []);
    if (gen !== generationRef.current) return;
    const found = watchlist.find((p) => p.id === productId);
    const sample = SAMPLE_LISTINGS[productId] ?? [];
    // Reset first: the persist effect must not write the previous product's
    // listings under the new id while this load is still in flight.
    setLoaded(false);
    let seed: DistributorListing[];
    if (found) {
      const base = found.listings ?? [];
      if (base.length === 0) {
        seed = sample;
        if (sample.length > 0) {
          // A storage write failure must not reject unhandled.
          void updateProductListings(productId, sample).catch(() => {});
        }
      } else {
        seed = mergeSampleHistory(base, sample);
      }
      setProduct(found);
    } else {
      seed = sample;
      setProduct(null);
    }
    setSeedListings(seed);
    setLoaded(true);
  }, [productId]);

  useEffect(() => {
    void loadSeed();
    const generation = generationRef.current;
    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [loadSeed]);

  const modelNumber =
    product?.modelNumber ??
    PRODUCT_CATALOG.find((p) => p.id === productId)?.modelNumber ??
    null;

  const queries = useMemo(
    () => (modelNumber ? deriveListingQueries(modelNumber, seedListings) : []),
    [modelNumber, seedListings],
  );

  const results = useQueries({ queries });

  const listings = useMemo(
    () =>
      composeLiveListings(
        seedListings,
        results.map((r) => r.data ?? null),
      ),
    [seedListings, results],
  );

  const listingsRef = useRef<DistributorListing[]>([]);
  listingsRef.current = listings;

  const persistKey = useMemo(
    () => results.map((r) => r.dataUpdatedAt).join("|"),
    [results],
  );

  const hasLiveData = useMemo(
    () => results.some((r) => r.data != null),
    [results],
  );

  useEffect(() => {
    if (!loaded || !product || !hasLiveData) return;
    const timer = setTimeout(() => {
      void updateProductListings(productId, listingsRef.current).catch(() => {});
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loaded, product, productId, persistKey, hasLiveData]);

  const refresh = useCallback(async () => {
    // A storage read failure must not reject unhandled from the "Try Again" CTA.
    const watchlist = await getWatchlist().catch(() => []);
    if (watchlist.length === 0 && productId) {
      // fall through: the sample listings still render
    }
    const found = watchlist.find((p) => p.id === productId);
    const sample = SAMPLE_LISTINGS[productId] ?? [];
    let nextSeed: DistributorListing[];
    if (found) {
      const base = found.listings ?? [];
      if (base.length === 0) nextSeed = sample;
      else nextSeed = mergeSampleHistory(base, sample);
    } else {
      nextSeed = sample;
    }
    await loadSeed();
    const nextModel =
      found?.modelNumber ??
      PRODUCT_CATALOG.find((p) => p.id === productId)?.modelNumber ??
      null;
    const keys = nextModel
      ? deriveListingQueries(nextModel, nextSeed).map((q) => q.queryKey)
      : [];
    await Promise.all(
      keys.map((key) => queryClient.refetchQueries({ queryKey: key })),
    );
    return keys.some((key) => queryClient.getQueryData(key) != null);
  }, [loadSeed, productId, queryClient]);

  const isRefreshingAny = results.some((r) => r.isFetching);

  const lastUpdatedAt = useMemo(() => {
    let max = 0;
    for (const r of results) {
      if (r.data != null && r.dataUpdatedAt > max) max = r.dataUpdatedAt;
    }
    return max || null;
  }, [results]);

  return {
    product,
    listings,
    loaded,
    isRefreshingAny,
    lastUpdatedAt,
    refresh,
  };
}

export function useLiveWatchlist() {
  const queryClient = useQueryClient();
  const generationRef = useRef(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const gen = ++generationRef.current;
    // A storage read failure must still mark the hook loaded, or the screen
    // hangs on its skeleton forever.
    const list = await getWatchlist().catch(() => []);
    if (gen !== generationRef.current) return;
    setProducts(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
    const generation = generationRef.current;
    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [reload]);

  const queries = useMemo(
    () =>
      products.flatMap((p) =>
        deriveListingQueries(p.modelNumber, p.listings ?? []),
      ),
    [products],
  );

  const results = useQueries({ queries });

  const resultsRef = useRef(results);
  resultsRef.current = results;

  // `results` is a new array on every render (useQueries), so key the derived
  // values on dataUpdatedAt (which changes only when a query resolves new data)
  // instead — otherwise `liveProducts` is new every render and invalidates every
  // downstream memo and list row on the Watchlist.
  const persistKey = useMemo(
    () => results.map((r) => r.dataUpdatedAt).join("|"),
    [results],
  );

  const liveProducts = useMemo(() => {
    const current = resultsRef.current;
    let idx = 0;
    return products.map((p) => {
      const count = p.listings?.length ?? 0;
      const productResults = current
        .slice(idx, idx + count)
        .map((r) => r.data ?? null);
      idx += count;
      return {
        ...p,
        listings: composeLiveListings(p.listings ?? [], productResults),
      };
    });
    // `persistKey` is an intentional cache key: the callback reads `results`
    // through `resultsRef`, so the rule cannot see the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, persistKey]);

  const liveProductsRef = useRef<Product[]>([]);
  liveProductsRef.current = liveProducts;

  const hasLiveData = useMemo(
    () => results.some((r) => r.data != null),
    [results],
  );

  useEffect(() => {
    if (!loaded || !hasLiveData) return;
    const timer = setTimeout(() => {
      const ref = liveProductsRef.current;
      const res = resultsRef.current;
      let idx = 0;
      for (const p of ref) {
        const count = p.listings?.length ?? 0;
        const hasLive = res
          .slice(idx, idx + count)
          .some((r) => r.data != null);
        idx += count;
        if (hasLive) void updateProductListings(p.id, p.listings).catch(() => {});
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loaded, persistKey, hasLiveData]);

  const refreshAll = useCallback(async () => {
    // Read the watchlist fresh and derive the keys from it rather than the
    // memoized `queries` closure: a product added since the last render would
    // otherwise be missed by this call (mirrors useLiveProduct.refresh). An
    // empty watchlist has nothing to refresh, so report success — the header's
    // "Refresh all" button shows a "server unreachable" alert on false.
    const list = await getWatchlist().catch(() => []);
    await reload();
    const keys = list.flatMap((p) =>
      deriveListingQueries(p.modelNumber, p.listings ?? []).map((q) => q.queryKey),
    );
    if (keys.length === 0) return true;
    await Promise.all(
      keys.map((key) => queryClient.refetchQueries({ queryKey: key })),
    );
    return keys.some((key) => queryClient.getQueryData(key) != null);
  }, [reload, queryClient]);

  const isRefreshingAny = results.some((r) => r.isFetching);

  const lastUpdatedAt = useMemo(() => {
    let max = 0;
    for (const r of results) {
      if (r.data != null && r.dataUpdatedAt > max) max = r.dataUpdatedAt;
    }
    return max || null;
  }, [results]);

  return {
    products: liveProducts,
    loaded,
    isRefreshingAny,
    lastUpdatedAt,
    reload,
    refreshAll,
  };
}
