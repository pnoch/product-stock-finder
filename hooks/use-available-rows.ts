import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAvailable } from "@/lib/server-catalog";
import { getWatchlist } from "@/lib/storage";
import { getBestPrice } from "@/lib/currency";
import type { Row } from "@/components/available/available-row";
import type { AvailableProduct, Product } from "@/lib/types";

type Options = {
  configured: boolean;
  settingsLoading: boolean;
  currency: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
};

export function useAvailableRows({
  configured,
  settingsLoading,
  currency,
  category,
  brand,
  maxPrice,
}: Options) {
  const [fallbackRows, setFallbackRows] = useState<Row[]>([]);

  const query = useQuery<AvailableProduct[]>({
    queryKey: [
      "available",
      currency,
      category ?? null,
      brand ?? null,
      maxPrice ?? null,
    ],
    queryFn: () => fetchAvailable({ currency, category, brand, maxPrice }),
    staleTime: 60_000,
    enabled: configured && !settingsLoading,
  });

  useEffect(() => {
    if (configured) return;
    let active = true;
    (async () => {
      const watchlist = await getWatchlist();
      const rows: Row[] = [];
      for (const product of watchlist as Product[]) {
        const listings = product.listings ?? [];
        const inStock = listings.filter((l) => l.stockStatus === "in_stock");
        if (inStock.length === 0) continue;
        const best = getBestPrice(inStock, currency);
        if (!best) continue;
        rows.push({
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          modelNumber: product.modelNumber,
          price: best.price,
          currency: best.currency,
          storeCount: inStock.length,
        });
      }
      if (active) setFallbackRows(rows);
    })();
    return () => {
      active = false;
    };
  }, [configured, currency]);

  const serverRows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        modelNumber: p.modelNumber,
        price: p.bestPrice,
        currency: p.bestCurrency,
        storeCount: p.storeCount,
        fetchedAt: p.fetchedAt,
      })),
    [query.data],
  );

  return {
    rows: configured ? serverRows : fallbackRows,
    loading: configured && query.isLoading,
    query,
  };
}
