import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Flame, Plus, Check } from "lucide-react";
import { fetchTrending } from "@shared/trending";
import type { TrendingProduct } from "../../../lib/types";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { ProductImage } from "./ProductImage";

function currencySymbol(c: string) {
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  if (c === "GBP") return "£";
  return c + " ";
}

export function TrendingSection() {
  const [products, setProducts] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const { toast, showToast } = useToast();

  useEffect(() => {
    fetchTrending()
      .then((data) => setProducts(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    storage.getWatchlist().then((w) => {
      setAddedIds(new Set(w.map((p) => p.id)));
    });
  }, []);

  const handleAdd = async (product: TrendingProduct) => {
    try {
      await storage.addToWatchlist({
        id: product.id,
        name: product.name,
        modelNumber: product.id,
        brand: product.brand,
        category: product.category,
        description: product.reason,
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: [],
      });
      setAddedIds((prev) => new Set([...prev, product.id]));
      showToast("Added to watchlist");
    } catch {
      showToast("Failed to add");
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Trending Now
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Hard-to-find products from the community
        </p>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center flex-1 min-w-0 gap-3">
                <div className="w-10 h-10 rounded-lg skeleton-shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                  <div className="h-3 w-2/3 rounded skeleton-shimmer" />
                </div>
              </div>
              <div className="ml-4 w-20 h-7 rounded-lg skeleton-shimmer shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60] animate-fadeIn">
          {toast}
        </div>
      )}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        Trending Now
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Hard-to-find products from the community
      </p>
      <div className="space-y-2">
        {products.slice(0, 3).map((product, idx) => (
          <div
            key={product.id}
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-sm transition-all duration-200 animate-fadeIn"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="flex items-center flex-1 min-w-0">
            <ProductImage productId={product.id} size={40} />
            <Link to={`/product/${product.id}`} className="flex-1 min-w-0" aria-label={`View ${product.name} details`}>
              <p className="font-medium truncate">{product.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {product.category} · {product.brand} ·{" "}
                {currencySymbol(product.currency)}
                {product.estimatedPrice.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                {product.reason}
              </p>
            </Link>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAdd(product);
              }}
              disabled={addedIds.has(product.id)}
              aria-label={addedIds.has(product.id) ? `${product.name} is in watchlist` : `Add ${product.name} to watchlist`}
              className={`ml-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                addedIds.has(product.id)
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-default"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {addedIds.has(product.id) ? (
                <>
                  <Check className="w-3 h-3" /> In Watchlist
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" /> Add
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
