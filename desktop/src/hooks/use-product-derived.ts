import { useMemo } from "react";
import { DISTRIBUTORS } from "@shared/distributors";
import { convertPrice, getBestPrice } from "@/lib/currency";
import { computePriceVsAverage } from "../../../lib/price-average";
import { filterListingsByRegion } from "../../../lib/region-filter";
import { findBestDeal } from "../../../lib/best-deal";
import { computeDealScore } from "../../../lib/deal-score";
import type { Product } from "../../../lib/types";

export function useProductDerived({
  product,
  regionFilter,
  displayCurrency,
  shippingRegion,
}: {
  product: Product | null;
  regionFilter: string;
  displayCurrency: string;
  shippingRegion: string;
}) {
  const visibleListings = useMemo(
    () =>
      regionFilter === "all"
        ? (product?.listings ?? [])
        : filterListingsByRegion(product?.listings ?? [], regionFilter),
    [regionFilter, product],
  );

  const best = useMemo(
    () => getBestPrice(visibleListings, displayCurrency),
    [visibleListings, displayCurrency],
  );

  const bestListing = useMemo(() => {
    if (!best) return null;
    return visibleListings.find((l) => {
      if (l.stockStatus === "out_of_stock" || l.price <= 0) return false;
      const converted = convertPrice(l.price, l.currency, displayCurrency);
      return converted !== null && Math.abs(converted - best.price) < 0.01;
    });
  }, [visibleListings, best, displayCurrency]);

  const bestDistributor = useMemo(() => {
    if (!bestListing) return null;
    return DISTRIBUTORS.find((d) => d.id === bestListing.distributorId) ?? null;
  }, [bestListing]);

  const bestDeal = useMemo(
    () => findBestDeal(visibleListings, shippingRegion, displayCurrency),
    [visibleListings, shippingRegion, displayCurrency],
  );

  const priceVsAvg = useMemo(
    () => (product ? computePriceVsAverage(product.listings ?? [], displayCurrency) : null),
    [product, displayCurrency],
  );

  const dealScore = useMemo(
    () => computeDealScore(product?.listings ?? [], displayCurrency),
    [product, displayCurrency],
  );

  const headerConversion = useMemo(() => {
    if (!bestListing || displayCurrency === bestListing.currency) return null;
    const converted = convertPrice(bestListing.price, bestListing.currency, displayCurrency);
    if (converted === null) return null;
    const rate = convertPrice(1, bestListing.currency, displayCurrency);
    return { converted, rate, price: bestListing.price, currency: bestListing.currency };
  }, [bestListing, displayCurrency]);

  const trendSignal = useMemo(() => {
    const hist = bestListing?.priceHistory;
    if (!hist || hist.length < 2) return null;
    const sorted = [...hist].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const oldest = convertPrice(sorted[0].price, sorted[0].currency, displayCurrency);
    const current = convertPrice(sorted[sorted.length - 1].price, sorted[sorted.length - 1].currency, displayCurrency);
    if (oldest === null || current === null || oldest <= 0) return null;
    if (current === oldest) return null;
    const pct = Math.round((Math.abs(oldest - current) / oldest) * 100);
    const down = current < oldest;
    return { down, pct };
  }, [bestListing, displayCurrency]);

  const isLowestEver = useMemo(() => {
    const hist = bestListing?.priceHistory;
    if (!bestListing || !hist || hist.length < 2) return false;
    const priorPoints = hist
      .slice(0, -1)
      .map((p) => convertPrice(p.price, p.currency, displayCurrency))
      .filter((v): v is number => v !== null);
    if (priorPoints.length === 0) return false;
    const priorMin = Math.min(...priorPoints);
    const current = convertPrice(bestListing.price, bestListing.currency, displayCurrency);
    if (current === null) return false;
    return current < priorMin;
  }, [bestListing, displayCurrency]);

  return {
    visibleListings,
    best,
    bestListing,
    bestDistributor,
    bestDeal,
    priceVsAvg,
    dealScore,
    headerConversion,
    trendSignal,
    isLowestEver,
  };
}
