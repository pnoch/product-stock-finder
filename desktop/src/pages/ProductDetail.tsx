import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  ExternalLink,
  Bell,
  Clock,
  Star,
  BarChart3,
} from "lucide-react";
import { storage } from "../storage";
import { getApiBaseUrl } from "../lib/api-base";
import { useTheme } from "../hooks/use-theme";
import {
  formatPrice,
  getBestPrice,
  convertPrice,
  EXCHANGE_RATES,
  CURRENCY_SYMBOLS,
} from "../../../lib/currency";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { DISTRIBUTORS } from "../../../lib/distributors";
import {
  getAllRegions,
  filterListingsByRegion,
} from "../../../lib/region-filter";
import type { Product } from "../../../lib/types";
import { findBestDeal } from "../../../lib/best-deal";
import { StockBadge } from "../components/StockBadge";
import { Modal } from "../components/Modal";
import { ProductImage } from "../components/ProductImage";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function PriceSparkline({ history }: { history: { price: number }[] }) {
  if (history.length < 2) {
    return <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded" />;
  }

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 96;
  const h = 32;
  const padding = 2;

  const points = prices
    .map((p, i) => {
      const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
      const y = h - padding - ((p - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const isDown = prices[prices.length - 1] < prices[0];
  const strokeColor = isDown ? "#10b981" : "#ef4444";

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");
  const [alertSaved, setAlertSaved] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const [insight, setInsight] = useState<string | null>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setRegionFilter("all");
    (async () => {
      const products = await storage.getWatchlist();
      if (cancelled) return;
      const found = products.find((p) => p.id === id);
      if (!cancelled) setProduct(found ?? null);
      const settings = await storage.getSettings();
      if (cancelled) return;
      if (!cancelled) {
        setDisplayCurrency(settings.displayCurrency ?? "USD");
        setShippingRegion(settings.shippingRegion ?? "Asia-Pacific");
      }
      if (!cancelled) setLoading(false);

      if (!("__TAURI__" in window)) return;
      const base = getApiBaseUrl();
      if (base && !cancelled) {
        const { invoke } = await import("@tauri-apps/api/core");
        invoke("fetch_price_insight", { apiBaseUrl: base, productId: id })
          .then((res: any) => {
            if (!cancelled && res && res.insight) setInsight(res.insight);
          })
          .catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const visibleListings =
    regionFilter === "all"
      ? (product?.listings ?? [])
      : filterListingsByRegion(product?.listings ?? [], regionFilter);

  const best = useMemo(() => {
    return getBestPrice(visibleListings, displayCurrency);
  }, [visibleListings, displayCurrency]);

  const bestListing = useMemo(() => {
    if (!best) return null;
    return visibleListings.find(
      (l) =>
        l.stockStatus !== "out_of_stock" &&
        l.price > 0 &&
        Math.abs((convertPrice(l.price, l.currency, displayCurrency) ?? l.price) - best.price) < 0.01,
    );
  }, [visibleListings, best, displayCurrency]);

  const bestDistributor = useMemo(() => {
    if (!bestListing) return null;
    return DISTRIBUTORS.find((d) => d.id === bestListing.distributorId) ?? null;
  }, [bestListing]);

  const bestDeal = useMemo(
    () => findBestDeal(visibleListings, shippingRegion, displayCurrency),
    [visibleListings, shippingRegion, displayCurrency],
  );

  const [alertError, setAlertError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const checkNotificationPermission = async (): Promise<boolean> => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") return false;
        const result = await Notification.requestPermission();
        return result === "granted";
      }
    } catch {
      // fall through to granted for Tauri
    }
    return true;
  };

  const handleSaveAlert = async () => {
    if (!product || !alertPrice) return;
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) return;

    const granted = await checkNotificationPermission();
    if (!granted) {
      setAlertError("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setAlertError(null);
    const distributorId = bestListing?.distributorId ?? visibleListings[0]?.distributorId ?? "";
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    const direction: "drop" | "rise" = "drop";

    await storage.addAlert({
      id: `alert-${Date.now()}`,
      productId: product.id,
      direction,
      distributorId,
      targetPrice: price,
      currency: alertCurrency,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    setAlertSaved(true);
    setTimeout(() => {
      setAlertOpen(false);
      setAlertSaved(false);
      setAlertPrice("");
      setAlertError(null);
    }, 1200);
  };

  const handleRemindMe = async () => {
    if (!product) return;
    if (!bestListing) {
      showToast("No distributor available");
      return;
    }
    const date = new Date();
    date.setDate(date.getDate() + 7);
    await storage.addBackOrderReminder({
      id: `reminder-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      distributorId: bestListing.distributorId,
      distributorName: bestDistributor?.name ?? "Unknown",
      reminderDate: date.toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "date",
    });
    showToast(`Reminder set for ${date.toLocaleDateString()}`);
  };

  const handleWatchRestock = async () => {
    if (!product || !bestListing) return;
    await storage.addStockWatch({
      id: `watch-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      distributorId: bestListing.distributorId,
      distributorName: bestDistributor?.name ?? "Unknown",
      reminderDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "back_in_stock",
      lastKnownStatus: bestListing.stockStatus,
    });
  };

  if (loading)
    return (
      <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
        <div className="h-6 w-24 rounded skeleton-shimmer" />
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-xl skeleton-shimmer shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-3/4 rounded skeleton-shimmer" />
            <div className="h-4 w-1/2 rounded skeleton-shimmer" />
            <div className="h-3 w-full rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-32 rounded-xl skeleton-shimmer" />
        <div className="h-72 rounded-xl skeleton-shimmer" />
        <div className="h-64 rounded-xl skeleton-shimmer" />
      </div>
    );

  if (!product) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold mb-1">Product not found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This product may have been removed from your watchlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeIn">
          {toast}
        </div>
      )}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Go back"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Product Header */}
      <div className="flex items-start gap-4">
        <ProductImage productId={product.id} size={96} />
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{product.brand}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{product.modelNumber}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{product.category}</span>
          </div>
          {product.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {product.description}
            </p>
          )}
        </div>
      </div>

      {/* Best Distributor Card */}
      {best && bestListing && bestDistributor && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                Best Price
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatPrice(best.price, best.currency)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {bestDistributor.name} · {bestDistributor.country}{" "}
                {bestDistributor.countryFlag}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StockBadge
                status={bestListing.stockStatus}
                expectedDate={bestListing.expectedDate}
              />
              <PriceSparkline history={bestListing.priceHistory} />
            </div>
          </div>
          <a
            href={bestListing.stockStatus === "in_stock" ? bestListing.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={bestListing.stockStatus !== "in_stock"}
            tabIndex={bestListing.stockStatus !== "in_stock" ? -1 : undefined}
            onClick={(e) => {
              if (bestListing.stockStatus !== "in_stock") e.preventDefault();
            }}
            className={`mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              bestListing.stockStatus === "in_stock"
                ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed pointer-events-none"
            }`}
            aria-label={
              bestListing.stockStatus === "in_stock"
                ? `Buy ${product.name} at ${bestDistributor.name}`
                : `${product.name} is not in stock at ${bestDistributor.name}`
            }
          >
            {bestListing.stockStatus === "in_stock"
              ? "Buy Now"
              : bestListing.stockStatus === "back_order"
                ? "Back Order"
                : "Out of Stock"}{" "}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {insight && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            AI insight
          </p>
          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
            {insight}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap transition-opacity duration-200">
        <button
          onClick={() => setAlertOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Set price alert"
        >
          <Bell className="w-4 h-4" /> Set Alert
        </button>
        <button
          onClick={handleRemindMe}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Set a reminder"
        >
          <Clock className="w-4 h-4" /> Remind Me
        </button>
        <button
          onClick={handleWatchRestock}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Watch for restock"
        >
          <Star className="w-4 h-4" /> Watch for Restock
        </button>
        <Link
          to={`/compare/${product.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Compare prices across distributors"
        >
          <BarChart3 className="w-4 h-4" /> Compare
        </Link>
      </div>

      {/* Price History Section */}
      {bestListing &&
        bestListing.priceHistory &&
        bestListing.priceHistory.length >= 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-fadeIn transition-opacity duration-200">
            <h2 className="text-lg font-semibold mb-3">Price History</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={bestListing.priceHistory.map((p) => ({
                  date: new Date(p.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  }),
                  price: convertPrice(p.price, p.currency, displayCurrency),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }} axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }} tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }}
                  axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                  tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                  tickFormatter={(v: number) =>
                    `${CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency}${v.toFixed(0)}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                    borderRadius: 8,
                    color: isDark ? "#f3f4f6" : undefined,
                  }}
                  formatter={(value: number) => [
                    `${CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency}${value.toFixed(2)}`,
                    "Price",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={isDark ? "#3B7DD8" : "#0F52BA"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

      {/* Distributor Table */}
      <div className="transition-opacity duration-200">
        <h2 className="text-lg font-semibold mb-3">
          All Listings ({visibleListings.length})
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", ...regions].map((region) => (
            <button
              key={region}
              onClick={() => setRegionFilter(region)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                regionFilter === region
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              aria-label={region === "all" ? "Filter by all regions" : `Filter by ${region} region`}
            >
              {region === "all" ? "All" : region}
            </button>
          ))}
        </div>
        {bestDeal && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Best Deal (incl. shipping to {shippingRegion})
            </p>
            {(() => {
              const distrib = DISTRIBUTORS.find(
                (d) => d.id === bestDeal.distributorId,
              );
              return (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-base font-bold">
                    {distrib?.countryFlag}{" "}
                    {distrib?.name ?? bestDeal.distributorId}
                  </p>
                  <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                    {formatPrice(bestDeal.total, bestDeal.currency)}
                  </p>
                </div>
              );
            })()}
            <div className="flex gap-4 mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Price: {formatPrice(bestDeal.price, bestDeal.currency)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tax:{" "}
                {bestDeal.tax > 0
                  ? formatPrice(bestDeal.tax, bestDeal.currency)
                  : "Tax-free"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ship: {formatPrice(bestDeal.shipping, bestDeal.currency)}
              </p>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Distributor
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Checked
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Link
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleListings.map((listing) => {
                const dist = DISTRIBUTORS.find(
                  (d) => d.id === listing.distributorId,
                );
                const isBest =
                  bestListing &&
                  listing.distributorId === bestListing.distributorId &&
                  listing.currency === bestListing.currency;

                return (
                  <tr
                    key={`${listing.distributorId}-${listing.currency}`}
                    className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors duration-200 ${isBest ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-l-2 border-l-emerald-400" : "hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {dist?.name ?? listing.distributorId}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {dist?.country} {dist?.countryFlag}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold">
                        {formatPrice(listing.price, listing.currency)}
                      </span>
                      {listing.taxRate != null && listing.taxRate > 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          +
                          {formatPrice(
                            listing.price * listing.taxRate,
                            listing.currency,
                          )}{" "}
                          tax
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Tax-free
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge
                        status={listing.stockStatus}
                        expectedDate={listing.expectedDate}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatLastRefreshed(listing.lastChecked)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 text-sm hover:underline"
                        aria-label={`Visit ${dist?.name ?? listing.distributorId}`}
                      >
                        Visit <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleListings.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {regionFilter !== "all"
                ? `No distributors in ${regionFilter}.`
                : "No distributor listings available."}
            </div>
          )}
        </div>
      </div>

      {/* Set Alert Modal */}
      <Modal
        open={alertOpen}
        onClose={() => {
          setAlertOpen(false);
          setAlertSaved(false);
          setAlertPrice("");
          setAlertError(null);
        }}
        title="Set Price Alert"
      >
        {alertSaved ? (
          <div className="text-center py-4">
            <div className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
              Alert saved!
            </div>
            <p className="text-sm text-gray-500">
              You'll be notified when the price drops below your target.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Get notified when{" "}
              <span className="font-medium">{product.name}</span> drops below
              your target price.
            </p>
            {alertError && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {alertError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                Target Price
              </label>
              <input
                type="number"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Target price"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={alertCurrency}
                onChange={(e) => setAlertCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Alert currency"
              >
                {Object.keys(EXCHANGE_RATES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setAlertOpen(false);
                  setAlertPrice("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAlert}
                disabled={!alertPrice || parseFloat(alertPrice) <= 0}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                aria-label="Save price alert"
              >
                Save Alert
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


