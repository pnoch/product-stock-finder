import { Link, useNavigate } from "react-router";
import {
  Package,
  TrendingUp,
  Bell,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useWatchlist, useAlerts } from "../hooks/use-storage";
import { formatPrice, getBestPrice, convertPrice } from "@shared/currency";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { storage } from "../storage";
import { getDistributorById } from "@shared/distributors";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { TrendingSection } from "../components/TrendingSection";
import { ProductImage } from "../components/ProductImage";
import type { StockStatus } from "../../../lib/types";

const STOCK_ORDER: Record<StockStatus, number> = {
  in_stock: 0,
  back_order: 1,
  out_of_stock: 2,
  unknown: 3,
};

function getBestStatus(
  listings: { stockStatus: StockStatus }[],
): StockStatus {
  if (!listings.length) return "unknown";
  const sorted = [...listings].sort(
    (a, b) => STOCK_ORDER[a.stockStatus] - STOCK_ORDER[b.stockStatus],
  );
  return sorted[0]!.stockStatus;
}

function StatCard({
  icon,
  label,
  value,
  delay = 0,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  delay?: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-200 dark:hover:border-brand-700 transition-colors duration-150 animate-fadeIn cursor-pointer text-left w-full motion-reduce:animate-none"
        style={{ animationDelay: `${delay}ms` }}
        aria-label={label}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-200 dark:hover:border-brand-700 transition-colors duration-150 animate-fadeIn motion-reduce:animate-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      {content}
    </div>
  );
}

export function Home() {
  const { products, loading: watchlistLoading } = useWatchlist();
  const { alerts, loading: alertsLoading } = useAlerts();
  const [reminderCount, setReminderCount] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const navigate = useNavigate();

  useEffect(() => {
    storage
      .getBackOrderReminders()
      .then((r) => setReminderCount(r.length))
      .catch(() => {});
    storage
      .getSettings()
      .then((s) => setDisplayCurrency(s?.displayCurrency ?? "USD"))
      .catch(() => {});
  }, []);

  const loading = watchlistLoading || alertsLoading;

  const recentActivity = useMemo(() => {
    return products
      .flatMap((p) => (p.listings ?? []).map((l) => ({ product: p, listing: l })))
      .sort((a, b) => {
        const aTime = isNaN(new Date(a.listing.lastChecked).getTime())
          ? 0
          : new Date(a.listing.lastChecked).getTime();
        const bTime = isNaN(new Date(b.listing.lastChecked).getTime())
          ? 0
          : new Date(b.listing.lastChecked).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [products]);

  if (loading) return <LoadingSpinner size="large" label="Loading dashboard..." />;

  const inStockCount = products.filter((p) =>
    p.listings.some((l) => l.stockStatus === "in_stock"),
  ).length;

  const activeAlerts = alerts.filter((a) => a.isActive).length;

  if (products.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No products tracked"
          description="Add products to your watchlist to see your dashboard."
        />
        <div className="flex justify-center mt-4">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            aria-label="Add products to your watchlist"
          >
            <Plus className="w-4 h-4" /> Add Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          aria-label="Add a new product"
        >
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Total Tracked"
          value={products.length}
          delay={0}
          onClick={() => navigate("/watchlist")}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="In Stock"
          value={inStockCount}
          delay={80}
          onClick={() => navigate("/watchlist")}
        />
        <StatCard
          icon={<Bell className="w-5 h-5" />}
          label="Alerts Active"
          value={activeAlerts}
          delay={160}
          onClick={() => navigate("/alerts")}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Reminders"
          value={reminderCount}
          delay={240}
          onClick={() => navigate("/alerts")}
        />
      </div>

      <TrendingSection />

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <div className="space-y-2">
          {recentActivity.map(({ product, listing }, idx) => {
            const distributor = getDistributorById(listing.distributorId);
            const timeAgo = formatLastRefreshed(listing.lastChecked);
            return (
              <Link
                key={`${product.id}-${listing.distributorId}-${idx}`}
                to={`/product/${product.id}`}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 transition-colors duration-150 cursor-pointer animate-fadeIn motion-reduce:animate-none"
                style={{ animationDelay: `${150 + idx * 60}ms` } as React.CSSProperties}
                aria-label={`View ${product.name} at ${distributor?.name ?? listing.distributorId} details`}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <ProductImage productId={product.id} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {product.brand} · {product.modelNumber} · {distributor ? `${distributor.countryFlag} ${distributor.name}` : listing.distributorId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {(() => {
                      const conv = convertPrice(listing.price, listing.currency, displayCurrency);
                      if (conv !== null && Number.isFinite(conv)) {
                        return formatPrice(conv, displayCurrency);
                      }
                      return formatPrice(listing.price, listing.currency);
                    })()}
                  </span>
                  <StockBadge status={listing.stockStatus} />
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {timeAgo}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {products.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Your Watchlist</h2>
            <Link
              to="/watchlist"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
              aria-label={`View all ${products.length} products`}
            >
              View all {products.length} →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {products.slice(0, 3).map((product) => {
              const bestPrice = getBestPrice(product.listings ?? [], displayCurrency);
              const bestStatus = getBestStatus(product.listings ?? []);
              return (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 transition-colors duration-150"
                  aria-label={`View ${product.name} details`}
                >
                  <ProductImage productId={product.id} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {product.brand} · {product.modelNumber}
                    </p>
                    {bestPrice ? (
                      <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-1">
                        {formatPrice(bestPrice.price, bestPrice.currency)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">No price</p>
                    )}
                  </div>
                  <StockBadge status={bestStatus} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


