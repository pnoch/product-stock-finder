import {
  Plus,
  RefreshCw,
  Settings2,
  Share2,
  Tag as TagIcon,
  Zap,
} from "lucide-react";

export function WatchlistToolbar({
  collapsed,
  productsCount,
  filteredCount,
  selectionMode,
  selectedCount,
  refreshing,
  refreshProgress,
  checking,
  checkProgress,
  importInputRef,
  onSelectMode,
  onBulkTag,
  onBulkDelete,
  onCancelSelection,
  onDistributorAnalysis,
  onShare,
  onImportFile,
  onImportClick,
  onCheckNow,
  onRefresh,
  onManageTags,
  onAddProduct,
}: {
  collapsed: boolean;
  productsCount: number;
  filteredCount: number;
  selectionMode: boolean;
  selectedCount: number;
  refreshing: boolean;
  refreshProgress: { current: number; total: number } | null;
  checking: boolean;
  checkProgress: { current: number; total: number } | null;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectMode: () => void;
  onBulkTag: () => void;
  onBulkDelete: () => void;
  onCancelSelection: () => void;
  onDistributorAnalysis: () => void;
  onShare: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportClick: () => void;
  onCheckNow: () => void;
  onRefresh: () => void;
  onManageTags: () => void;
  onAddProduct: () => void;
}) {
  return (
    <div
      className={`sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-3 bg-[#F8FAFC] dark:bg-[#0A0E1A] border-b transition-all duration-200 ${
        collapsed ? "shadow-sm py-3" : "border-transparent"
      }`}
      style={{
        opacity: collapsed ? 0.97 : 1,
        transform: collapsed ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className={
            collapsed
              ? "transition-all duration-200 scale-[0.96] origin-left"
              : "transition-all duration-200"
          }
        >
          <h1
            className={`font-bold transition-all duration-200 ${
              collapsed ? "text-lg" : "text-2xl"
            }`}
          >
            Watchlist
          </h1>
          <p
            className={`text-gray-500 dark:text-gray-400 transition-all duration-200 ${
              collapsed ? "text-xs" : "text-sm"
            }`}
          >
            {productsCount} product{productsCount !== 1 ? "s" : ""} tracked
            {filteredCount !== productsCount
              ? ` · ${filteredCount} shown`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!selectionMode ? (
            <button
              onClick={onSelectMode}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              aria-label="Enter bulk select mode"
            >
              Select
            </button>
          ) : (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {selectedCount} selected
              </span>
              <button
                onClick={onBulkTag}
                disabled={selectedCount === 0}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50"
              >
                <TagIcon className="w-3.5 h-3.5" /> Tag
              </button>
              <button
                onClick={onBulkDelete}
                disabled={selectedCount === 0}
                className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={onCancelSelection}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={onDistributorAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="View distributor analysis"
          >
            Distributor Analysis
          </button>
          <button
            onClick={onShare}
            disabled={refreshing || productsCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Share watchlist"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportFile}
            aria-hidden
          />
          <button
            onClick={onImportClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
            aria-label="Import CSV"
          >
            Import CSV
          </button>
          <button
            onClick={onCheckNow}
            disabled={refreshing || checking || productsCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Check prices now"
          >
            <Zap className="w-4 h-4" />
            Check Now
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Refresh prices"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing && refreshProgress
              ? `Refreshing ${refreshProgress.current}/${refreshProgress.total} prices`
              : "Refresh"}
          </button>
          <button
            onClick={onManageTags}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            aria-label="Manage tags"
          >
            <Settings2 className="w-4 h-4" /> Manage Tags
          </button>
          <button
            onClick={onAddProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            aria-label="Add product"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
          {checking && checkProgress && (
            <span className="text-xs text-gray-500">
              Checking {checkProgress.current}/{checkProgress.total} products
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
