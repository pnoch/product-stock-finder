import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router";
import { storage } from "../storage";
import { formatPrice, convertPrice } from "../../../lib/currency";
import { DISTRIBUTORS } from "../../../lib/distributors";
import type { Product } from "../../../lib/types";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { MultiLineChart } from "../components/MultiLineChart";
import { TimeRangeChips } from "../components/TimeRangeChips";
import {
  GitCompareArrows,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

const CHART_COLORS = [
  "#0F52BA",
  "#00C896",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function Compare() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "price">("name");
  const [displayCurrency, setDisplayCurrency] = useState("USD");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      storage.getWatchlist(),
      storage.getSettings(),
    ]).then(([list, settings]) => {
      setProduct(list.find((p) => p.id === id) ?? null);
      if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      setLoading(false);
    });
  }, [id]);

  const rangeDays = useMemo(() => {
    switch (timeRange) {
      case "1w":
        return 7;
      case "1m":
        return 30;
      case "3m":
        return 90;
      default:
        return Infinity;
    }
  }, [timeRange]);

  const cutoffDate = useMemo(() => {
    if (rangeDays === Infinity) return "";
    return daysAgo(rangeDays);
  }, [rangeDays]);

  const chartData = useMemo(() => {
    if (!product) return { data: [], distributors: [], colors: [] };

    const dateMap = new Map<string, Record<string, number | string>>();

    product.listings.forEach((listing) => {
      const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
      const distName = dist?.name ?? listing.distributorId;

      listing.priceHistory.forEach((point) => {
        if (cutoffDate && point.date < cutoffDate) return;
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, { date: point.date });
        }
        const row = dateMap.get(point.date)!;
        row[distName] = convertPrice(point.price, point.currency, displayCurrency);
      });
    });

    const dates = Array.from(dateMap.keys()).sort();
    const data = dates.map((d) => dateMap.get(d)!);

    const distributors = Array.from(
      new Set(
        product.listings.map((l) => {
          const dist = DISTRIBUTORS.find((d) => d.id === l.distributorId);
          return dist?.name ?? l.distributorId;
        }),
      ),
    );

    return { data, distributors, colors: CHART_COLORS };
  }, [product, cutoffDate, displayCurrency]);

  const sortedListings = useMemo(() => {
    if (!product) return [];
    const listings = product.listings.map((l) => {
      const dist = DISTRIBUTORS.find((d) => d.id === l.distributorId);
      return { ...l, distName: dist?.name ?? l.distributorId, dist };
    });
    if (sortBy === "price") {
      return listings.sort(
        (a, b) =>
          convertPrice(a.price, a.currency, displayCurrency) -
          convertPrice(b.price, b.currency, displayCurrency),
      );
    }
    return listings.sort((a, b) => a.distName.localeCompare(b.distName));
  }, [product, sortBy, displayCurrency]);

  const cheapest = useMemo(() => {
    if (!sortedListings.length) return null;
    const inStock = sortedListings.filter(
      (l) => l.stockStatus !== "out_of_stock" && l.price > 0,
    );
    if (!inStock.length) return null;
    return inStock.reduce((best, curr) => {
      const currConv = convertPrice(curr.price, curr.currency, displayCurrency);
      const bestConv = convertPrice(best.price, best.currency, displayCurrency);
      return currConv < bestConv ? curr : best;
    });
  }, [sortedListings, displayCurrency]);

  const getTrend = (priceHistory: { price: number; date: string }[]) => {
    if (priceHistory.length < 2) return "flat";
    const recent = priceHistory[priceHistory.length - 1].price;
    const prev = priceHistory[priceHistory.length - 2].price;
    if (recent < prev) return "down";
    if (recent > prev) return "up";
    return "flat";
  };

  if (loading) return <LoadingSpinner />;
  if (!product)
    return (
      <EmptyState
        icon={<GitCompareArrows className="w-12 h-12" />}
        title="Product not found"
        description="Go back to your watchlist and try again."
      />
    );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {product.brand} · {product.modelNumber}
          </p>
        </div>
        <TimeRangeChips selected={timeRange} onSelect={setTimeRange} />
      </div>

      {cheapest && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800">
              <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Best Price: {cheapest.distName}
              </p>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                {formatPrice(cheapest.price, cheapest.currency)}
              </p>
            </div>
            <div className="ml-auto">
              <StockBadge status={cheapest.stockStatus} />
            </div>
          </div>
        </div>
      )}

      {chartData.distributors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
            Price History
          </h2>
          <MultiLineChart
            data={chartData.data}
            distributors={chartData.distributors}
            colors={chartData.colors}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Distributors
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy("name")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === "name"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy("price")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === "price"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              Price
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedListings.map((listing) => {
            const trend = getTrend(listing.priceHistory);
            return (
              <div
                key={listing.distributorId}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  {listing.dist && (
                    <span className="text-lg">{listing.dist.countryFlag}</span>
                  )}
                  <div>
                    <p className="font-medium text-sm">{listing.distName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {listing.dist?.country ?? listing.distributorId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StockBadge
                    status={listing.stockStatus}
                    expectedDate={listing.expectedDate}
                  />
                  <div className="text-right min-w-[100px]">
                    <p className="font-semibold text-sm">
                      {formatPrice(listing.price, listing.currency)}
                    </p>
                  </div>
                  <div className="w-8 flex justify-center">
                    {trend === "down" && (
                      <TrendingDown className="w-4 h-4 text-emerald-500" />
                    )}
                    {trend === "up" && (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    )}
                    {trend === "flat" && (
                      <Minus className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
