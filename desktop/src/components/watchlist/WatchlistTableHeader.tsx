import { ArrowUpDown } from "lucide-react";

export type WatchlistSortKey =
  | "name"
  | "price"
  | "deal"
  | "trend"
  | "lastUpdated";

function SortableHeader({
  label,
  sortKey,
  activeKey,
  sortAsc,
  onSort,
}: {
  label: string;
  sortKey: WatchlistSortKey;
  activeKey: WatchlistSortKey;
  sortAsc: boolean;
  onSort: (key: WatchlistSortKey) => void;
}) {
  return (
    <th
      className="text-left"
      aria-sort={
        activeKey === sortKey ? (sortAsc ? "ascending" : "descending") : "none"
      }
    >
      <button
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );
}

export function WatchlistTableHeader({
  selectionMode,
  sortKey,
  sortAsc,
  onSort,
}: {
  selectionMode: boolean;
  sortKey: WatchlistSortKey;
  sortAsc: boolean;
  onSort: (key: WatchlistSortKey) => void;
}) {
  return (
    <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
      <tr className="border-b border-gray-200 dark:border-gray-700">
        {selectionMode && (
          <th className="px-2 py-3 w-8">
            <span className="sr-only">Select</span>
          </th>
        )}
        <SortableHeader
          label="Name"
          sortKey="name"
          activeKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSort}
        />
        <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
          Listings
        </th>
        <SortableHeader
          label="Price"
          sortKey="price"
          activeKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSort}
        />
        <SortableHeader
          label="Deal"
          sortKey="deal"
          activeKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSort}
        />
        <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
          Stock
        </th>
        <SortableHeader
          label="Trend"
          sortKey="trend"
          activeKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSort}
        />
        <SortableHeader
          label="Last Updated"
          sortKey="lastUpdated"
          activeKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSort}
        />
        <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
          Actions
        </th>
      </tr>
    </thead>
  );
}
