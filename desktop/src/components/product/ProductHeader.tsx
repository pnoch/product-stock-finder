import { ArrowLeft } from "lucide-react";
import { DISTRIBUTORS } from "@shared/distributors";
import { formatPrice } from "@shared/currency";
import type { BestDeal } from "../../../../lib/best-deal";
import type { DistributorListing, Product } from "../../../../lib/types";
import { ProductImage } from "../ProductImage";
import { StockBadge } from "../StockBadge";

type HeaderConversion = {
  price: number;
  currency: string;
  converted: number;
  rate: number | null;
};

export function ProductHeader({
  product,
  bestDeal,
  bestDistributor,
  headerConversion,
  displayCurrency,
  visibleListings,
  best,
  onBack,
  onEdit,
}: {
  product: Product;
  bestDeal: BestDeal | null;
  bestDistributor: { paymentMethods?: string[] } | null | undefined;
  headerConversion: HeaderConversion | null;
  displayCurrency: string;
  visibleListings: DistributorListing[];
  best: { price: number; currency: string } | null;
  onBack: () => void;
  onEdit: () => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Go back"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Product Header */}
      <div className="flex items-start gap-4">
        <ProductImage productId={product.id} size={96} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {product.brand} · {product.category} · {product.modelNumber}
          </p>
          {/* Mobile's DetailHeader shows the product region (best deal's region,
              else the first listing's). */}
          {(() => {
            const region =
              (bestDeal
                ? DISTRIBUTORS.find((d) => d.id === bestDeal.distributorId)?.region
                : undefined) ??
              (product.listings?.[0]
                ? DISTRIBUTORS.find((d) => d.id === product.listings[0].distributorId)?.region
                : undefined);
            return region ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{region}</p>
            ) : null;
          })()}
          {/* Mobile's DetailHeader shows an In Stock badge when a best deal
              exists (a best deal is always in-stock). */}
          {bestDeal && (
            <div className="mt-2">
              <StockBadge status="in_stock" />
            </div>
          )}
          {product.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {product.description}
            </p>
          )}
          {headerConversion && (
            <>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {formatPrice(headerConversion.price, headerConversion.currency)} ≈ {formatPrice(headerConversion.converted, displayCurrency)}
              </p>
              {headerConversion.rate !== null ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  1 {headerConversion.currency} = {headerConversion.rate.toFixed(4)} {displayCurrency}
                </p>
              ) : null}
            </>
          )}
          {bestDistributor?.paymentMethods && bestDistributor.paymentMethods.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {bestDistributor.paymentMethods.join(" · ")}
            </p>
          )}
        </div>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
          aria-label="Edit product"
        >
          Edit
        </button>
      </div>

      {/* Stats row — mobile's ProductInfoCard shows Distributors / In Stock /
          Best Price; desktop only had the Best Price card. */}
      <div className="grid grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Distributors</p>
          <p className="text-xl font-bold">{visibleListings.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">In Stock</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {visibleListings.filter((l) => l.stockStatus === "in_stock").length}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Best Price</p>
          <p className="text-xl font-bold text-brand-600 dark:text-brand-400">
            {best ? formatPrice(best.price, best.currency) : "N/A"}
          </p>
        </div>
      </div>
    </>
  );
}
