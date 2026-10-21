import { Link } from "react-router";
import { Search, Tag as TagIcon } from "lucide-react";
import { formatPrice } from "@shared/currency";
import type { TagDefinition, WatchlistGroup } from "../../../../lib/types";
import { TagFilterRow } from "../TagFilterRow";

export type FilterKey = "all" | "in_stock" | "back_order" | "out_of_stock";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_stock", label: "In Stock" },
  { key: "back_order", label: "Back Order" },
  { key: "out_of_stock", label: "Out of Stock" },
];

type Summary = {
  totalValue: number;
  inStock: number;
  backOrder: number;
  outOfStock: number;
  listingCount: number;
};

export function WatchlistFilters({
  summary,
  displayCurrency,
  filter,
  onFilterChange,
  inStockOnly,
  onInStockOnlyChange,
  showAcquired,
  onShowAcquiredChange,
  priceMinInput,
  onPriceMinChange,
  priceMaxInput,
  onPriceMaxChange,
  priceInvalid,
  groupMode,
  onGroupModeChange,
  regions,
  regionFilter,
  onRegionChange,
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  tagCounts,
  onToggleTag,
  onChangeTagMode,
  onClearTags,
  onManageTags,
  query,
  onQueryChange,
  listError,
  onRetryList,
}: {
  summary: Summary;
  displayCurrency: string;
  filter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  showAcquired: boolean;
  onShowAcquiredChange: (value: boolean) => void;
  priceMinInput: string;
  onPriceMinChange: (value: string) => void;
  priceMaxInput: string;
  onPriceMaxChange: (value: string) => void;
  priceInvalid: boolean;
  groupMode: WatchlistGroup;
  onGroupModeChange: (mode: WatchlistGroup) => void;
  regions: string[];
  regionFilter: string;
  onRegionChange: (region: string) => void;
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  tagCounts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeTagMode: (mode: "any" | "all") => void;
  onClearTags: () => void;
  onManageTags: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  listError: string | null;
  onRetryList: () => void;
}) {
  return (
    <>
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

      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onFilterChange(opt.key)}
            aria-pressed={filter === opt.key}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === opt.key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={`Filter by ${opt.label}`}
          >
            {opt.label}
          </button>
        ))}
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockOnlyChange(e.target.checked)}
            className="rounded border-gray-300"
            aria-label="In stock only"
          />
          In stock only
        </label>
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showAcquired}
            onChange={(e) => onShowAcquiredChange(e.target.checked)}
            className="rounded border-gray-300"
            aria-label="Show acquired"
          />
          Show acquired
        </label>
        <input
          type="number"
          value={priceMinInput}
          onChange={(e) => onPriceMinChange(e.target.value)}
          placeholder="Min"
          inputMode="decimal"
          aria-label="Minimum price"
          aria-invalid={priceInvalid}
          className="w-20 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
        <input
          type="number"
          value={priceMaxInput}
          onChange={(e) => onPriceMaxChange(e.target.value)}
          placeholder="Max"
          inputMode="decimal"
          aria-label="Maximum price"
          aria-invalid={priceInvalid}
          className="w-20 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
        {priceInvalid && (
          <span
            role="alert"
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            Enter a valid range (min ≤ max)
          </span>
        )}
        <select
          value={groupMode}
          onChange={(e) => onGroupModeChange(e.target.value as WatchlistGroup)}
          aria-label="Group by"
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="off">Group: Off</option>
          <option value="tag">Group: Tag</option>
          <option value="status">Group: Status</option>
          <option value="region">Group: Region</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...regions].map((region) => (
          <button
            key={region}
            onClick={() => onRegionChange(region)}
            aria-pressed={regionFilter === region}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              regionFilter === region
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={
              region === "all"
                ? "Filter by all regions"
                : `Filter by ${region} region`
            }
          >
            {region === "all" ? "All" : region}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TagFilterRow
            tagDefinitions={tagDefinitions}
            selectedTagIds={selectedTagIds}
            tagMatchMode={tagMatchMode}
            counts={tagCounts}
            onToggleTag={onToggleTag}
            onChangeMode={onChangeTagMode}
            onClearAll={onClearTags}
          />
        </div>
        {Object.keys(tagDefinitions).length > 0 && (
          <button
            onClick={onManageTags}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
            aria-label="Manage tags"
          >
            <TagIcon className="w-3 h-3" /> Manage
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, brand, model, or category…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
          aria-label="Search watchlist"
        />
      </div>

      {listError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-800 dark:text-red-200 flex items-center gap-2"
        >
          <span className="flex-1">
            Couldn&apos;t refresh watchlist: {listError}
          </span>
          <button
            onClick={onRetryList}
            className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-800 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading watchlist"
          >
            Retry
          </button>
        </div>
      )}
    </>
  );
}
