import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { TrendingDown, TrendingUp, Package, BarChart3 } from "lucide-react";
import { storage } from "../storage";
import { EmptyState } from "../components/EmptyState";
import { MultiLineChart } from "../components/MultiLineChart";
import { formatPrice, convertPrice, CURRENCY_SYMBOLS } from "../../../lib/currency";
import { DISTRIBUTORS } from "../../../lib/distributors";
import type { Product } from "../../../lib/types";
import {
  computeBasketValue,
  computeDataFreshness,
  computeMovers,
  computeStockHealth,
} from "../../../lib/watchlist-stats";

const CHART_COLORS = ["#0F52BA", "#00C896", "#F59E0B", "#EF4444", "#8B5CF6"];

function StatSkeleton() {
  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer mb-3" />
      <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer mb-2" />
      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer mb-4" />
      <div className="h-[320px] w-full bg-gray-100 dark:bg-gray-700 rounded skeleton-shimmer" />
    </div>
  );
}

export function Stats() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [days] = useState(30);

  useEffect(() => {
    Promise.all([storage.getWatchlist(), storage.getSettings()]).then(
      ([list, settings]) => {
        setProducts(list);
        if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      },
    );
  }, []);

  const loading = products === null;

  const basket = useMemo(
    () => (products ? computeBasketValue(products, displayCurrency) : null),
    [products, displayCurrency],
  );
  const stockHealth = useMemo(
    () => (products ? computeStockHealth(products) : null),
    [products],
  );
  const movers = useMemo(
    () => (products ? computeMovers(products, displayCurrency, days as 7 | 30 | 90) : null),
    [products, displayCurrency, days],
  );
  const freshness = useMemo(
    () => (products ? computeDataFreshness(products) : null),
    [products],
  );

  const chartData = useMemo(() => {
    if (!products || products.length === 0) return { data: [], distributors: [] };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const dateMap = new Map<string, Record<string, number | string>>();
    products.slice(0, 3).forEach((p) => {
      p.listings.forEach((listing) => {
        const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
        const name = dist?.name ?? listing.distributorId;
        listing.priceHistory.forEach((pt) => {
          if (pt.date < cutoffStr) return;
          if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
          const row = dateMap.get(pt.date)!;
          row[name] = convertPrice(pt.price, pt.currency, displayCurrency);
        });
      });
    });
    const dates = Array.from(dateMap.keys()).sort();
    const data = dates.map((d) => dateMap.get(d)!);
    const distributors = Array.from(
      new Set(
        products
          .slice(0, 3)
          .flatMap((p) =>
            p.listings.map((l) => DISTRIBUTORS.find((d) => d.id === l.distributorId)?.name ?? l.distributorId),
          ),
      ),
    );
    return { data, distributors };
  }, [products, displayCurrency, days]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <ChartSkeleton />
        <div className="grid grid-cols-2 gap-4">
          <StatSkeleton />
          <StatSkeleton />
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto w-full">
        <EmptyState
          icon={<BarChart3 className="w-12 h-12" />}
          title="No statistics yet"
          description="Add products to your watchlist to see price trends and stock health."
        />
        <div className="flex justify-center mt-4">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          >
            <Package className="w-4 h-4" /> Add Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl font-bold">Statistics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
          <p className="text-sm text-gray-500 dark:text-gray-400">Basket Value</p>
          <p className="text-2xl font-bold mt-1">
            {basket ? formatPrice(basket.total, displayCurrency) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">{basket?.productCount ?? 0} products</p>
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
          <p className="text-sm text-gray-500 dark:text-gray-400">In Stock</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {stockHealth ? `${stockHealth.inStockPct}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">{stockHealth?.totalListings ?? 0} listings</p>
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
          <p className="text-sm text-gray-500 dark:text-gray-400">Biggest Drop</p>
          {movers && movers.drops.length > 0 ? (
            <>
              <p className="text-lg font-bold mt-1 flex items-center gap-1 text-emerald-600">
                <TrendingDown className="w-4 h-4" /> {movers.drops[0].changePct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-1 truncate">{movers.drops[0].productName}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-2">No movers yet</p>
          )}
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
          <p className="text-sm text-gray-500 dark:text-gray-400">Biggest Rise</p>
          {movers && movers.gainers.length > 0 ? (
            <>
              <p className="text-lg font-bold mt-1 flex items-center gap-1 text-red-600">
                <TrendingUp className="w-4 h-4" /> +{movers.gainers[0].changePct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-1 truncate">{movers.gainers[0].productName}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-2">No movers yet</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Price History</h2>
        {chartData.data.length > 0 ? (
          <MultiLineChart
            data={chartData.data}
            distributors={chartData.distributors}
            colors={CHART_COLORS}
            currencySymbol={CURRENCY_SYMBOLS[displayCurrency] ?? "$"}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
            <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No price history yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
              Price points will appear here once distributors are tracked over time.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Data Freshness</p>
          {freshness ? (
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                Fresh: <span className="font-medium text-gray-900 dark:text-gray-100">{freshness.freshCount}</span> · Stale:{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">{freshness.staleCount}</span>
              </p>
              <p className="text-xs text-gray-400">Oldest update {freshness.oldestAgeLabel}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Stock Health</p>
          {stockHealth ? (
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                {stockHealth.inStockPct}% in stock · {stockHealth.fullyOutOfStock} fully out of stock
              </p>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stockHealth.inStockPct}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}
