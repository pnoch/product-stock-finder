import { Link } from "react-router";
import { BarChart3, Package } from "lucide-react";
import { EmptyState } from "../EmptyState";

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

export function StatsLoading() {
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

export function StatsError({
  loadError,
  onRetry,
}: {
  loadError: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl font-bold">Statistics</h1>
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
        <span className="flex-1">Couldn&apos;t load statistics: {loadError}</span>
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
          aria-label="Retry loading statistics"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export function StatsEmpty() {
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
          <Package className="w-4 h-4" /> Browse Products
        </Link>
      </div>
    </div>
  );
}
