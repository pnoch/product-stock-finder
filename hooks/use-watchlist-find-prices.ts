import { useCallback, useState } from "react";
import { LOG_ERROR } from "@shared/log";
import { updateProductListings } from "@/lib/storage";
import { rediscoverProduct } from "@/lib/manual-add";
import { discoverListings } from "@/lib/listing-discovery";
import type { Product } from "@/lib/types";

type Options = {
  reload: () => Promise<void>;
  showToast: (
    message: string,
    tone?: "success" | "info" | "error",
  ) => void;
};

export function useWatchlistFindPrices({ reload, showToast }: Options) {
  const [findingIds, setFindingIds] = useState<Set<string>>(new Set());
  const [findingProgress, setFindingProgress] = useState<
    Map<string, { done: number; total: number }>
  >(new Map());

  const handleFindPrices = useCallback(
    async (product: Product) => {
      if (!product.modelNumber) return;
      if (findingIds.has(product.id)) return;
      setFindingIds((prev) => new Set(prev).add(product.id));
      try {
        const { discovered, timedOut } = await rediscoverProduct({
          storage: { updateProductListings },
          discover: discoverListings,
          productId: product.id,
          modelNumber: product.modelNumber,
          completedDistributorIds: product.discovery?.completedDistributorIds,
          onProgress: (done, total) =>
            setFindingProgress((prev) =>
              new Map(prev).set(product.id, { done, total }),
            ),
          onSaved: reload,
        });
        await reload();
        showToast(
          discovered > 0
            ? `Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}`
            : timedOut
              ? "Search timed out — try again"
              : "No prices found",
          discovered > 0 ? "success" : "error",
        );
      } catch (e) {
        LOG_ERROR("[Watchlist] price discovery failed", e);
        showToast("Couldn't find prices", "error");
      } finally {
        setFindingIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
        setFindingProgress((prev) => {
          const next = new Map(prev);
          next.delete(product.id);
          return next;
        });
      }
    },
    [findingIds, reload, showToast],
  );

  return { findingIds, findingProgress, handleFindPrices };
}
