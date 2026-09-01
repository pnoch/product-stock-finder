import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { getWatchlist } from "@/lib/storage";
import { getBestPrice } from "@/lib/currency";
import { findBestDeal } from "@/lib/best-deal";
import { filterByRange, type TimeRange } from "@/lib/compare-utils";
import type { Product, DistributorListing } from "@/lib/types";

export function useProductDetail() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await getWatchlist();
      const found = list.find((p) => p.id === id) ?? null;
      if (!cancelled) {
        setProduct(found);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const listings = product?.listings ?? [];
  const bestDeal = useMemo(() => findBestDeal(listings, "Asia-Pacific", "USD"), [listings]);
  const priceTrends = useMemo(() => {
    return listings.map((l) => ({
      id: l.distributorId,
      history: l.priceHistory ?? [],
    }));
  }, [listings]);

  return { id, product, listings, bestDeal, priceTrends, loading };
}
