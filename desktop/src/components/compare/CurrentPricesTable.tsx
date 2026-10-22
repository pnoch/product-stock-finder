import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { convertPrice } from "@/lib/currency";
import { distributorColor } from "@shared/compare-utils";
import { StockBadge } from "../StockBadge";
import type { CompareListing } from "./types";

export function CurrentPricesTable({
  listings,
  selected,
  displayCurrency,
}: {
  listings: CompareListing[];
  selected: Set<string>;
  displayCurrency: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Current Prices
      </h2>
      {selected.size === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
          No distributors selected
        </p>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {listings
            .filter((l) => selected.has(l.distributorId))
            .map((l) => {
              const distributor = getDistributorById(l.distributorId);
              const color = distributorColor(l.distributorId);
              const converted = convertPrice(l.price, l.currency, displayCurrency);
              return (
                <div key={l.distributorId} className="flex items-center gap-3 py-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {distributor?.countryCode} {distributor?.name ?? l.distributorId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{distributor?.country}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-semibold">{formatPrice(l.price, l.currency)}</span>
                    {l.currency !== displayCurrency && converted !== null && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ≈ {formatPrice(converted, displayCurrency)}
                      </span>
                    )}
                    <StockBadge status={l.stockStatus} />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
