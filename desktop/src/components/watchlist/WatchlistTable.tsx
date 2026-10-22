import type { RefObject } from "react";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import type { Product } from "../../../../lib/types";
import type { WatchlistRow as WatchlistRowData } from "../../lib/watchlist-rows";
import type { SortKey } from "../../hooks/use-watchlist-view";
import { WatchlistTableHeader } from "./WatchlistTableHeader";
import { WatchlistTableBody } from "./WatchlistTableBody";
import { WatchlistEmptyState } from "./WatchlistEmptyState";

export function WatchlistTable({
  scrollRef,
  rows,
  virtualRows,
  selectionMode,
  sortKey,
  sortAsc,
  onSort,
  rowVirtualizer,
  renderRow,
  sortedLength,
  products,
  showAcquired,
  onClearFilters,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  rows: WatchlistRowData[];
  virtualRows: VirtualItem[];
  selectionMode: boolean;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  renderRow: (
    product: Product,
    virtual?: {
      ref: (el: HTMLTableRowElement | null) => void;
      index: number;
    },
  ) => React.ReactNode;
  sortedLength: number;
  products: Product[];
  showAcquired: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div
      ref={scrollRef}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[60vh] overflow-y-auto"
    >
      <div className="overflow-x-auto">
        <table className="w-full" aria-rowcount={rows.length}>
          <WatchlistTableHeader
            selectionMode={selectionMode}
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={onSort}
          />
          <WatchlistTableBody
            rows={rows}
            virtualRows={virtualRows}
            selectionMode={selectionMode}
            rowVirtualizer={rowVirtualizer}
            renderRow={renderRow}
          />
        </table>
      </div>

      {sortedLength === 0 && (
        <WatchlistEmptyState
          products={products}
          showAcquired={showAcquired}
          onClearFilters={onClearFilters}
        />
      )}
    </div>
  );
}
