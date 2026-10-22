import { isAcquired } from "../../../../lib/acquired";
import type { Product } from "../../../../lib/types";

export function WatchlistEmptyState({
  products,
  showAcquired,
  onClearFilters,
}: {
  products: Product[];
  showAcquired: boolean;
  onClearFilters: () => void;
}) {
  const allAcquired = products.length > 0 && products.every(isAcquired);
  return (
    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 space-y-3">
      {allAcquired && !showAcquired ? (
        <>
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            Everything here is acquired
          </p>
          <p>
            All your watched parts are marked as acquired. Turn on &quot;Show
            acquired&quot; to see them.
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            No products match your filters
          </p>
          <p>
            Try adjusting your filters or search — or add a new product to
            track.
          </p>
        </>
      )}
      {products.length > 0 && (
        <button
          onClick={onClearFilters}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          aria-label="Clear all filters"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
