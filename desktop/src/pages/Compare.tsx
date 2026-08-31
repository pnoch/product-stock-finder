import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router";
import { storage } from "../storage";
import { formatPrice, convertPrice, CURRENCY_SYMBOLS } from "../../../lib/currency";
import { DISTRIBUTORS } from "../../../lib/distributors";
import { getDistributorById } from "../../../lib/distributors";
import type { Product } from "../../../lib/types";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { TimeRangeChips } from "../components/TimeRangeChips";
import { filterByRange, type TimeRange } from "../../../lib/compare-utils";
import {
  GitCompareArrows,
  TrendingDown,
  TrendingUp,
  Minus,
  Check,
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

function toTimeRange(k: string): TimeRange {
  switch (k) {
    case "1w":
      return "1W";
    case "1m":
      return "1M";
    case "3m":
      return "3M";
    default:
      return "All";
  }
}

function SeriesChart({
  series,
  displayCurrency,
}: {
  series: { label: string; color: string; data: { price: number; currency: string; date: string }[] }[];
  displayCurrency: string;
}) {
  const width = 640;
  const height = 280;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const usableW = width - padL - padR;
  const usableH = height - padT - padB;

  const allPrices: number[] = [];
  for (const s of series) {
    for (const p of s.data) {
      const c = convertPrice(p.price, p.currency, displayCurrency);
      if (c !== null && Number.isFinite(c)) allPrices.push(c);
    }
  }
  if (allPrices.length === 0) return <div className="text-center text-sm text-gray-400 py-8">No data</div>;
  const globalMin = Math.min(...allPrices);
  const globalMax = Math.max(...allPrices);
  const range = globalMax - globalMin || 1;
  const allDates: number[] = [];
  for (const s of series) for (const p of s.data) allDates.push(new Date(p.date).getTime());
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate || 1;
  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="mx-auto block">
        {[0, 0.5, 1].map((t) => {
          const y = padT + (1 - t) * usableH;
          const val = globalMin + t * range;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e5e7eb" strokeDasharray="4,4" strokeWidth={0.5} />
              <text x={padL - 6} y={y + 3} fontSize={9} fill="#6b7280" textAnchor="end">
                {symbol}
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {series.map((s) => {
          const sorted = [...s.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const coords = sorted
            .map((p) => {
              const conv = convertPrice(p.price, p.currency, displayCurrency);
              if (conv === null || !Number.isFinite(conv)) return null;
              const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
              const y = padT + (1 - (conv - globalMin) / range) * usableH;
              return { x, y };
            })
            .filter((c): c is { x: number; y: number } => c !== null);
          if (coords.length < 2) return null;
          const points = coords.map((c) => `${c.x},${c.y}`).join(" ");
          return (
            <g key={s.label}>
              <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {coords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={s.color} />
              ))}
            </g>
          );
        })}
        {(() => {
          if (series[0]?.data.length === 0) return null;
          const first = series[0]?.data ?? [];
          if (first.length === 0) return null;
          const sorted = [...first].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const idxs = [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1];
          return idxs.map((idx) => {
            const p = sorted[idx];
            if (!p) return null;
            const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
            const label = new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
            return (
              <text key={idx} x={x} y={height - 8} fontSize={9} fill="#6b7280" textAnchor="middle">
                {label}
              </text>
            );
          });
        })()}
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
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

  const timeRangeTyped = useMemo(() => toTimeRange(timeRange), [timeRange]);

  const chartSeries = useMemo(() => {
    if (!product) return [];
    const range = timeRangeTyped;
    return product.listings
      .filter((l) => l.priceHistory && l.priceHistory.length >= 2)
      .map((l) => {
        const distributor = getDistributorById(l.distributorId);
        const filtered = filterByRange(l.priceHistory, range);
        const colorIdx = product.listings.findIndex((x) => x.distributorId === l.distributorId);
        return {
          label: distributor?.name ?? l.distributorId,
          color: CHART_COLORS[colorIdx % CHART_COLORS.length],
          data: (filtered.length >= 2 ? filtered : l.priceHistory) as { price: number; currency: string; date: string }[],
        };
      });
  }, [product, timeRangeTyped]);

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

  if (loading) return <LoadingSpinner size="large" label="Loading prices..." />;
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

      {chartSeries.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
            Price History ({displayCurrency})
          </h2>
          {chartSeries.length >= 2 ? (
            <SeriesChart series={chartSeries} displayCurrency={displayCurrency} />
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Select at least 2 distributors with price history to compare</p>
              <div className="mt-4">
                <SeriesChart series={chartSeries} displayCurrency={displayCurrency} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center text-center">
          <div className="text-gray-300 dark:text-gray-600 mb-3">
            <GitCompareArrows className="w-10 h-10 mx-auto" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No price history yet</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Price points will appear here once distributors have history. Try tracking more distributors or check back later.
          </p>
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
              aria-label="Sort by name"
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
              aria-label="Sort by price"
            >
              Price
            </button>
          </div>
        </div>
        {sortedListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-gray-300 dark:text-gray-600 mb-3">
              <GitCompareArrows className="w-10 h-10" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No distributors to compare</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              Add distributors to this product to see side-by-side prices and trends.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedListings.map((listing, idx) => {
              const trend = getTrend(listing.priceHistory);
              return (
                <div
                  key={listing.distributorId}
                  className={`flex items-center justify-between px-4 py-3 transition-colors ${
                    idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/60 dark:bg-gray-800/40"
                  } hover:bg-gray-50 dark:hover:bg-gray-700/60`}
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
        )}
      </div>
    </div>
  );
}
