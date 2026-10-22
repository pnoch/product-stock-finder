import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import type { RegionBest } from "@shared/compare-utils";
import { StockBadge } from "../StockBadge";

export function CheapestByRegion({
  regionBest,
  displayCurrency,
}: {
  regionBest: RegionBest[];
  displayCurrency: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Cheapest by Region
      </h3>
      {regionBest.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">No in-stock regions</p>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {regionBest.map((item, i) => {
            const dist = getDistributorById(item.listing.distributorId);
            return (
              <div
                key={item.region}
                className={`flex items-center justify-between px-3 py-2.5 ${
                  i === 0 ? "bg-emerald-50 dark:bg-emerald-900/20 rounded-lg" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300">
                      BEST
                    </span>
                  )}
                  <span className="text-sm font-medium">{item.region}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{dist?.countryCode}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {dist?.name ?? item.listing.distributorId}
                  </span>
                </div>
                <span className="flex flex-col items-end gap-1">
                  <span className={`text-sm font-semibold ${i === 0 ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                    {formatPrice(item.listing.price, item.listing.currency)}
                    {item.listing.currency !== displayCurrency && (
                      <> ≈ {formatPrice(item.converted, displayCurrency)}</>
                    )}
                  </span>
                  <StockBadge status={item.listing.stockStatus} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
