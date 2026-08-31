import { Link } from "react-router";
import {
  Package,
  TrendingUp,
  Bell,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWatchlist, useAlerts } from "../hooks/use-storage";
import { formatPrice, getBestPrice } from "../../../lib/currency";
import { storage } from "../storage";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { TrendingSection } from "../components/TrendingSection";
import { ProductImage } from "../components/ProductImage";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export function Home() {
  const { products, loading: watchlistLoading } = useWatchlist();
  const { alerts, loading: alertsLoading } = useAlerts();
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    storage
      .getBackOrderReminders()
      .then((r) => setReminderCount(r.length))
      .catch(() => {});
  }, []);

  const loading = watchlistLoading || alertsLoading;

  if (loading) return <LoadingSpinner />;

  const inStockCount = products.filter((p) =>
    p.listings.some((l) => l.stockStatus === "in_stock"),
  ).length;

  const activeAlerts = alerts.filter((a) => a.isActive).length;

  const recentProducts = [...products]
    .sort((a, b) => {
      const aTime = a.lastRefreshed ?? a.addedAt;
      const bTime = b.lastRefreshed ?? b.addedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
    .slice(0, 5);

  if (products.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Package className="w-12 h-12" />}
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
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="In Stock"
          value={inStockCount}
        />
        <StatCard
          icon={<Bell className="w-5 h-5" />}
          label="Alerts Active"
          value={activeAlerts}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Reminders"
          value={reminderCount}
        />
      </div>

      <TrendingSection />

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <div className="space-y-2">
          {recentProducts.map((product) => {
            const best = getBestPrice(product.listings, "USD");
            const listing = product.listings.find(
              (l) =>
                best && l.price === best.price && l.currency === best.currency,
            );
            const refreshed = product.lastRefreshed ?? product.addedAt;
            const timeAgo = formatTimeAgo(refreshed);

            return (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 transition-colors"
                role="button"
                aria-label={`View ${product.name} details`}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <ProductImage productId={product.id} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {product.brand} · {product.modelNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  {best ? (
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatPrice(best.price, best.currency)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">No price</span>
                  )}
                  {listing && <StockBadge status={listing.stockStatus} />}
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
    </div>
  );
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
