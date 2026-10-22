import type {
  DataFreshnessResult,
  StockHealthResult,
} from "../../../../lib/watchlist-stats";

export function StatsHealthCards({
  freshness,
  stockHealth,
}: {
  freshness: DataFreshnessResult | null;
  stockHealth: StockHealthResult | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Data Freshness</p>
        {freshness ? (
          <div className="space-y-1 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Avg data points / listing:{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">{freshness.avgHistoryPoints}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Stale (&gt;7 days): <span className="font-medium text-gray-900 dark:text-gray-100">{freshness.staleCount}</span> · Never checked:{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">{freshness.neverCheckedCount}</span>
            </p>
            <p className="text-xs text-gray-400">
              Oldest check{" "}
              {freshness.oldestCheck
                ? new Date(freshness.oldestCheck).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No data</p>
        )}
      </div>
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Stock Health{stockHealth ? ` (${stockHealth.totalListings} listing${stockHealth.totalListings === 1 ? "" : "s"})` : ""}
        </p>
        {stockHealth ? (
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stockHealth.inStockPct}%</p>
                <p className="text-[11px] text-gray-400">Listings in stock</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{stockHealth.fullyOutOfStock}</p>
                <p className="text-[11px] text-gray-400">Fully out of stock</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{stockHealth.backOrderOnly}</p>
                <p className="text-[11px] text-gray-400">Back-order everywhere</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stockHealth.inStockPct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No data</p>
        )}
      </div>
    </div>
  );
}
