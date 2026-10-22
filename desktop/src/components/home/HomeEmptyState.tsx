import { Link } from "react-router";
import { Lightbulb, Package, Plus } from "lucide-react";
import { DISTRIBUTORS } from "@shared/distributors";
import { EmptyState } from "../EmptyState";
import { TrendingSection } from "../TrendingSection";

export function HomeEmptyState({
  loadError,
  onRetry,
}: {
  loadError: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load dashboard: {loadError}</span>
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading dashboard"
          >
            Retry
          </button>
        </div>
      )}
      <EmptyState
        icon={<Package className="w-8 h-8" />}
        title="Nothing on the radar yet"
        description={`Click Add Product and paste a model number — we'll check all ${DISTRIBUTORS.length} distributors and alert you the moment it's in stock.`}
      />
      <div className="flex justify-center mt-3">
        <p className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-300/40 bg-amber-50 dark:bg-amber-900/20 text-xs text-gray-500 dark:text-gray-400">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
          Try: RTX 4090, Pi 5, CRS326, or U7 Pro Max
        </p>
      </div>
      <div className="flex justify-center mt-4">
        <Link
          to="/search"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          aria-label="Add products to your watchlist"
        >
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>
      <div className="mt-6">
        <TrendingSection />
      </div>
    </div>
  );
}
