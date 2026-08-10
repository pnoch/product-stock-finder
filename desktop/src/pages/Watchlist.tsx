import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { RefreshCw, Trash2, ArrowUpDown, Package, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useWatchlist, useSettings } from "../hooks/use-storage";
import { storage } from "../storage";
import { formatPrice, getBestPrice } from "../../../lib/currency";
import { computeWatchlistSummary } from "../../../lib/watchlist-summary";
import { getAllRegions, productHasRegion } from "../../../lib/region-filter";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Product, StockStatus } from "../../../lib/types";

type SortKey = "name" | "price" | "trend" | "lastUpdated";
type FilterKey = "all" | "in_stock" | "back_order" | "out_of_stock";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_stock", label: "In Stock" },
  { key: "back_order", label: "Back Order" },
  { key: "out_of_stock", label: "Out of Stock" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "trend", label: "Trend" },
  { key: "lastUpdated", label: "Last Updated" },
];

function getTrend(product: Product): "up" | "down" | "flat" {
  const listings = product.listings.filter((l) => l.priceHistory.length >= 2);
  if (!listings.length) return "flat";

  let totalChange = 0;
  for (const listing of listings) {
    const history = listing.priceHistory;
    const recent = history[history.length - 1].price;
    const older = history[Math.max(0, history.length - 3)].price;
    totalChange += recent - older;
  }

  const avgChange = totalChange / listings.length;
  if (avgChange > 1) return "up";
  if (avgChange < -1) return "down";
  return "flat";
}

function getDominantStatus(product: Product): StockStatus {
  const statuses = product.listings.map((l) => l.stockStatus);
  if (statuses.includes("in_stock")) return "in_stock";
  if (statuses.includes("back_order")) return "back_order";
  if (statuses.includes("out_of_stock")) return "out_of_stock";
  return "unknown";
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Watchlist() {
  const { products, loading, refresh } = useWatchlist();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);

  const displayCurrency = settings?.displayCurrency ?? "USD";

  const filteredProducts = useMemo(
    () =>
      regionFilter === "all"
        ? products
        : products.filter((p) => productHasRegion(p, regionFilter)),
    [products, regionFilter],
  );

  const summary = useMemo(
    () => computeWatchlistSummary(filteredProducts, displayCurrency),
    [filteredProducts, displayCurrency],
  );

  const filtered = useMemo(() => {
    let result = filteredProducts;
    if (filter !== "all") {
      result = result.filter((p) => {
        const dominant = getDominantStatus(p);
        return dominant === filter;
      });
    }
    return result;
  }, [filteredProducts, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "price": {
          const aPrice = getBestPrice(a.listings, displayCurrency)?.price ?? Infinity;
          const bPrice = getBestPrice(b.listings, displayCurrency)?.price ?? Infinity;
          cmp = aPrice - bPrice;
          break;
        }
        case "trend": {
          const order = { up: 0, flat: 1, down: 2 };
          cmp = order[getTrend(a)] - order[getTrend(b)];
          break;
        }
        case "lastUpdated": {
          const aTime = new Date(a.lastRefreshed ?? a.addedAt).getTime();
          const bTime = new Date(b.lastRefreshed ?? b.addedAt).getTime();
          cmp = bTime - aTime;
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortAsc]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await storage.refreshWatchlistPrices();
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    await storage.removeFromWatchlist(productId);
    await refresh();
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (products.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Package className="w-12 h-12" />}
          title="No products in watchlist"
          description="Search for products to start tracking prices and stock availability."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/distributor-analysis")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Distributor Analysis
          </button>
          <button
            onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Value</span>
          <span className="text-2xl font-bold">
            {formatPrice(summary.totalValue, displayCurrency)}
          </span>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex-1">
            <p className="text-lg font-semibold text-emerald-600">{summary.inStock}</p>
            <p className="text-xs text-gray-500">In Stock</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-amber-600">{summary.backOrder}</p>
            <p className="text-xs text-gray-500">Back Order</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-red-600">{summary.outOfStock}</p>
            <p className="text-xs text-gray-500">Out of Stock</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">{summary.listingCount}</p>
            <p className="text-xs text-gray-500">Listings</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === opt.key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...regions].map((region) => (
          <button
            key={region}
            onClick={() => setRegionFilter(region)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              regionFilter === region
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {region === "all" ? "All" : region}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {SORT_OPTIONS.map((opt) => (
                <th key={opt.key} className="text-left">
                  <button
                    onClick={() => handleSort(opt.key)}
                    className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  >
                    {opt.label}
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((product) => {
              const best = getBestPrice(product.listings, displayCurrency);
              const trend = getTrend(product);
              const refreshed = product.lastRefreshed ?? product.addedAt;

              return (
                <tr
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {product.brand} · {product.modelNumber}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {product.listings.length}
                  </td>
                  <td className="px-4 py-3">
                    {best ? (
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatPrice(best.price, best.currency)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">No price</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge status={getDominantStatus(product)} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm">
                      {trend === "up" && <TrendingUp className="w-4 h-4 text-red-500" />}
                      {trend === "down" && <TrendingDown className="w-4 h-4 text-emerald-500" />}
                      {trend === "flat" && <Minus className="w-4 h-4 text-gray-400" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatTimeAgo(refreshed)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => handleRemove(e, product.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No products match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
