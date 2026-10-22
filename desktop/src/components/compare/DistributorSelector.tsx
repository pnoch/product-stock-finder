import { Check } from "lucide-react";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { distributorColor } from "@shared/compare-utils";
import type { CompareListing, PriceTrend } from "./types";

export function DistributorSelector({
  listings,
  selected,
  priceTrends,
  onToggle,
}: {
  listings: CompareListing[];
  selected: Set<string>;
  priceTrends: Map<string, PriceTrend>;
  onToggle: (distributorId: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Select Distributors ({selected.size}/5)
        </h2>
        <span className="text-xs text-gray-400">
          {listings.filter((l) => l.priceHistory && l.priceHistory.length >= 2).length} with history
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {listings.map((listing) => {
          const distributor = getDistributorById(listing.distributorId);
          const isSelected = selected.has(listing.distributorId);
          const hasHistory = listing.priceHistory && listing.priceHistory.length >= 2;
          const chipColor = isSelected ? distributorColor(listing.distributorId) : "#d1d5db";
          const trend = priceTrends.get(listing.distributorId);
          const disabled = !hasHistory && !isSelected;
          const atLimit = !isSelected && selected.size >= 5;
          return (
            <button
              key={listing.distributorId}
              onClick={() => onToggle(listing.distributorId)}
              disabled={disabled || atLimit}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? "Deselect" : "Select"} ${distributor?.name ?? listing.distributorId}`}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? "text-white border-transparent"
                  : disabled || atLimit
                    ? "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
              style={isSelected ? { backgroundColor: chipColor, borderColor: chipColor } : undefined}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: isSelected ? "#fff" : "transparent",
                  borderColor: isSelected ? "#fff" : chipColor,
                }}
              >
                {isSelected && <Check className="w-3 h-3" style={{ color: chipColor }} />}
              </span>
              <span>{distributor?.countryCode}</span>
              <span>{distributor?.name ?? listing.distributorId}</span>
              <span className={`ml-1 ${isSelected ? "text-white/90" : "text-gray-500 dark:text-gray-400"}`}>
                {formatPrice(listing.price, listing.currency)}
              </span>
              {trend && trend.dir !== "flat" && (
                <span className={`text-[10px] font-bold ${isSelected ? "text-white" : trend.dir === "down" ? "text-emerald-600" : "text-red-500"}`}>
                  {trend.dir === "down" ? "▼" : "▲"} {trend.pct.toFixed(1)}%
                </span>
              )}
              {!hasHistory && <span className="text-[10px] opacity-70">(no history)</span>}
            </button>
          );
        })}
      </div>
      {selected.size >= 5 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Maximum 5 distributors selected.</p>
      )}
    </div>
  );
}
