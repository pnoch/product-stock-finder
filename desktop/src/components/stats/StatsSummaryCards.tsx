import { formatPrice } from "@shared/currency";
import type {
  BasketValueResult,
  MoversResult,
  StockHealthResult,
} from "../../../../lib/watchlist-stats";

export function StatsSummaryCards({
  basket,
  basketThreshold,
  displayCurrency,
  stockHealth,
  movers,
  onEditBasketAlert,
}: {
  basket: BasketValueResult | null;
  basketThreshold: number | null;
  displayCurrency: string;
  stockHealth: StockHealthResult | null;
  movers: MoversResult | null;
  onEditBasketAlert: () => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">Basket Value (best in-stock prices)</p>
          <button
            onClick={onEditBasketAlert}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            aria-label={basketThreshold != null ? "Edit basket alert" : "Set alert"}
          >
            {basketThreshold != null ? "Edit alert" : "Set alert"}
          </button>
        </div>
        <p className="text-2xl font-bold mt-1">
          {basket ? formatPrice(basket.total, displayCurrency) : "—"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {basket?.productCount ?? 0} product{(basket?.productCount ?? 0) === 1 ? "" : "s"}
          {basket && basket.excludedCount > 0
            ? ` · ${basket.excludedCount} excluded (no stock)`
            : ""}
        </p>
        {basketThreshold != null && (
          <p className="text-xs text-gray-400 mt-1">
            Alert below {formatPrice(basketThreshold, displayCurrency)}
          </p>
        )}
        {basketThreshold != null && basket && basket.total <= basketThreshold && (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
            Basket below alert threshold
          </p>
        )}
      </div>
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
        <p className="text-sm text-gray-500 dark:text-gray-400">In Stock</p>
        <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
          {stockHealth ? `${stockHealth.inStockPct}%` : "—"}
        </p>
        <p className="text-xs text-gray-400 mt-1">{stockHealth?.totalListings ?? 0} listing{(stockHealth?.totalListings ?? 0) === 1 ? "" : "s"}</p>
      </div>
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">▼ Top Drops</p>
        {movers && movers.drops.length > 0 ? (
          <div className="mt-2 space-y-2">
            {movers.drops.map((m) => (
              <div key={`${m.productId}-${m.distributorId}`} className="flex items-center gap-2">
                <span>{m.countryCode}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.productName}</p>
                  <p className="text-xs text-gray-400 truncate">{m.distributorName} · {formatPrice(m.oldPrice, m.currency)} → {formatPrice(m.newPrice, m.currency)}</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-2 py-0.5">
                  {m.changePct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-gray-400">No movers yet</p>
            <p className="text-xs text-gray-400">Not enough price history yet.</p>
          </div>
        )}
      </div>
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">▲ Top Gainers</p>
        {movers && movers.gainers.length > 0 ? (
          <div className="mt-2 space-y-2">
            {movers.gainers.map((m) => (
              <div key={`${m.productId}-${m.distributorId}`} className="flex items-center gap-2">
                <span>{m.countryCode}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.productName}</p>
                  <p className="text-xs text-gray-400 truncate">{m.distributorName} · {formatPrice(m.oldPrice, m.currency)} → {formatPrice(m.newPrice, m.currency)}</p>
                </div>
                <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5">
                  {m.changePct > 0 ? "+" : ""}{m.changePct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-gray-400">No movers yet</p>
            <p className="text-xs text-gray-400">Not enough price history yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
