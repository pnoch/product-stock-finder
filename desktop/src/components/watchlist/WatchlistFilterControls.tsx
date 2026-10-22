import type { WatchlistGroup } from "../../../../lib/types";
import type { FilterKey } from "../../hooks/use-watchlist-view";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_stock", label: "In Stock" },
  { key: "back_order", label: "Back Order" },
  { key: "out_of_stock", label: "Out of Stock" },
];

export function WatchlistFilterControls({
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
}: {
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
  onGroupModeChange: (value: WatchlistGroup) => void;
}) {
  return (
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
        <span role="alert" className="text-xs text-gray-500 dark:text-gray-400">
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
  );
}
