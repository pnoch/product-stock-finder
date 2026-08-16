import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { PRODUCT_CATALOG } from "@/lib/catalog";
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
  const mounted = useRef(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [seedListings, setSeedListings] = useState<DistributorListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadSeed = useCallback(async () => {
    const watchlist = await getWatchlist();
    if (!mounted.current) return;
    const found = watchlist.find((p) => p.id === productId);
    const sample = SAMPLE_LISTINGS[productId] ?? [];
    let seed: DistributorListing[];
    if (found) {
      const base = found.listings ?? [];
      if (base.length === 0) {
        seed = sample;
        if (sample.length > 0) {
          void updateProductListings(productId, sample);
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
    mounted.current = true;
    void loadSeed();
    return () => {
      mounted.current = false;
    };
  }, [loadSeed]);

  const modelNumber =
    product?.modelNumber ??
    PRODUCT_CATALOG.find((p) => p.id === productId)?.modelNumber;

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
      void updateProductListings(productId, listingsRef.current);
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loaded, product, productId, persistKey, hasLiveData]);

  const refresh = useCallback(async () => {
    await loadSeed();
    const keys = queries.map((q) => q.queryKey);
    await Promise.all(
      keys.map((key) => queryClient.invalidateQueries({ queryKey: key })),
    );
    return keys.some((key) => queryClient.getQueryData(key) != null);
  }, [loadSeed, queryClient, queries]);

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
  const mounted = useRef(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const list = await getWatchlist();
    if (!mounted.current) return;
    setProducts(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
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

  const liveProducts = useMemo(() => {
    let idx = 0;
    return products.map((p) => {
      const count = p.listings?.length ?? 0;
      const productResults = results
        .slice(idx, idx + count)
        .map((r) => r.data ?? null);
      idx += count;
      return {
        ...p,
        listings: composeLiveListings(p.listings ?? [], productResults),
      };
    });
  }, [products, results]);

  const liveProductsRef = useRef<Product[]>([]);
  liveProductsRef.current = liveProducts;

  const persistKey = useMemo(
    () => results.map((r) => r.dataUpdatedAt).join("|"),
    [results],
  );

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
        if (hasLive) void updateProductListings(p.id, p.listings);
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loaded, persistKey, hasLiveData]);

  const refreshAll = useCallback(async () => {
    await reload();
    const keys = queries.map((q) => q.queryKey);
    await Promise.all(
      keys.map((key) => queryClient.invalidateQueries({ queryKey: key })),
    );
    return keys.some((key) => queryClient.getQueryData(key) != null);
  }, [reload, queryClient, queries]);

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
