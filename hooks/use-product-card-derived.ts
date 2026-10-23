import { useMemo } from "react";
import { convertPrice, getBestPrice, selectBestListing } from "@/lib/currency";
import { computePriceChange } from "@/lib/price-change";
import { computeAvailability } from "@/lib/availability";
import { getLastRefreshedColor } from "@/lib/last-refreshed";
import { getTagById } from "@/lib/tags";
import { productStatus } from "@/lib/watchlist-org";
import type { DealScore } from "@/lib/deal-score";
import type { Product, TagDefinition } from "@/lib/types";

export function useProductCardDerived({
  product,
  tagDefinitions,
  insight,
  dealScore,
  displayCurrency,
}: {
  product: Product;
  tagDefinitions: Record<string, TagDefinition>;
  insight?: { atAllTimeLow: boolean; dropStreak: number };
  dealScore?: DealScore | null;
  displayCurrency?: string;
}) {
  const currency = displayCurrency ?? "USD";
  const showInsightRow =
    (insight != null && (insight.atAllTimeLow || insight.dropStreak >= 2)) ||
    (dealScore != null && dealScore.band === "hot");
  const bestPrice = useMemo(
    () => getBestPrice(product.listings ?? [], currency),
    [product.listings, currency],
  );
  const bestInStockListing = useMemo(
    () =>
      selectBestListing(product.listings ?? [], {
        currency,
        stock: "in_stock",
        requireUrl: true,
      })?.listing ?? null,
    [product.listings, currency],
  );
  const bestStatus = useMemo(() => productStatus(product), [product]);
  const availability = useMemo(
    () => computeAvailability(product.listings ?? []),
    [product.listings],
  );
  const distributorCount = product.listings?.length ?? 0;
  const validTags = useMemo(
    () => (product.tags ?? []).filter((id) => getTagById(tagDefinitions, id)),
    [product.tags, tagDefinitions],
  );
  const priceChange = useMemo(
    () => computePriceChange(product.listings ?? [], currency),
    [product.listings, currency],
  );
  const sparklineData = useMemo(() => {
    const all = (product.listings ?? []).flatMap((l) =>
      (l.priceHistory ?? []).map((p) => {
        const converted = convertPrice(p.price, p.currency, currency);
        return converted === null ? null : { ...p, price: converted, currency };
      }),
    ).filter((p): p is NonNullable<typeof p> => p !== null);
    if (all.length < 2) return null;
    return all;
  }, [product.listings, currency]);
  const refreshColorKey = useMemo(
    () => getLastRefreshedColor(product.lastRefreshed),
    [product.lastRefreshed],
  );

  return {
    currency,
    showInsightRow,
    bestPrice,
    bestInStockListing,
    bestStatus,
    availability,
    distributorCount,
    validTags,
    priceChange,
    sparklineData,
    refreshColorKey,
  };
}
