import { useMemo } from "react";
import { DISTRIBUTORS, getDistributorById } from "@shared/distributors";
import { convertPrice } from "@/lib/currency";
import { cheapestByRegion, distributorColor, filterByRange, type TimeRange } from "@shared/compare-utils";
import type { Product } from "../../../lib/types";
import type { CompareListing, PriceTrend } from "../components/compare/types";

function toTimeRange(k: string): TimeRange {
  switch (k) {
    case "1w":
      return "1W";
    case "1m":
      return "1M";
    case "3m":
      return "3M";
    case "6m":
      return "6M";
    case "1y":
      return "1Y";
    default:
      return "All";
  }
}

export function useCompareDerived({
  product,
  selected,
  timeRange,
  sortBy,
  displayCurrency,
}: {
  product: Product | null;
  selected: Set<string>;
  timeRange: string;
  sortBy: "name" | "price" | "trend";
  displayCurrency: string;
}) {
  const timeRangeTyped = useMemo(() => toTimeRange(timeRange), [timeRange]);

  const chartSeries = useMemo(() => {
    if (!product) return [];
    const range = timeRangeTyped;
    const selectedIds = selected;
    const list = (product.listings ?? []).filter(
      (l) =>
        selectedIds.has(l.distributorId) &&
        l.priceHistory &&
        l.priceHistory.length >= 2,
    );
    return list.map((l) => {
      const distributor = getDistributorById(l.distributorId);
      const filtered = filterByRange(l.priceHistory, range);
      return {
        label: distributor?.name ?? l.distributorId,
        color: distributorColor(l.distributorId),
        data: filtered as { price: number; currency: string; date: string }[],
      };
    });
  }, [product, timeRangeTyped, selected]);

  const priceTrends = useMemo(() => {
    if (!product) return new Map<string, PriceTrend>();
    const map = new Map<string, PriceTrend>();
    for (const l of product.listings ?? []) {
      if (!l.priceHistory || l.priceHistory.length < 2) {
        map.set(l.distributorId, { pct: 0, dir: "flat" });
        continue;
      }
      const sorted = [...l.priceHistory].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const oldest = sorted[0].price;
      const current = l.price;
      const pct = oldest > 0 ? ((current - oldest) / oldest) * 100 : 0;
      map.set(l.distributorId, {
        pct: Math.abs(pct),
        dir: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat",
      });
    }
    return map;
  }, [product]);

  const sortedListings = useMemo((): CompareListing[] => {
    if (!product) return [];
    const listings = (product.listings ?? []).map((l) => {
      const dist = DISTRIBUTORS.find((d) => d.id === l.distributorId);
      return { ...l, distName: dist?.name ?? l.distributorId, dist };
    });
    if (sortBy === "price") {
      return listings.sort((a, b) => {
        const pa = convertPrice(a.price, a.currency, displayCurrency);
        const pb = convertPrice(b.price, b.currency, displayCurrency);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
    }
    if (sortBy === "trend") {
      return listings.sort((a, b) => {
        const ta = priceTrends.get(a.distributorId);
        const tb = priceTrends.get(b.distributorId);
        const scoreA =
          ta?.dir === "down" ? ta.pct : ta?.dir === "up" ? -ta.pct : 0;
        const scoreB =
          tb?.dir === "down" ? tb.pct : tb?.dir === "up" ? -tb.pct : 0;
        return scoreB - scoreA;
      });
    }
    return listings.sort((a, b) => a.distName.localeCompare(b.distName));
  }, [product, sortBy, displayCurrency, priceTrends]);

  const cheapest = useMemo(() => {
    if (!sortedListings.length) return null;
    const inStock = sortedListings.filter(
      (l) => l.stockStatus !== "out_of_stock" && l.price > 0,
    );
    if (!inStock.length) return null;
    const convertible = inStock.filter(
      (l) => convertPrice(l.price, l.currency, displayCurrency) !== null,
    );
    if (!convertible.length) return null;
    return convertible.reduce((best, curr) => {
      const currConv = convertPrice(curr.price, curr.currency, displayCurrency)!;
      const bestConv = convertPrice(best.price, best.currency, displayCurrency)!;
      return currConv < bestConv ? curr : best;
    });
  }, [sortedListings, displayCurrency]);

  const regionBest = useMemo(
    () => cheapestByRegion(sortedListings, displayCurrency, convertPrice),
    [sortedListings, displayCurrency],
  );

  const crossBest = useMemo(() => {
    const inStock = sortedListings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    const vals = inStock
      .map((l) => convertPrice(l.price, l.currency, displayCurrency))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (vals.length === 0) return null;
    return Math.min(...vals);
  }, [sortedListings, displayCurrency]);

  const alertTarget = useMemo(
    () => (crossBest === null ? null : Math.round(crossBest * 0.95 * 100) / 100),
    [crossBest],
  );

  return {
    timeRangeTyped,
    chartSeries,
    priceTrends,
    sortedListings,
    cheapest,
    regionBest,
    crossBest,
    alertTarget,
  };
}
