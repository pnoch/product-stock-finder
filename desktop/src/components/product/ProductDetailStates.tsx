import { ArrowLeft, Plus } from "lucide-react";
import type { Product } from "../../../../lib/types";
import { ProductImage } from "../ProductImage";

export function ProductDetailSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
      <div className="h-6 w-24 rounded skeleton-shimmer" />
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-xl skeleton-shimmer shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-3/4 rounded skeleton-shimmer" />
          <div className="h-4 w-1/2 rounded skeleton-shimmer" />
          <div className="h-3 w-full rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="h-32 rounded-xl skeleton-shimmer" />
      <div className="h-72 rounded-xl skeleton-shimmer" />
      <div className="h-64 rounded-xl skeleton-shimmer" />
    </div>
  );
}

export function UntrackedProductCard({
  product,
  addingToWatchlist,
  onAdd,
  onBack,
}: {
  product: Product;
  addingToWatchlist: boolean;
  onAdd: () => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Go back"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-start gap-4">
        <ProductImage productId={product.id} size={96} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {product.brand} · {product.category} · {product.modelNumber}
          </p>
          {product.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{product.description}</p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This product isn&apos;t in your watchlist yet. Add it to track prices across distributors.
        </p>
        <button
          onClick={onAdd}
          disabled={addingToWatchlist}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          aria-label="Add to watchlist"
        >
          <Plus className="w-4 h-4" /> {addingToWatchlist ? "Adding…" : "Add to Watchlist"}
        </button>
      </div>
    </div>
  );
}

export function ProductNotFound({
  loadError,
  onBack,
  onRetry,
}: {
  loadError: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          aria-label={loadError ? "Retry loading product" : "Try loading product again"}
        >
          {loadError ? "Retry" : "Try Again"}
        </button>
      </div>
      {loadError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200">
          Couldn&apos;t load product: {loadError}
        </div>
      ) : (
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold mb-1">Product not found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This product may have been removed from your watchlist.
          </p>
        </div>
      )}
    </div>
  );
}
