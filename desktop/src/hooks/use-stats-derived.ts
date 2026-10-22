import { useMemo } from "react";
import { DISTRIBUTORS } from "@shared/distributors";
import { getBestPrice, convertPrice } from "@/lib/currency";
import { distributorColor } from "@shared/compare-utils";
import { activeProducts } from "../../../lib/acquired";
import {
  computeBasketValue,
  computeStockHealth,
  computeMovers,
  computeDataFreshness,
  type MoversWindow,
} from "../../../lib/watchlist-stats";
import { computeProductInsights } from "../../../lib/product-insights";
import { rankDeals } from "../../../lib/deal-score";
import { computeDropCalendar, buildGridCells } from "../../../lib/drop-calendar";
import type { Product } from "../../../lib/types";

export function useStatsDerived({
  products,
  displayCurrency,
  days,
  now,
}: {
  products: Product[] | null;
  displayCurrency: string;
  days: MoversWindow;
  now: number;
}) {
  const basket = useMemo(
    () => (products ? computeBasketValue(activeProducts(products), displayCurrency) : null),
    [products, displayCurrency],
  );
  const stockHealth = useMemo(
    () => (products ? computeStockHealth(products) : null),
    [products],
  );
  const movers = useMemo(
    () => (products ? computeMovers(products, displayCurrency, days) : null),
    [products, displayCurrency, days],
  );
  const freshness = useMemo(
    () => (products ? computeDataFreshness(products) : null),
    [products],
  );
  const insights = useMemo(
    () => (products ? computeProductInsights(products, displayCurrency) : null),
    [products, displayCurrency],
  );
  const topDeals = useMemo(
    () => rankDeals(products ?? [], displayCurrency),
    [products, displayCurrency],
  );
  const dropCalendar = useMemo(
    () => computeDropCalendar(products ?? [], displayCurrency, 30),
    [products, displayCurrency],
  );
  const dropCalendarCells = useMemo(() => buildGridCells(30, now), [now]);

  const chartData = useMemo(() => {
    if (!products || products.length === 0) return { data: [], distributors: [], distributorColors: [] };
    const cutoffStr =
      days === null
        ? ""
        : (() => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            return cutoff.toISOString().slice(0, 10);
          })();
    const topByValue = [...products]
      .sort((a, b) => {
        const pa = getBestPrice(a.listings ?? [], displayCurrency)?.price ?? -1;
        const pb = getBestPrice(b.listings ?? [], displayCurrency)?.price ?? -1;
        return pb - pa;
      })
      .slice(0, 3);
    const dateMap = new Map<string, Record<string, number | string>>();
    topByValue.forEach((p) => {
      (p.listings ?? []).forEach((listing) => {
        const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
        const name = dist?.name ?? listing.distributorId;
        (listing.priceHistory ?? []).forEach((pt) => {
          if (pt.date < cutoffStr) return;
          const converted = convertPrice(pt.price, pt.currency, displayCurrency);
          if (converted === null || !Number.isFinite(converted)) return;
          if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
          const row = dateMap.get(pt.date)!;
          row[name] = converted;
        });
      });
    });
    const dates = Array.from(dateMap.keys()).sort();
    const data = dates.map((d) => dateMap.get(d)!);
    const distributorIds: string[] = [];
    for (const p of topByValue) {
      for (const l of p.listings ?? []) {
        if (!distributorIds.includes(l.distributorId)) distributorIds.push(l.distributorId);
      }
    }
    const distributors = distributorIds.map(
      (id) => DISTRIBUTORS.find((d) => d.id === id)?.name ?? id,
    );
    const distributorColors = distributorIds.map((id) => distributorColor(id));
    return { data, distributors, distributorColors };
  }, [products, displayCurrency, days]);

  return {
    basket,
    stockHealth,
    movers,
    freshness,
    insights,
    topDeals,
    dropCalendar,
    dropCalendarCells,
    chartData,
  };
}
