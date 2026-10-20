import { Link } from "react-router";
import {
  BarChart3,
  Bell,
  CheckCircle,
  Clock,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Share2,
  Star,
} from "lucide-react";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "../../../../lib/last-refreshed";

export function ProductActions({
  productId,
  isAcquired,
  loading,
  lastRefreshedAt,
  onSetAlert,
  onRemind,
  onWatchRestock,
  onToggleAcquired,
  onShare,
  onExportCsv,
  onCopyLink,
  onSaveImage,
  onRefresh,
}: {
  productId: string;
  isAcquired: boolean;
  loading: boolean;
  lastRefreshedAt: string | null;
  onSetAlert: () => void;
  onRemind: () => void;
  onWatchRestock: () => void;
  onToggleAcquired: () => void;
  onShare: () => void;
  onExportCsv: () => void;
  onCopyLink: () => void;
  onSaveImage: () => void;
  onRefresh: () => void;
}) {
  return (
      <div className="flex items-center gap-2 flex-wrap transition-opacity duration-200">
        <button
          onClick={onSetAlert}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Set price alert"
        >
          <Bell className="w-4 h-4" /> Set Alert
        </button>
        <button
          onClick={onRemind}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Set a reminder"
        >
          <Clock className="w-4 h-4" /> Remind Me
        </button>
        <button
          onClick={onWatchRestock}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Watch for restock"
        >
          <Star className="w-4 h-4" /> Watch for Restock
        </button>
        <button
          onClick={onToggleAcquired}
          className={`inline-flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${isAcquired ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
          aria-label={isAcquired ? "Acquired — tap to undo" : "Mark as acquired"}
          aria-pressed={isAcquired}
        >
          <CheckCircle className="w-4 h-4" /> {isAcquired ? "Acquired — tap to undo" : "Mark as acquired"}
        </button>
        <button
          onClick={onShare}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Share product"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Export product price history as CSV"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button
          onClick={onCopyLink}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Copy product link"
        >
          <Copy className="w-4 h-4" /> Copy Link
        </button>
        <button
          onClick={onSaveImage}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Save product image"
        >
          <Share2 className="w-4 h-4" /> Save image
        </button>
        <Link
          to={`/compare/${productId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Compare prices across distributors"
        >
          <BarChart3 className="w-4 h-4" /> Compare
        </Link>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer disabled:opacity-50"
          aria-label="Refresh product"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
        {lastRefreshedAt ? (
          (() => {
            // Mobile's ProductInfoCard colors the "Last refreshed" text by
            // freshness (green <1h, amber <6h, red older).
            const iso = new Date(lastRefreshedAt).toISOString();
            const key = getLastRefreshedColor(iso);
            const cls =
              key === "green"
                ? "text-emerald-600 dark:text-emerald-400"
                : key === "yellow"
                  ? "text-amber-600 dark:text-amber-400"
                  : key === "red"
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400";
            return (
              <span className={`text-xs ${cls}`}>Last refreshed: {formatLastRefreshed(iso)}</span>
            );
          })()
        ) : null}
      </div>

  );
}
