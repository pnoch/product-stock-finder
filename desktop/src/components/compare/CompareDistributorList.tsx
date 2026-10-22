import { GitCompareArrows, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatPrice } from "@shared/currency";
import { StockBadge } from "../StockBadge";
import type { CompareListing } from "./types";

export function CompareDistributorList({
  listings,
  sortBy,
  onSort,
  getTrend,
}: {
  listings: CompareListing[];
  sortBy: "name" | "price" | "trend";
  onSort: (sort: "name" | "price" | "trend") => void;
  getTrend: (priceHistory: { price: number; date: string }[] | undefined) => "up" | "down" | "flat";
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Distributors
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => onSort("name")}
            aria-pressed={sortBy === "name"}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              sortBy === "name"
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            aria-label="Sort by name"
          >
            A–Z
          </button>
          <button
            onClick={() => onSort("price")}
            aria-pressed={sortBy === "price"}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              sortBy === "price"
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            aria-label="Sort by price"
          >
            Price
          </button>
          <button
            onClick={() => onSort("trend")}
            aria-pressed={sortBy === "trend"}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              sortBy === "trend"
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            aria-label="Sort by trend"
          >
            Trend ▼
          </button>
        </div>
      </div>
      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-gray-300 dark:text-gray-600 mb-3">
            <GitCompareArrows className="w-10 h-10" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No distributors to compare</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Add distributors to this product to see side-by-side prices and trends.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {listings.map((listing, idx) => {
            const trend = getTrend(listing.priceHistory);
            return (
              <div
                key={listing.distributorId}
                className={`flex items-center justify-between px-4 py-3 transition-colors ${
                  idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/60 dark:bg-gray-800/40"
                } hover:bg-gray-50 dark:hover:bg-gray-700/60`}
              >
                <div className="flex items-center gap-3">
                  {listing.dist && (
                    <span className="text-lg">{listing.dist.countryCode}</span>
                  )}
                  <div>
                    <p className="font-medium text-sm">{listing.distName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {listing.dist?.country ?? listing.distributorId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StockBadge
                    status={listing.stockStatus}
                    expectedDate={listing.expectedDate}
                  />
                  <div className="text-right min-w-[100px]">
                    <p className="font-semibold text-sm">
                      {formatPrice(listing.price, listing.currency)}
                    </p>
                  </div>
                  <div className="w-8 flex justify-center">
                    {trend === "down" && (
                      <TrendingDown className="w-4 h-4 text-emerald-500" />
                    )}
                    {trend === "up" && (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    )}
                    {trend === "flat" && (
                      <Minus className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
