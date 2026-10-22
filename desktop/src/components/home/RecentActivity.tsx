import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { convertPrice } from "@/lib/currency";
import { formatLastRefreshed } from "../../../../lib/last-refreshed";
import type { DistributorListing, Product } from "../../../../lib/types";
import { ProductImage } from "../ProductImage";
import { StockBadge } from "../StockBadge";

export function RecentActivity({
  items,
  displayCurrency,
}: {
  items: { product: Product; listing: DistributorListing | null }[];
  displayCurrency: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
      <div className="space-y-2">
        {items.map(({ product, listing }, idx) => {
          const distributor = listing ? getDistributorById(listing.distributorId) : undefined;
          const distributorLabel = distributor ? `${distributor.countryCode} ${distributor.name}` : (listing?.distributorId ?? "unknown");
          const timeAgo = formatLastRefreshed(listing?.lastChecked ?? product.addedAt);
          return (
            <Link
              key={`${product.id}-${listing?.distributorId ?? "unknown"}-${idx}`}
              to={`/product/${product.id}`}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 transition-colors duration-150 cursor-pointer animate-fadeIn motion-reduce:animate-none"
              style={{ animationDelay: `${150 + idx * 60}ms` } as React.CSSProperties}
              aria-label={`View ${product.name} at ${distributor?.name ?? listing?.distributorId ?? "unknown"} details`}
            >
              <div className="flex items-center flex-1 min-w-0">
                <ProductImage productId={product.id} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {product.brand} · {product.modelNumber} · {distributorLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {listing ? (
                    (() => {
                      const conv = convertPrice(listing.price, listing.currency, displayCurrency);
                      if (conv !== null && Number.isFinite(conv)) {
                        return formatPrice(conv, displayCurrency);
                      }
                      return formatPrice(listing.price, listing.currency);
                    })()
                  ) : (
                    "No price"
                  )}
                </span>
                <StockBadge status={listing?.stockStatus ?? "unknown"} />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {timeAgo}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
