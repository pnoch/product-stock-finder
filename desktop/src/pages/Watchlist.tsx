import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  RefreshCw,
  Trash2,
  ArrowUpDown,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
} from "lucide-react";
import { useWatchlist, useSettings } from "../hooks/use-storage";
import { storage } from "../storage";
import { formatPrice, getBestPrice } from "../../../lib/currency";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { getApiBaseUrl } from "../lib/api-base";
import { computeWatchlistSummary } from "../../../lib/watchlist-summary";
import { getAllRegions, productHasRegion } from "../../../lib/region-filter";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ProductImage } from "../components/ProductImage";
import { TagFilterRow } from "../components/TagFilterRow";
import { countTagMatches } from "../../../lib/watchlist-org";
import { matchesTagFilterMode } from "../../../lib/tags";
import type { Product, StockStatus, TagDefinition } from "../../../lib/types";

type SortKey = "name" | "price" | "trend" | "lastUpdated";
type FilterKey = "all" | "in_stock" | "back_order" | "out_of_stock";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_stock", label: "In Stock" },
  { key: "back_order", label: "Back Order" },
  { key: "out_of_stock", label: "Out of Stock" },
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



const VIEWPORT_HEIGHT = 520;

export function Watchlist() {
  const { products, loading, refresh } = useWatchlist();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [query, setQuery] = useState("");
  const regions = useMemo(() => getAllRegions(), []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayCurrency = settings?.displayCurrency ?? "USD";

  useEffect(() => {
    storage.getSettings().then((s) => {
      const defs = (s.tagDefinitions ?? {}) as Record<string, TagDefinition>;
      setTagDefinitions(defs);
      setSelectedTagIds((prev) => prev.filter((id) => id in defs));
    });
  }, [settings]);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

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
    if (selectedTagIds.length > 0) {
      result = result.filter((p) => matchesTagFilterMode(p, selectedTagIds, tagMatchMode));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.modelNumber.toLowerCase().includes(q),
      );
    }
    return result;
  }, [filteredProducts, filter, selectedTagIds, tagMatchMode, query]);

  const tagCounts = useMemo(
    () =>
      countTagMatches(filteredProducts.filter((p) => {
        if (filter === "all") return true;
        return getDominantStatus(p) === filter;
      }), { region: "all", status: "all", query: "" }),
    [filteredProducts, filter],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "price": {
          const aPrice =
            getBestPrice(a.listings, displayCurrency)?.price ?? Infinity;
          const bPrice =
            getBestPrice(b.listings, displayCurrency)?.price ?? Infinity;
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
      // Attempt live price refresh via Tauri backend when available.
      // Falls back to a timestamp bump (placeholder) when running outside
      // Tauri (e.g. web preview) — live prices are kept fresh by the server
      // catalog warmer / background poller in that case.
      let liveRefreshed = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const raw = await storage.getWatchlist();
        const products = raw
          .map((p) => ({
            id: p.id,
            model_number: p.modelNumber,
            distributor_ids: p.listings.map((l) => l.distributorId),
          }))
          .filter((p) => p.distributor_ids.length > 0);
        if (products.length > 0) {
          await invoke("check_all_prices", {
            products,
            apiBaseUrl: getApiBaseUrl(),
          });
          liveRefreshed = true;
        }
      } catch {
        // Not in Tauri or invoke unavailable — fall through to bump
      }
      if (!liveRefreshed) {
        await storage.refreshWatchlistPrices();
      }
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

  if (loading) return <LoadingSpinner size="large" label="Loading watchlist..." />;

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
            aria-label="View distributor analysis"
          >
            Distributor Analysis
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Refresh prices"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Value
          </span>
          <span className="text-2xl font-bold">
            {formatPrice(summary.totalValue, displayCurrency)}
          </span>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex-1">
            <p className="text-lg font-semibold text-emerald-600">
              {summary.inStock}
            </p>
            <p className="text-xs text-gray-500">In Stock</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-amber-600">
              {summary.backOrder}
            </p>
            <p className="text-xs text-gray-500">Back Order</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-red-600">
              {summary.outOfStock}
            </p>
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
            aria-label={`Filter by ${opt.label}`}
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
            aria-label={region === "all" ? "Filter by all regions" : `Filter by ${region} region`}
          >
            {region === "all" ? "All" : region}
          </button>
        ))}
      </div>

      <TagFilterRow
        tagDefinitions={tagDefinitions}
        selectedTagIds={selectedTagIds}
        tagMatchMode={tagMatchMode}
        counts={tagCounts}
        onToggleTag={toggleTagFilter}
        onChangeMode={setTagMatchMode}
        onClearAll={() => setSelectedTagIds([])}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or model number..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          aria-label="Search watchlist"
        />
      </div>

      <div
        ref={scrollRef}
        style={{ maxHeight: VIEWPORT_HEIGHT, overflow: "auto" }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <table className="w-full">
          <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Name"
                >
                  Name
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Listings
              </th>
              <th className="text-left">
                <button
                  onClick={() => handleSort("price")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Price"
                >
                  Price
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Stock
              </th>
              <th className="text-left">
                <button
                  onClick={() => handleSort("trend")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Trend"
                >
                  Trend
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left">
                <button
                  onClick={() => handleSort("lastUpdated")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Last Updated"
                >
                  Last Updated
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
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
                  onClick={() => {
                    setSelectedId(product.id);
                    navigate(`/product/${product.id}`);
                  }}
                  className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-all duration-200 ${selectedId === product.id ? "bg-brand-50 dark:bg-brand-900/10 border-l-2 border-l-brand-500" : "border-l-2 border-l-transparent hover:border-l-brand-200"}`}
                  role="button"
                  aria-label={`View ${product.name} details`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <ProductImage productId={product.id} />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm">{product.name}</p>
                          {(product.tags ?? [])
                            .filter((tagId) => tagDefinitions[tagId])
                            .map((tagId) => {
                              const def = tagDefinitions[tagId];
                              return (
                                <span
                                  key={tagId}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: def.color }}
                                  title={def.name}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                                  {def.name}
                                </span>
                              );
                            })}
                          {(product.tags ?? []).filter((id) => tagDefinitions[id]).length === 0 &&
                            product.tags &&
                            product.tags.length > 0 && (
                              <span className="text-[10px] text-gray-400">
                                · {product.tags.length} tag
                                {product.tags.length !== 1 ? "s" : ""}
                              </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {product.brand} · {product.modelNumber}
                        </p>
                      </div>
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
                      {trend === "down" && (
                        <TrendingDown className="w-4 h-4 text-emerald-500" />
                      )}
                      {trend === "flat" && <Minus className="w-4 h-4 text-gray-400" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatLastRefreshed(refreshed)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => handleRemove(e, product.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label={`Remove ${product.name} from watchlist`}
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
