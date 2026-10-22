import { Link, useNavigate } from "react-router";
import { Plus, RefreshCw } from "lucide-react";
import { useWatchlist, useAlerts } from "../hooks/use-storage";
import { countActiveAlerts } from "../../../lib/alert-state";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { useConnection } from "../hooks/use-connection";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { TrendingSection } from "../components/TrendingSection";
import { DropLeaderboard } from "../components/DropLeaderboard";
import { activeProducts } from "../../../lib/acquired";
import { useHomeData } from "../hooks/use-home-data";
import { HomeStats } from "../components/home/HomeStats";
import { RecentActivity } from "../components/home/RecentActivity";
import { HomeWatchlistPreview } from "../components/home/HomeWatchlistPreview";
import { HomeEmptyState } from "../components/home/HomeEmptyState";

export function Home() {
  const { products, loading: watchlistLoading, refresh: refreshWatchlist } = useWatchlist();
  const { alerts, loading: alertsLoading, refresh: refreshAlerts } = useAlerts();
  const navigate = useNavigate();
  const connection = useConnection();
  const {
    reminderCount,
    displayCurrency,
    loadError,
    refreshing,
    refreshDashboard,
    handleRetry,
    loading,
    recentActivity,
  } = useHomeData({
    products,
    watchlistLoading,
    alertsLoading,
    refreshWatchlist,
    refreshAlerts,
  });

  if (loading) return <LoadingSpinner size="large" label="Loading dashboard..." />;

  const inStockCount = activeProducts(products).filter((p) =>
    (p.listings ?? []).some((l) => l.stockStatus === "in_stock"),
  ).length;

  const activeAlerts = countActiveAlerts(alerts);

  if (products.length === 0) {
    return <HomeEmptyState loadError={loadError} onRetry={handleRetry} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Stock Finder</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Find it anywhere. Landed to your door.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshDashboard()}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <ConnectionBadge
            status={connection.status}
            onPress={
              connection.status === "signed-out"
                ? () => navigate("/settings")
                : undefined
            }
          />
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Add a new product"
          >
            <Plus className="w-4 h-4" /> Add Product
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load dashboard: {loadError}</span>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading dashboard"
          >
            Retry
          </button>
        </div>
      )}

      <HomeStats
        tracked={products.length}
        inStock={inStockCount}
        activeAlerts={activeAlerts}
        reminders={reminderCount}
        onNavigate={navigate}
      />

      <TrendingSection />

      <DropLeaderboard />

      <RecentActivity items={recentActivity} displayCurrency={displayCurrency} />

      <HomeWatchlistPreview products={products} displayCurrency={displayCurrency} />
    </div>
  );
}
