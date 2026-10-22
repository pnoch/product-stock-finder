import type { ProductInsightsResult } from "../../../../lib/product-insights";

export function ProductInsightsCard({ insights }: { insights: ProductInsightsResult }) {
  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
      <p className="text-sm text-gray-500 dark:text-gray-400">Product Insights</p>
      <div className="flex gap-2 mt-1">
        <div className="flex-1">
          <p className="text-lg font-bold text-emerald-600">{insights.allTimeLows}</p>
          <p className="text-xs text-gray-400">At all-time low</p>
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-brand-600 dark:text-brand-400">{insights.droppingCount}</p>
          <p className="text-xs text-gray-400">Dropping now</p>
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {insights.volatility.low}·{insights.volatility.medium}·{insights.volatility.high}
          </p>
          <p className="text-xs text-gray-400">Volatility</p>
          <p className="text-[11px] text-gray-400">Low · Medium · High</p>
        </div>
      </div>
      {(() => {
        const lows = insights.products.filter((p) => p.atAllTimeLow).slice(0, 3);
        if (lows.length === 0) return null;
        return (
          <div className="mt-2 space-y-1">
            {lows.map((p) => (
              <p key={p.productId} className="text-xs text-emerald-600 truncate">
                {p.name} is at its all-time low
              </p>
            ))}
            {insights.allTimeLows > lows.length && (
              <p className="text-xs text-gray-400">
                +{insights.allTimeLows - lows.length} more at all-time low
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
