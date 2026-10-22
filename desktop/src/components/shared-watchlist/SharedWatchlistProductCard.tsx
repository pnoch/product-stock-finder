import { formatPrice } from "@shared/currency";
import { getBestPrice } from "@/lib/currency";
import { getDistributorById } from "@shared/distributors";
import { StockBadge } from "../StockBadge";

export type SharedProduct = {
  id: string;
  name: string;
  brand?: string;
  modelNumber?: string;
  listings?: {
    distributorId: string;
    price: number;
    currency: string;
    stockStatus: "in_stock" | "back_order" | "out_of_stock" | "unknown";
  }[];
};

export function SharedWatchlistProductCard({
  product,
  displayCurrency,
  added,
  onAdd,
  onExportHistory,
}: {
  product: SharedProduct;
  displayCurrency: string;
  added: boolean;
  onAdd: () => void;
  onExportHistory: () => void;
}) {
  const first = product.listings?.[0];
  const best = first ? getBestPrice(product.listings ?? [], displayCurrency) : null;
  const price = best ?? first;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="font-semibold text-sm">{product.name}</div>
      {product.brand && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{product.brand}</div>}
      <div className="flex items-center gap-2 mt-2">
        {price && (
          <span className="text-sm font-semibold">
            {formatPrice(price.price, price.currency)}
          </span>
        )}
      </div>
      {(product.listings?.length ?? 0) > 0 ? (
        <div className="mt-2 space-y-1.5">
          {(product.listings ?? []).slice(0, 5).map((l) => (
            <div key={l.distributorId} className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {formatPrice(l.price, l.currency)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {getDistributorById(l.distributorId)?.name ?? l.distributorId}
              </span>
              <StockBadge status={l.stockStatus} />
            </div>
          ))}
          {(product.listings ?? []).length > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">+{(product.listings ?? []).length - 5} more distributors</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No distributor prices yet</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onAdd}
          disabled={added}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          aria-label="Add to watchlist"
        >
          {added ? "Added" : "Add"}
        </button>
        <button
          onClick={onExportHistory}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          aria-label={`Export history for ${product.name}`}
        >
          Export history
        </button>
      </div>
    </div>
  );
}
