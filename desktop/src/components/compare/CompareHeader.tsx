import { Link } from "react-router";
import { ArrowLeft, RefreshCw, Share2 } from "lucide-react";
import type { Product } from "../../../../lib/types";
import { TimeRangeChips } from "../TimeRangeChips";

export function CompareHeader({
  product,
  loading,
  timeRange,
  onTimeRange,
  onRefresh,
  onShare,
  onSaveImage,
  onExportCsv,
}: {
  product: Product;
  loading: boolean;
  timeRange: string;
  onTimeRange: (range: string) => void;
  onRefresh: () => void;
  onShare: () => void;
  onSaveImage: () => void;
  onExportCsv: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Compare Prices</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {product.name} · {product.brand} {product.modelNumber}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/watchlist"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          aria-label="Back to watchlist"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Refresh comparison"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        <button
          onClick={onShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          aria-label="Share comparison"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button
          onClick={onSaveImage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          aria-label="Save comparison image"
        >
          Save image
        </button>
        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          aria-label="Export price history as CSV"
        >
          Export CSV
        </button>
        <TimeRangeChips selected={timeRange} onSelect={onTimeRange} />
      </div>
    </div>
  );
}
