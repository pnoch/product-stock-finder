import { Link } from "react-router";
import { formatPrice } from "@shared/currency";
import type { FilterKey } from "../../hooks/use-watchlist-view";

export function WatchlistSummaryCard({
  summary,
  displayCurrency,
  filter,
  onFilterChange,
}: {
  summary: {
    totalValue: number;
    inStock: number;
    backOrder: number;
    outOfStock: number;
    listingCount: number;
  };
  displayCurrency: string;
  filter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          All Listings Value
        </span>
        <span className="text-2xl font-bold">
          {formatPrice(summary.totalValue, displayCurrency)}
        </span>
      </div>
      <div className="flex gap-4 mt-3">
        {(
          [
            {
              key: "in_stock",
              label: "In Stock",
              value: summary.inStock,
              valueClass: "text-emerald-600",
            },
            {
              key: "back_order",
              label: "Back Order",
              value: summary.backOrder,
              valueClass: "text-amber-600",
            },
            {
              key: "out_of_stock",
              label: "Out of Stock",
              value: summary.outOfStock,
              valueClass: "text-red-600",
            },
            {
              key: "all",
              label: "Listings",
              value: summary.listingCount,
              valueClass: "",
            },
          ] as {
            key: FilterKey;
            label: string;
            value: number;
            valueClass: string;
          }[]
        ).map((item) => (
          <button
            key={item.key}
            onClick={() =>
              onFilterChange(filter === item.key ? "all" : item.key)
            }
            aria-pressed={filter === item.key}
            aria-label={`Toggle ${item.label} filter`}
            className={`flex-1 rounded-lg px-2 py-1 text-left transition-colors ${
              filter === item.key
                ? "bg-brand-600/10 ring-2 ring-brand-600"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
          >
            <span className={`block text-lg font-semibold ${item.valueClass}`}>
              {item.value}
            </span>
            <span className="block text-xs text-gray-500">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          to="/stats"
          aria-label="View statistics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          View statistics
        </Link>
      </div>
    </div>
  );
}
