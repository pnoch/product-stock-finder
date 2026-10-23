import { useCallback, useRef } from "react";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { parseBulkImportCsv } from "../../../lib/csv";
import { buildWatchlistShareMessage } from "../../../lib/watchlist-share";
import type { Product } from "../../../lib/types";
import { storage } from "../storage";
import { createTRPCClient } from "../lib/trpc";
import { copyTextWithFallback } from "../lib/share";

type Options = {
  products: Product[];
  displayCurrency: string;
  showToast: (message: string) => void;
  refresh: () => Promise<void>;
};

export function useWatchlistShare({
  products,
  displayCurrency,
  showToast,
  refresh,
}: Options) {
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleShare = useCallback(async () => {
    if (products.length === 0) return;
    // Prefer a server /w/ link (signed-in) so recipients can open the full
    // list; fall back to the local text summary when signed out or offline.
    let shareUrl: string | undefined;
    try {
      const res = await createTRPCClient().sharedWatchlists.create.mutate({});
      shareUrl = res.shareUrl;
    } catch {
      shareUrl = undefined;
    }
    const message = buildWatchlistShareMessage({
      shareUrl,
      watchlist: products,
      displayCurrency,
      days: 30,
      now: Date.now(),
    });
    if (await copyTextWithFallback(message))
      showToast(shareUrl ? "Share link copied" : "Copied to clipboard");
    else showToast("Couldn't copy share text");
  }, [products, displayCurrency, showToast]);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const { rows, truncated } = parseBulkImportCsv(text);
        if (rows.length === 0) {
          showToast(
            "No valid rows — expected header: model,targetPrice,currency,tags",
          );
          return;
        }
        if (truncated) {
          showToast(
            `Only the first ${rows.length} rows were imported — split the file for the rest`,
          );
        }
        const byModel = new Map(
          PRODUCT_CATALOG.map(
            (p) => [p.modelNumber.toLowerCase(), p] as const,
          ),
        );
        let added = 0;
        let skipped = 0;
        let duplicates = 0;
        // Track which products already have an active alert so re-importing the
        // same CSV doesn't accumulate duplicate alerts (addAlert has no dedup).
        const existingAlertProductIds = new Set(
          (await storage.getAlerts())
            .filter((a) => a.isActive && !a.triggeredAt)
            .map((a) => a.productId),
        );
        for (let i = 0; i < rows.length; i += 50) {
          const chunk = rows.slice(i, i + 50);
          for (const row of chunk) {
            const hit = byModel.get(row.model.toLowerCase());
            const product: Product = hit
              ? {
                  ...hit,
                  tags: row.tags.length ? row.tags : (hit.tags ?? []),
                  isWatched: true,
                  addedAt: new Date().toISOString(),
                  listings: [],
                }
              : {
                  id: row.model,
                  name: row.model,
                  modelNumber: row.model,
                  brand: "Unknown",
                  category: "Other",
                  description: "",
                  isWatched: true,
                  addedAt: new Date().toISOString(),
                  listings: [],
                  tags: row.tags,
                };
            try {
              // addToWatchlist returns false when the product is already
              // tracked; count those separately so the summary doesn't claim
              // to have added products that were already on the watchlist.
              if (await storage.addToWatchlist(product)) added += 1;
              else duplicates += 1;
              if (
                row.targetPrice !== null &&
                !existingAlertProductIds.has(product.id)
              ) {
                await storage.addAlert({
                  id: `alert-${product.id}-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                  productId: product.id,
                  targetPrice: row.targetPrice,
                  currency: row.currency,
                  createdAt: new Date().toISOString(),
                  isActive: true,
                } as never);
                existingAlertProductIds.add(product.id);
              }
            } catch {
              skipped += 1;
            }
          }
          await new Promise<void>((r) => setTimeout(r, 0));
        }
        await refresh();
        const notes = [
          duplicates ? `${duplicates} already tracked` : "",
          skipped ? `${skipped} skipped` : "",
        ]
          .filter(Boolean)
          .join(", ");
        showToast(
          `Added ${added} product${added !== 1 ? "s" : ""}${
            notes ? `, ${notes}` : ""
          }`,
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err));
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    },
    [refresh, showToast],
  );

  return { importInputRef, handleShare, handleImportFile };
}
