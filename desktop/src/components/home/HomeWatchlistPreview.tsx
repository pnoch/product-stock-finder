import { Link } from "react-router";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "@/lib/currency";
import type { Product, StockStatus } from "../../../../lib/types";
import { ProductImage } from "../ProductImage";
import { StockBadge } from "../StockBadge";

const STOCK_ORDER: Record<StockStatus, number> = {
  in_stock: 0,
  back_order: 1,
  out_of_stock: 2,
  unknown: 3,
};

function getBestStatus(listings: { stockStatus: StockStatus }[]): StockStatus {
  if (!listings.length) return "unknown";
  const sorted = [...listings].sort(
    (a, b) => STOCK_ORDER[a.stockStatus] - STOCK_ORDER[b.stockStatus],
  );
  return sorted[0]!.stockStatus;
}

export function HomeWatchlistPreview({
  products,
  displayCurrency,
}: {
  products: Product[];
  displayCurrency: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Your Watchlist</h2>
        <Link
          to="/watchlist"
          className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          aria-label={`View all ${products.length} product${products.length === 1 ? "" : "s"}`}
        >
          View all {products.length} product{products.length === 1 ? "" : "s"} →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {products.slice(0, 3).map((product) => {
          const bestPrice = getBestPrice(product.listings ?? [], displayCurrency);
          const bestStatus = getBestStatus(product.listings ?? []);
          return (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 transition-colors duration-150"
              aria-label={`View ${product.name} details`}
            >
              <ProductImage productId={product.id} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{product.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {product.brand} · {product.modelNumber}
                </p>
                {bestPrice ? (
                  <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-1">
                    {formatPrice(bestPrice.price, bestPrice.currency)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No price</p>
                )}
              </div>
              <StockBadge status={bestStatus} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
