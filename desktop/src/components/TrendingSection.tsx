import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Flame, Plus, Check } from "lucide-react";
import { fetchTrending } from "../../../lib/trending";
import type { TrendingProduct } from "../../../lib/types";
import { storage } from "../storage";

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
    await storage.addToWatchlist({
      id: product.id,
      name: product.name,
      modelNumber: product.id,
      brand: product.brand,
      category: product.category,
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [],
    });
    setAddedIds((prev) => new Set([...prev, product.id]));
  };

  if (loading || products.length === 0) return null;

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
        {products.slice(0, 3).map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 transition-colors"
          >
            <Link to={`/product/${product.id}`} className="flex-1 min-w-0">
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
            <button
              onClick={() => handleAdd(product)}
              disabled={addedIds.has(product.id)}
              className={`ml-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
